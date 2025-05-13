// src/routes/categoryRoutes.js
const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.get('/', categoryController.getAllCategories);
// Dòng này có thể là vấn đề nếu categoryController.getSubCategories không tồn tại
// hoặc nếu bạn không có ý định dùng route này nhưng nó được định nghĩa không đúng cách
router.get('/:categoryId', categoryController.getSubCategories); // Tùy chọn

module.exports = router;