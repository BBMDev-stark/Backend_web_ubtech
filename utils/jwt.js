// utils/jwt.js – Tạo và xác thực JWT token
const jwt = require('jsonwebtoken');

// ── Tạo Access Token (tồn tại 15 phút) ───────────────
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },                      // payload – dữ liệu trong token
    process.env.JWT_ACCESS_SECRET,             // khóa bí mật
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
};

// ── Tạo Refresh Token (tồn tại 7 ngày) ───────────────
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
};

// ── Xác thực Access Token ─────────────────────────────
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

// ── Xác thực Refresh Token ────────────────────────────
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
