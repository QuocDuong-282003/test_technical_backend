// server.js
require('dotenv').config(); // Nạp biến môi trường từ .env đầu tiên

const app = require('./src/app'); // Đảm bảo app.js nằm trong src/

const PORT = process.env.PORT || 3030;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});