// src/config/db.js
const mysql = require('mysql2/promise'); // Sử dụng promise-based API
require('dotenv').config({ path: '../../.env' }); // Đảm bảo .env được đọc đúng cách

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// Kiểm tra kết nối (tùy chọn)
pool.getConnection()
    .then(connection => {
        console.log('MySQL Connected successfully!');
        connection.release(); // Trả connection về pool
    })
    .catch(err => {
        console.error('Failed to connect to MySQL:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Database connection was closed.');
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error('Database has too many connections.');
        }
        if (err.code === 'ECONNREFUSED') {
            console.error('Database connection was refused.');
        }
        // process.exit(1); // Thoát nếu không kết nối được DB
    });

module.exports = pool;