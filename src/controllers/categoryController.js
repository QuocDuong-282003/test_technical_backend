
const dbPool = require('../config/db');
const asyncWrapper = require('../middlewares/asyncWrapper');
const AppError = require('../utils/AppError');
exports.getAllCategories = asyncWrapper(async (req, res, next) => {
    const [rows] = await dbPool.execute(
        'SELECT id, name, image_url, parent_id, description FROM Categories ORDER BY name ASC'
    );
    res.status(200).json({
        status: 'success',
        results: rows.length,
        data: {

            categories: rows,
        },
    });
});

exports.getSubCategories = asyncWrapper(async (req, res, next) => {
    const { categoryId } = req.params;
    if (!categoryId || isNaN(parseInt(categoryId))) { // kiểm tra cơ bản cho categoryId
        return next(new AppError('Valid Category ID is required.', 400));
    }
    const [rows] = await dbPool.execute(
        'SELECT id, name, image_url, description FROM Categories WHERE parent_id = ? ORDER BY name ASC',
        [categoryId]
    );

    // Trả về mảng rỗng nếu không có subcategories, thay vì lỗi 404
    res.status(200).json({
        status: 'success',
        results: rows.length,
        data: {
            subCategories: rows,
        },
    });
});