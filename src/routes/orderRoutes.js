// src/routes/orderRoutes.js
const express = require('express');
const orderController = require('../controllers/orderController');
// const authMiddleware = require('../middlewares/authMiddleware'); // Sẽ cần nếu có xác thực

const router = express.Router();

// router.use(authMiddleware); // Bảo vệ tất cả các route order

router.post('/', orderController.createOrder);
router.get('/:orderId', orderController.getOrderById);
module.exports = router;