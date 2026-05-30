// routes/user.route.js
const express = require('express');
const router  = express.Router();

const {
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAllUsers,
  toggleUserActive,
} = require('../controllers/user.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// Tất cả route đều cần đăng nhập
router.use(protect);

// ──────────────────────────────────────────────────────────────
//  ROUTE                              METHOD  MÔ TẢ
// ──────────────────────────────────────────────────────────────
//  /profile                           GET     Xem profile
//  /profile                           PUT     Cập nhật profile
//  /change-password                   PUT     Đổi mật khẩu
//  /addresses                         GET     Danh sách địa chỉ
//  /addresses                         POST    Thêm địa chỉ
//  /addresses/:id                     PUT     Sửa địa chỉ
//  /addresses/:id                     DELETE  Xóa địa chỉ
//  /addresses/:id/default             PUT     Đặt làm mặc định
//  /admin/all                         GET     Tất cả users (admin)
//  /admin/:userId/toggle-active       PUT     Khóa/mở khóa (admin)
// ──────────────────────────────────────────────────────────────

// ⚠️ Route admin đặt trước để tránh conflict với /:id
router.get('/admin/all',                    restrictTo('admin'), getAllUsers);
router.put('/admin/:userId/toggle-active',  restrictTo('admin'), toggleUserActive);

// Profile
router.get('/profile',         getProfile);
router.put('/profile',         updateProfile);
router.put('/change-password', changePassword);

// Địa chỉ
router.get('/addresses',                    getAddresses);
router.post('/addresses',                   addAddress);
router.put('/addresses/:addressId',         updateAddress);
router.delete('/addresses/:addressId',      deleteAddress);
router.put('/addresses/:addressId/default', setDefaultAddress);

module.exports = router;
