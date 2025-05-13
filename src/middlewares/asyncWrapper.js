// src/middlewares/asyncWrapper.js
// Giúp không cần viết try...catch trong mỗi async controller
const asyncWrapper = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next); // Lỗi sẽ được chuyển tới global error handler
    };
};

module.exports = asyncWrapper;