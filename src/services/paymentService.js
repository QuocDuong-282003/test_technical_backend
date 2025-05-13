
async function processPayment(orderDetails, paymentDetails) {
    console.log(`Processing payment for order ${orderDetails.id} with method ${orderDetails.payment_method}...`);
    // Giả lập xử lý thanh toán

    if (orderDetails.payment_method === 'credit_card' && paymentDetails) {
        // Giả lập kiểm tra thông tin thẻ
        if (paymentDetails.cardNumber && paymentDetails.cardNumber.endsWith('1111')) { // Thẻ test thành công
            console.log("Credit card payment successful (mock). Transaction ID: MOCK_TRANS_123");
            return { success: true, transactionId: 'MOCK_TRANS_123' };
        } else {
            console.log("Credit card payment failed (mock). Invalid card.");
            return { success: false, message: "Invalid card details (mock)" };
        }
    } else if (orderDetails.payment_method === 'cod') {
        console.log("Payment method is COD. No online processing needed.");
        return { success: true, transactionId: null }; // COD không có transaction ID online
    }
    // Các phương thức khác...
    console.log("Payment processing complete (mock).");
    return { success: true, transactionId: `MOCK_TRANS_${Date.now()}` };
}
module.exports = { processPayment };