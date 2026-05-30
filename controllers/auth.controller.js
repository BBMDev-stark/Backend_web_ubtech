// controllers/auth.controller.js
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');

// ── Helper: gửi refresh token qua HttpOnly Cookie ────
const sendRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 ngày
  });
};

// ── Helper: validate email ────────────────────────────
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ════════════════════════════════════════════════════
// DANG KY — POST /api/auth/register
// Body: { name, email, password, phone? }
// ════════════════════════════════════════════════════
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Vui long dien day du: ten, email, mat khau' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email khong hop le' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mat khau phai co it nhat 6 ky tu' });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Ten phai co it nhat 2 ky tu' });
    }

    // Kiểm tra email tồn tại
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email nay da duoc dang ky. Vui long dung email khac.' });
    }

    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password, phone });

    const accessToken  = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    sendRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Dang ky thanh cong!',
      accessToken,
      user: user.toPublicJSON(),
    });

  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email da ton tai.' });
    }
    console.error('[auth] register error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server, thu lai sau' });
  }
};

// ════════════════════════════════════════════════════
// DANG NHAP — POST /api/auth/login
// Body: { email, password }
// ════════════════════════════════════════════════════
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Vui long nhap email va mat khau' });
    }

    const user = await User.findOne({
      email:     email.toLowerCase().trim(),
      isDeleted: false,
    }).select('+password +refreshToken');

    // Dùng cùng message cho email/password sai để tránh user enumeration
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoac mat khau khong dung' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tai khoan cua ban da bi vo hieu hoa. Lien he admin de duoc ho tro.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoac mat khau khong dung' });
    }

    const accessToken  = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin    = new Date();
    await user.save({ validateBeforeSave: false });

    sendRefreshTokenCookie(res, refreshToken);

    res.json({
      success: true,
      message: `Chao mung tro lai, ${user.name}!`,
      accessToken,
      user: user.toPublicJSON(),
    });

  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server, thu lai sau' });
  }
};

// ════════════════════════════════════════════════════
// LAM MOI ACCESS TOKEN — POST /api/auth/refresh-token
// ════════════════════════════════════════════════════
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Khong tim thay refresh token. Vui long dang nhap lai.',
        code: 'NO_REFRESH_TOKEN',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Phien dang nhap da het han. Vui long dang nhap lai.',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token || user.isDeleted || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token khong hop le. Vui long dang nhap lai.',
        code: 'REFRESH_TOKEN_MISMATCH',
      });
    }

    const newAccessToken  = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    sendRefreshTokenCookie(res, newRefreshToken);

    res.json({ success: true, accessToken: newAccessToken });

  } catch (err) {
    console.error('[auth] refreshToken error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

// ════════════════════════════════════════════════════
// DANG XUAT — POST /api/auth/logout
// ════════════════════════════════════════════════════
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

    res.json({ success: true, message: 'Dang xuat thanh cong!' });

  } catch (err) {
    console.error('[auth] logout error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

// ════════════════════════════════════════════════════
// LAY THONG TIN BAN THAN — GET /api/auth/me
// ════════════════════════════════════════════════════
const getMe = (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { register, login, logout, refreshToken, getMe };
