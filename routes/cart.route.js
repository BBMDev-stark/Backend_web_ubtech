// routes/cart.route.js
const express = require('express');
const router  = express.Router();

const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyCoupon,
  removeCoupon,
} = require('../controllers/cart.controller');

const { protect } = require('../middleware/auth.middleware');

// Tất cả route giỏ hàng đều cần đăng nhập
router.use(protect);

// ─────────────────────────────────────────────────────────
//  ROUTE              METHOD   MÔ TẢ
// ─────────────────────────────────────────────────────────
//  /                  GET      Xem giỏ hàng
//  /                  POST     Thêm SP vào giỏ
//  /                  DELETE   Xóa toàn bộ giỏ
//  /coupon            POST     Áp dụng mã giảm giá
//  /coupon            DELETE   Hủy mã giảm giá
//  /:itemId           PUT      Cập nhật số lượng 1 item
//  /:itemId           DELETE   Xóa 1 item khỏi giỏ
// ─────────────────────────────────────────────────────────

// ⚠️ Route cụ thể (coupon) phải đặt TRƯỚC route có param (:itemId)
router.get('/',              getCart);
router.post('/',             addToCart);
router.delete('/',           clearCart);
router.post('/coupon',       applyCoupon);
router.delete('/coupon',     removeCoupon);
router.put('/:itemId',       updateCartItem);
router.delete('/:itemId',    removeCartItem);

module.exports = router;
