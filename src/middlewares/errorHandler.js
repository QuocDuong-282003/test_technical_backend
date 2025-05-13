
const AppError = require('../utils/AppError');

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};

const sendErrorProd = (err, res) => {
    // Lỗi opérationnel, lỗi đã biết: gửi thông điệp cho client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });

    } else {

        console.error('ERROR ', err);

        res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!',
        });
    }
};

const handleDuplicateFieldsDB = (err) => {
    const value = err.sqlMessage.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {

    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};


const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else if (process.env.NODE_ENV === 'production') {
        let error = { ...err, message: err.message, name: err.name, code: err.code, sqlMessage: err.sqlMessage };

        if (error.code === 'ER_DUP_ENTRY') error = handleDuplicateFieldsDB(error);


        sendErrorProd(error, res);
    }
};

module.exports = { errorHandler };