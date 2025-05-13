
DROP TABLE IF EXISTS UserVoucherUsages;
DROP TABLE IF EXISTS AppliedVouchers;
DROP TABLE IF EXISTS Vouchers;
DROP TABLE IF EXISTS OrderItems;
DROP TABLE IF EXISTS Orders;
DROP TABLE IF EXISTS Inventory;
DROP TABLE IF EXISTS Stores;
DROP TABLE IF EXISTS ProductVariants;
DROP TABLE IF EXISTS Products;
DROP TABLE IF EXISTS Addresses;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Categories;


CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email)
);

CREATE TABLE IF NOT EXISTS Addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    commune VARCHAR(100) NOT NULL,
    street_address VARCHAR(255) NOT NULL,
    type ENUM('nhà riêng', 'công ty') DEFAULT 'nhà riêng',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    INDEX idx_address_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS Categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    parent_id INT NULL,
    image_url VARCHAR(2048),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES Categories(id) ON DELETE SET NULL,
    INDEX idx_category_name (name)
);

CREATE TABLE IF NOT EXISTS Products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    brand VARCHAR(100),
    model VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES Categories(id) ON DELETE SET NULL,
    INDEX idx_product_name (name),
    FULLTEXT INDEX ft_product_name_desc (name, description)
);

CREATE TABLE IF NOT EXISTS ProductVariants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    sku VARCHAR(100) UNIQUE,
    color VARCHAR(50),
    size VARCHAR(50),
    original_price DECIMAL(10, 2) NOT NULL,
    discounted_price DECIMAL(10, 2),
    image_url VARCHAR(2048),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE,
    INDEX idx_variant_product_id (product_id),
    INDEX idx_variant_sku (sku)
);

CREATE TABLE IF NOT EXISTS Stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT NOT NULL,
    store_id INT NULL,
    quantity INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_variant_store (product_variant_id, store_id),
    FOREIGN KEY (product_variant_id) REFERENCES ProductVariants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES Stores(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    shipping_address_id INT NOT NULL,
    billing_address_id INT,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending_payment', 'pending_confirmation', 'processing', 'shipped', 'delivered', 'cancelled', 'failed') DEFAULT 'pending_payment',
    subtotal_amount DECIMAL(12, 2) NOT NULL,
    shipping_fee DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_transaction_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE RESTRICT,
    FOREIGN KEY (shipping_address_id) REFERENCES Addresses(id) ON DELETE RESTRICT,
    FOREIGN KEY (billing_address_id) REFERENCES Addresses(id) ON DELETE RESTRICT,
    INDEX idx_order_user_id (user_id),
    INDEX idx_order_date (order_date),
    INDEX idx_order_status (status)
);

CREATE TABLE IF NOT EXISTS OrderItems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_variant_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    item_total_price DECIMAL(12, 2) NOT NULL,
    product_name_snapshot VARCHAR(255),
    product_variant_snapshot VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_variant_id) REFERENCES ProductVariants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type ENUM('percentage', 'fixed_amount') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    max_discount_amount DECIMAL(10,2) NULL,
    min_order_value DECIMAL(10, 2) DEFAULT 0.00,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    usage_limit INT,
    per_user_limit INT DEFAULT 1,
    current_usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_voucher_code (code),
    INDEX idx_voucher_active_dates (is_active, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS AppliedVouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    voucher_id INT NOT NULL,
    discount_applied DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_order_voucher (order_id, voucher_id),
    FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
    FOREIGN KEY (voucher_id) REFERENCES Vouchers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS UserVoucherUsages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    voucher_id INT NOT NULL,
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (voucher_id) REFERENCES Vouchers(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_voucher_usage (user_id, voucher_id)
);

-- Dữ liệu mẫu
INSERT INTO Users (id, name, email, phone, password_hash) VALUES
(1, 'Test User', 'test@example.com', '0123456789', 'hashed_password'),
(2, 'assessment', 'gu@gmail.com', '328355333', 'hashed_password_assessment');

INSERT INTO Addresses (user_id, province, district, commune, street_address, type, is_default) VALUES
(2, 'Bắc Kạn', 'Ba Bể', 'Phúc Lộc', '73 tân hoà 2', 'nhà riêng', TRUE);

INSERT INTO Categories (id, name, description) VALUES
(1, 'Giày Sneakers', 'Các loại giày thể thao thời trang'),
(2, 'Áo Thun', 'Áo thun nam nữ các loại'),
(3, 'Phụ Kiện', 'Nón, vớ các loại');

INSERT INTO Products (id, category_id, name, brand, description) VALUES
(1, 1, 'KAPPA Women''s Sneakers', 'KAPPA', 'Giày sneaker nữ thời trang Kappa'),
(2, 1, 'KAPPA Men''s Sneakers', 'KAPPA', 'Giày sneaker nam thời trang Kappa'),
(3, 2, 'Basic Cotton T-Shirt', 'NoBrand', 'Áo thun cotton cơ bản');


INSERT INTO ProductVariants 
(id, product_id, sku, color, size, original_price, discounted_price, image_url) VALUES
(1, 1, 'KPW-SNK-YLW-36', 'yellow', '36', 1799000.00, 980000.00, 'img/product/ult1.jpg'),
(2, 1, 'KPW-SNK-BLK-37', 'black', '37', 1799000.00, 988000.00, 'img/product/nikestrike1.jpg'),
(3, 2, 'KPM-SNK-RED-40', 'red', '40', 1699000.00, 988000.00, 'img/product/nikestrike2.jpg'),
(4, 3, 'TSH-COT-WHT-M', 'white', 'M', 250000.00, NULL, 'img/product/nikestrike3.jpg');


INSERT INTO Inventory (product_variant_id, quantity) VALUES
(1, 10),
(2, 5),
(3, 8),
(4, 20);

INSERT INTO Vouchers (code, description, discount_type, discount_value, start_date, end_date, is_active, min_order_value, max_discount_amount) VALUES
('SUMMER10', 'Giảm 10% cho mùa hè', 'percentage', 10.00, '2024-01-01 00:00:00', '2024-12-31 23:59:59', TRUE, 500000, 100000),
('FREESHIP', 'Miễn phí vận chuyển', 'fixed_amount', 25000.00, '2024-01-01 00:00:00', '2024-12-31 23:59:59', TRUE, 300000, NULL);

-- Thêm một đơn hàng mẫu cũ để test churn rate
INSERT INTO Orders (user_id, shipping_address_id, order_date, status, subtotal_amount, shipping_fee, discount_amount, total_amount, payment_method)
VALUES (
    1, -- Test User
    (SELECT id FROM Addresses WHERE user_id = 2 LIMIT 1), 
    DATE_SUB(CURDATE(), INTERVAL 7 MONTH), -- Đơn hàng 7 tháng trước
    'delivered',
    250000.00,
    25000.00,
    0.00,
    275000.00,
    'cod'
);
INSERT INTO OrderItems(order_id, product_variant_id, quantity, unit_price, item_total_price) VALUES
(LAST_INSERT_ID(), 4, 1, 250000.00, 250000.00);