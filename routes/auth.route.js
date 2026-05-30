// routes/auth.route.js
const express = require('express');
const router  = express.Router();

const { register, login, logout, refreshToken, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// ─────────────────────────────────────────────────────
//  ROUTE          METHOD   MÔ TẢ              CẦN LOGIN?
// ─────────────────────────────────────────────────────
//  /register      POST     Đăng ký            Không
//  /login         POST     Đăng nhập          Không
//  /refresh-token POST     Làm mới token      Không (dùng cookie)
//  /logout        POST     Đăng xuất          Có 
//  /me            GET      Xem thông tin tôi  Có 
// ─────────────────────────────────────────────────────

router.post('/register',      register);
router.post('/login',         login);
router.post('/refresh-token', refreshToken);
router.post('/logout',        protect, logout);   // phải đăng nhập mới logout được
router.get('/me',             protect, getMe);    // phải đăng nhập mới xem được

module.exports = router;
