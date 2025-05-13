
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const nodemailer = require('nodemailer');

// Tạo transporter object sử dụng SMTP transport của Gmail
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true', // Chuyển đổi string  thành boolean
    auth: {
        user: process.env.EMAIL_APP_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
    },

});

/**
 * Tạo nội dung HTML cho email xác nhận đơn hàng.
  @param {object} orderDetails - Chi tiết đơn hàng.
  @param {string} orderDetails.customerName - Tên khách hàng .
  @param {string|number} orderDetails.orderId - ID đơn hàng.
  @param {Array<object>} orderDetails.items - Danh sách sản phẩm.
  @param {string} orderDetails.subtotal_amount - Tổng tiền hàng.
  @param {string} orderDetails.shipping_fee - Phí vận chuyển.
  @param {string} orderDetails.discount_amount - Số tiền giảm giá.
  @param {string} orderDetails.total_amount - Tổng tiền cuối cùng.
 */
function buildOrderConfirmationHtml(orderDetails) {
    let itemsHtmlList = '';
    if (orderDetails.items && Array.isArray(orderDetails.items)) {
        orderDetails.items.forEach(item => {
            itemsHtmlList += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">
                    ${item.product_name_snapshot || 'N/A'} (${item.product_variant_snapshot || 'N/A'})</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                    ${item.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">
                    ${parseFloat(item.unit_price).toLocaleString('vi-VN')} đ</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">
                    ${parseFloat(item.item_total_price).toLocaleString('vi-VN')} đ</td>
                </tr>
            `;
        });
    }

    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h3>Xin chào ${orderDetails.customerName || 'Quý khách'}!</h3>
            <p>Cảm ơn bạn đã đặt hàng tại <strong>${process.env.EMAIL_FROM_NAME}</strong>.</p>
            <p>Đơn hàng <strong>#${orderDetails.orderId}</strong> của bạn đã được xác nhận.</p>

            <h4>Chi tiết đơn hàng:</h4>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2;">Sản phẩm</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #f2f2f2;">Số lượng</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right; background-color: #f2f2f2;">Đơn giá</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right; background-color: #f2f2f2;">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtmlList}
                </tbody>
            </table>

            <p style="text-align: right;"><strong>Tổng tiền hàng:</strong> 
            ${parseFloat(orderDetails.subtotal_amount).toLocaleString('vi-VN')} đ</p>
            <p style="text-align: right;"><strong>Phí vận chuyển:</strong> 
            ${parseFloat(orderDetails.shipping_fee).toLocaleString('vi-VN')} đ</p>
            <p style="text-align: right;"><strong>Giảm giá:</strong> 
            ${parseFloat(orderDetails.discount_amount).toLocaleString('vi-VN')} đ</p>
            <h4 style="text-align: right;"><strong>Tổng cộng thanh toán: 
            ${parseFloat(orderDetails.total_amount).toLocaleString('vi-VN')} đ</strong></h4>

            <p>Chúng tôi sẽ xử lý đơn hàng của bạn sớm nhất có thể.</p>
            <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
            <p>Xin chân thành cảm ơn!</p>
            <p>Trân trọng,<br/>Đội ngũ ${process.env.EMAIL_FROM_NAME}</p>
        </div>
    `;
}

/**
 * Gửi email xác nhận đơn hàng.
 * @param {string|number} orderId
 * @param {string} recipientEmail 
 * @param {object} orderDetails 
 */
async function sendOrderConfirmationEmail(orderId, recipientEmail, orderDetails) {
    // Đảm bảo orderDetails có orderId để buildOrderConfirmationHtml có thể dùng
    const fullOrderDetails = { ...orderDetails, orderId, customerName: orderDetails.customerName || recipientEmail.split('@')[0] };
    const htmlContent = buildOrderConfirmationHtml(fullOrderDetails);

    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_SENDER_ADDRESS}>`,
        to: recipientEmail,
        subject: `Xác nhận đơn hàng #${orderId} từ ${process.env.EMAIL_FROM_NAME}`,
        html: htmlContent,

    };

    try {
        console.log(`Attempting to send order confirmation email to ${recipientEmail} for order #${orderId}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log('Order confirmation email sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
    } catch (error) {
        console.error(`Error sending order confirmation email for order #${orderId} to ${recipientEmail}:`, error);

        return { success: false, error: error.message };
    }
}

module.exports = {
    sendOrderConfirmationEmail

};