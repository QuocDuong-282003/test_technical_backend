// src/app.js
const express = require('express');
const cors = require('cors');
const mainRouter = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const AppError = require('./utils/AppError');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', mainRouter);

// Handle 404 Not Found
app.all('/', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;