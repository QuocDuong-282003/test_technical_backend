
const dbPool = require('../config/db');
const asyncWrapper = require('../middlewares/asyncWrapper');
const AppError = require('../utils/AppError');


exports.getProducts = asyncWrapper(async (req, res, next) => {
    const { categoryId, q, brand, minPrice, maxPrice, color, size, sortBy, page = 1, limit = 10 } = req.query;

    let baseQuery = `
        SELECT
            p.id, p.name, p.description, p.brand,
            c.name as category_name,
            pv.id as variant_id, pv.sku, pv.color, pv.size, pv.original_price, pv.discounted_price, pv.image_url as variant_image_url,
            (SELECT SUM(inv.quantity) FROM Inventory inv WHERE inv.product_variant_id = pv.id) as total_stock
        FROM Products p
        JOIN ProductVariants pv ON p.id = pv.product_id
        LEFT JOIN Categories c ON p.category_id = c.id
    `;
    // COUNT query để phân trang
    let countQuery = `
        SELECT COUNT(DISTINCT p.id) as totalItems
        FROM Products p
        JOIN ProductVariants pv ON p.id = pv.product_id
        LEFT JOIN Categories c ON p.category_id = c.id
    `;


    const conditions = [];
    const params = [];
    const countParams = [];

    if (categoryId) {
        conditions.push('p.category_id = ?');
        params.push(categoryId);
        countParams.push(categoryId);
    }

    if (q) { // Full-text search
        // Đảm bảo bảng Products có FULLTEXT INDEX trên name, description
        conditions.push('MATCH(p.name, p.description) AGAINST(? IN NATURAL LANGUAGE MODE)');
        params.push(q);
        countParams.push(q);
    }

    if (brand) {
        conditions.push('p.brand LIKE ?');
        params.push(`%${brand}%`);
        countParams.push(`%${brand}%`);
    }
    if (minPrice) {
        conditions.push('(pv.discounted_price >= ? OR (pv.discounted_price IS NULL AND pv.original_price >= ?))');
        params.push(parseFloat(minPrice), parseFloat(minPrice));
        countParams.push(parseFloat(minPrice), parseFloat(minPrice));
    }
    if (maxPrice) {
        conditions.push('(pv.discounted_price <= ? OR (pv.discounted_price IS NULL AND pv.original_price <= ?))');
        params.push(parseFloat(maxPrice), parseFloat(maxPrice));
        countParams.push(parseFloat(maxPrice), parseFloat(maxPrice));
    }
    if (color) {
        conditions.push('pv.color = ?');
        params.push(color);
        countParams.push(color);
    }
    if (size) {
        conditions.push('pv.size = ?');
        params.push(size);
        countParams.push(size);
    }

    if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ');
        countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Sorting
    let orderByClause = ' ORDER BY p.created_at DESC, pv.id ASC'; // Default sort
    if (sortBy) {
        if (sortBy === 'price_asc') orderByClause = ' ORDER BY COALESCE(pv.discounted_price, pv.original_price) ASC, pv.id ASC';
        else if (sortBy === 'price_desc') orderByClause = ' ORDER BY COALESCE(pv.discounted_price, pv.original_price) DESC, pv.id ASC';
        else if (sortBy === 'name_asc') orderByClause = ' ORDER BY p.name ASC, pv.id ASC';
        // Thêm 'relevance' nếu có 'q'
    }
    baseQuery += orderByClause;

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    baseQuery += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    // Execute count query
    const [countRows] = await dbPool.execute(countQuery, countParams);
    const totalItems = countRows[0].totalItems;
    const totalPages = Math.ceil(totalItems / limitNum);

    // Execute data query
    const [rows] = await dbPool.execute(baseQuery, params);

    res.status(200).json({
        status: 'success',
        results: rows.length,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems,
            itemsPerPage: limitNum
        },
        data: {
            products: rows,
        },
    });
});

// Lấy chi tiết một sản phẩm (bao gồm các variants)
exports.getProductById = asyncWrapper(async (req, res, next) => {
    const { productId } = req.params;

    const [productInfo] = await dbPool.execute(
        `SELECT p.id, p.name, p.description, p.brand, c.name as category_name
         FROM Products p
         LEFT JOIN Categories c ON p.category_id = c.id
         WHERE p.id = ?`, [productId]
    );

    if (productInfo.length === 0) {
        return next(new AppError('Product not found', 404));
    }

    const [variants] = await dbPool.execute(
        `SELECT pv.id as variant_id, pv.sku, pv.color, pv.size, pv.original_price, pv.discounted_price, pv.image_url,
        (SELECT SUM(inv.quantity) FROM Inventory inv WHERE inv.product_variant_id = pv.id) as stock
        FROM ProductVariants pv
        WHERE pv.product_id = ?
        ORDER BY pv.id ASC`, [productId]
    );

    res.status(200).json({
        status: 'success',
        data: {
            product: productInfo[0],
            variants: variants
        }
    });
});