// src/routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

// Lấy tất cả sản phẩm, hoặc lọc theo query (categoryId, q, brand, price, color, size)
router.get('/', productController.getProducts);

// Lấy chi tiết 1 sản phẩm theo ID
router.get('/:productId', productController.getProductById);

module.exports = router;
