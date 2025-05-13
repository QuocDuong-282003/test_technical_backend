const dbPool = require('../config/db');
const asyncWrapper = require('../middlewares/asyncWrapper');
const AppError = require('../utils/AppError');
const { sendOrderConfirmationEmail } = require('../services/emailService');
const { processPayment } = require('../services/paymentService');
exports.createOrder = asyncWrapper(async (req, res, next) => {
    const {
        userId,
        shippingAddressId,
        billingAddressId,
        items,
        voucherCodes,
        paymentMethod,
        paymentDetails,
        notes
    } = req.body;

    //VALIDATION 
    if (!userId || !Number.isInteger(userId))
        return next(new AppError('Valid userId is required.', 400));
    if (!shippingAddressId || !Number.isInteger(shippingAddressId))
        return next(new AppError('Valid shippingAddressId is required.', 400));
    if (!items || !Array.isArray(items) || items.length === 0)
        return next(
            new AppError('Items array cannot be empty.', 400));
    for (const item of items) {
        if (!item.productVariantId || !Number.isInteger(item.productVariantId) || !item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
            return next
                (new AppError(`Invalid item data: ${JSON.stringify(item)}. productVariantId and quantity (positive integer) are required.`, 400));
        }
    }
    if (!paymentMethod || !['cod', 'credit_card', 'bank_transfer'].includes(paymentMethod)) { //  các phương thức hợp lệ
        return next(new
            AppError('Valid paymentMethod is required (cod, credit_card, bank_transfer).',
                400));
    }
    if (billingAddressId && !Number.isInteger(billingAddressId))
        return next(new AppError('If provided, billingAddressId must be a valid ID.', 400));


    let connection; // Connection cho transaction này
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [userRows] = await connection.execute('SELECT id, email FROM Users WHERE id = ?', [userId]);
        if (userRows.length === 0) {
            await connection.rollback();
            throw new AppError('User not found', 404);
        }
        const user = userRows[0];

        const [addressRows] = await connection.execute('SELECT id FROM Addresses WHERE id = ? AND user_id = ?', [shippingAddressId, userId]);
        if (addressRows.length === 0) {
            await connection.rollback();
            throw new AppError('Shipping address not found or does not belong to user', 404);
        }

        let finalBillingAddressId = billingAddressId || shippingAddressId;
        if (billingAddressId && billingAddressId !== shippingAddressId) {
            const [billingAddrRows] = await connection.execute('SELECT id FROM Addresses WHERE id = ? AND user_id = ?', [billingAddressId, userId]);
            if (billingAddrRows.length === 0) {
                await connection.rollback();
                throw new AppError('Billing address not found or does not belong to user', 404);
            }
        }

        let subtotalAmount = 0;
        const orderItemsData = [];

        for (const item of items) {
            const [variantRows] = await connection.execute(
                `SELECT pv.id, pv.original_price, pv.discounted_price, p.name as product_name, pv.color, pv.size,
                        (SELECT SUM(inv.quantity) FROM Inventory inv WHERE inv.product_variant_id = pv.id) as stock
                 FROM ProductVariants pv
                 JOIN Products p ON pv.product_id = p.id
                 WHERE pv.id = ? FOR UPDATE`, // Lock row để tránh race condition khi check tồn kho
                [item.productVariantId]
            );
            if (variantRows.length === 0) {
                await connection.rollback();
                throw new AppError(`Product variant with ID ${item.productVariantId} not found`, 404);
            }

            const variant = variantRows[0];
            const availableStock = variant.stock === null ? 0 : variant.stock;
            if (availableStock < item.quantity) {
                await connection.rollback();
                throw new AppError(`Not enough stock for ${variant.product_name} (${variant.color || 'N/A'}/${variant.size || 'N/A'}). Available: ${availableStock}, Requested: ${item.quantity}`, 400);
            }

            const unitPrice = variant.discounted_price || variant.original_price;
            const itemTotalPrice = unitPrice * item.quantity;
            subtotalAmount += itemTotalPrice;

            orderItemsData.push({
                product_variant_id: variant.id,
                quantity: item.quantity,
                unit_price: unitPrice,
                item_total_price: itemTotalPrice,
                product_name_snapshot: variant.product_name,
                product_variant_snapshot: `${variant.color || 'N/A'} - ${variant.size || 'N/A'}`
            });
        }

        let totalDiscountFromVouchers = 0;


        const shippingFee = subtotalAmount > 500000 ? 0 : 25000; // Ví dụ
        const totalAmount = subtotalAmount + shippingFee - totalDiscountFromVouchers;

        const initialOrderStatus = paymentMethod === 'cod' ? 'pending_confirmation' : 'pending_payment';
        const [orderResult] = await connection.execute(
            `INSERT INTO Orders (user_id, shipping_address_id, billing_address_id, order_date, status,
                                subtotal_amount, shipping_fee, discount_amount, total_amount, payment_method, notes)
             VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
            [userId, shippingAddressId, finalBillingAddressId, initialOrderStatus,
                subtotalAmount, shippingFee, totalDiscountFromVouchers, totalAmount, paymentMethod, notes]
        );
        const orderId = orderResult.insertId;

        for (const itemData of orderItemsData) {
            await connection.execute(
                `INSERT INTO OrderItems (order_id, product_variant_id, quantity, unit_price, item_total_price,
                                         product_name_snapshot, product_variant_snapshot)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [orderId, itemData.product_variant_id, itemData.quantity, itemData.unit_price, itemData.item_total_price,
                    itemData.product_name_snapshot, itemData.product_variant_snapshot]
            );
        }

        const orderForPayment = { id: orderId, total_amount: totalAmount, payment_method: paymentMethod };
        const paymentResult = await processPayment(orderForPayment, paymentDetails);

        let finalOrderStatus = initialOrderStatus;
        if (!paymentResult.success) {
            await connection.execute('UPDATE Orders SET status = ? WHERE id = ?', ['failed', orderId]);
            await connection.commit();
            return next(new AppError(`Payment failed: ${paymentResult.message || 'Unknown error'}`, 402));
        }

        if (paymentResult.transactionId) {
            await connection.execute('UPDATE Orders SET payment_transaction_id = ? WHERE id = ?', [paymentResult.transactionId, orderId]);
        }
        finalOrderStatus = (paymentMethod === 'cod') ? 'pending_confirmation' : 'processing';
        await connection.execute('UPDATE Orders SET status = ? WHERE id = ?', [finalOrderStatus, orderId]);

        for (const itemData of orderItemsData) {
            const [updateInvResult] = await connection.execute(
                'UPDATE Inventory SET quantity = quantity - ? WHERE product_variant_id = ? AND quantity >= ?',
                [itemData.quantity, itemData.product_variant_id, itemData.quantity]
            );
            if (updateInvResult.affectedRows === 0) {
                // Điều này xảy ra nếu quantity không đủ sau khi đã lock (race condition hiếm nhưng có thể)
                await connection.rollback();
                throw new AppError(`Failed to update stock for variant ${itemData.product_variant_id} due to insufficient quantity on update. Please try again.`, 409); // 409 Conflict
            }
        }

        await connection.commit();

        const orderDetailsForEmail = {
            customerName: user.name, // Lấy tên user
            orderId: orderId,        // ID đơn hàng
            items: orderItemsData.map(item => ({ // Chuyển đổi items 
                product_name_snapshot: item.product_name_snapshot,
                product_variant_snapshot: item.product_variant_snapshot,
                quantity: item.quantity,
                unit_price: parseFloat(item.unit_price).toFixed(2), // Định dạng số
                item_total_price: parseFloat(item.item_total_price).toFixed(2)
            })),
            subtotal_amount: parseFloat(subtotalAmount).toFixed(2),
            shipping_fee: parseFloat(shippingFee).toFixed(2),
            discount_amount: parseFloat(totalDiscountFromVouchers).toFixed(2),
            total_amount: parseFloat(totalAmount).toFixed(2)
        };

        // Gọi hàm gửi email
        sendOrderConfirmationEmail(orderId, user.email, orderDetailsForEmail)
            .then(emailResult => {
                if (emailResult.success) {
                    console.log(`Order confirmation email dispatch initiated for order ${orderId}. Message ID: ${emailResult.messageId}`);
                } else {
                    console.error(`Failed to initiate order confirmation email for order ${orderId}: ${emailResult.error}`);
                }
            })
            .catch(err => { // Bắt lỗi từ chính promise của sendOrderConfirmationEmail 
                console.error(`Critical error in dispatching email for order ${orderId}:`, err);
            });

        res.status(201).json({
            status: 'success',
            message: 'Order created successfully. Confirmation email is being sent.',
            data: {
                orderId: orderId,
                status: finalOrderStatus,
                totalAmount: parseFloat(totalAmount).toFixed(2),
                paymentTransactionId: paymentResult.transactionId
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();
        return next(error);
    } finally {
        if (connection) connection.release();
    }
});

exports.getOrderById = asyncWrapper(async (req, res, next) => {
    const { orderId } = req.params;
    if (!orderId || isNaN(parseInt(orderId))) {
        return next(new AppError('Valid Order ID is required.', 400));
    }
    let localConnection;
    try {
        localConnection = await dbPool.getConnection();

        const sqlQuery = 'SELECT * FROM Orders WHERE id = ?';
        const queryParams = [parseInt(orderId)];

        const [orderRows] = await localConnection.execute(sqlQuery, queryParams);

        if (orderRows.length === 0) {
            return next(new AppError('Order not found', 404));
        }
        const [itemRows] = await localConnection.execute(
            'SELECT * FROM OrderItems WHERE order_id = ?',
            [parseInt(orderId)]
        );

        res.status(200).json({
            status: 'success',
            data: {
                order: orderRows[0],
                items: itemRows
            }
        });
    } catch (error) {
        return next(error);
    } finally {
        if (localConnection) localConnection.release();
    }
});
