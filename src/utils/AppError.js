// src/utils/AppError.js
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Để phân biệt lỗi do người dùng/hệ thống và lỗi code

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;