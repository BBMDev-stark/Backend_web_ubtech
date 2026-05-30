// middleware/auth.middleware.js
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

// ── Bảo vệ route — kiểm tra JWT ──────────────────────
const protect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Ban chua dang nhap. Vui long dang nhap de tiep tuc.',
        code: 'NO_TOKEN',
      });
    }

    const decoded = verifyAccessToken(token);

    // FIX B-16: Bỏ .lean() để giữ nguyên Mongoose document instance
    // Nếu code sau cần gọi user.comparePassword() hoặc user.toPublicJSON() sẽ hoạt động đúng
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: 'Tai khoan khong ton tai.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tai khoan cua ban da bi vo hieu hoa. Lien he admin de duoc ho tro.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    req.user = user;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Phien dang nhap da het han. Vui long dang nhap lai.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token khong hop le.',
      code: 'INVALID_TOKEN',
    });
  }
};

// ── Kiểm tra quyền (role) ─────────────────────────────
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Khong co quyen. Yeu cau role: ${roles.join(', ')}`,
      code: 'INSUFFICIENT_ROLE',
    });
  }
  next();
};

// ── Optional auth (không bắt buộc đăng nhập) ─────────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token   = authHeader.slice(7);
    const decoded = verifyAccessToken(token);
    // FIX B-16: Bỏ .lean() để giữ Mongoose instance methods
    const user    = await User.findById(decoded.id).select('-password -refreshToken');

    if (user && !user.isDeleted && user.isActive) req.user = user;
    next();
  } catch {
    // Lỗi token → tiếp tục như guest
    next();
  }
};

module.exports = { protect, restrictTo, optionalAuth };
