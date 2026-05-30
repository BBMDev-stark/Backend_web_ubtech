// config/database.js
// Serverless-compatible MongoDB connection với global caching.
// Trong môi trường serverless (Vercel), mỗi request là 1 lambda invocation riêng.
// Nếu không cache connection, mỗi request sẽ mở connection mới → chậm + hết pool.
// Global cache giúp tái sử dụng connection trong cùng 1 container lifecycle.

const mongoose = require('mongoose');

// Cache connection ở global scope để tái sử dụng giữa các invocation
const _cache = global._mongoCache || (global._mongoCache = { conn: null, promise: null });

const connectDB = async () => {
  // Nếu đã có connection đang active → tái sử dụng
  if (_cache.conn && mongoose.connection.readyState === 1) {
    return _cache.conn;
  }

  // Nếu đang trong quá trình connect → đợi promise cũ
  if (!_cache.promise) {
    _cache.promise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Serverless: giảm maxPoolSize để không vượt giới hạn kết nối MongoDB Atlas
      maxPoolSize: process.env.VERCEL ? 5 : 10,
    });
  }

  try {
  _cache.conn = await _cache.promise;

  console.log(`[DB] Connected: ${_cache.conn.connection.host}`);
  console.log(`[DB] Name: ${mongoose.connection.name}`);

  mongoose.connection.on('error', (err) => {
    console.error('[DB] Connection error:', err.message);

    _cache.conn = null;
    _cache.promise = null;
  });

    return _cache.conn;
  } catch (error) {
    // Reset promise để lần sau thử lại
    _cache.promise = null;
    console.error('[DB] Connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;
