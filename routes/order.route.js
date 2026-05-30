// routes/order.route.js
const express = require('express');
const router  = express.Router();

const {
  createOrder,
  getMyOrders,
  getOrderDetail,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
} = require('../controllers/order.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// Tất cả route đơn hàng đều cần đăng nhập
router.use(protect);

// ─────────────────────────────────────────────────────────────────
//  ROUTE                        METHOD  MÔ TẢ              QUYỀN
// ─────────────────────────────────────────────────────────────────
//  /                            POST    Đặt hàng           Customer
//  /                            GET     Lịch sử đơn tôi    Customer
//  /admin/all                   GET     Tất cả đơn hàng    Admin
//  /admin/:orderId/status       PUT     Cập nhật trạng thái Admin
//  /:orderCode                  GET     Chi tiết đơn        Customer
//  /:orderCode/cancel           PUT     Hủy đơn            Customer
// ─────────────────────────────────────────────────────────────────

// ⚠️ Route admin và cancel phải đặt TRƯỚC /:orderCode
router.get('/admin/all',                restrictTo('admin'), getAllOrders);
router.put('/admin/:orderId/status',    restrictTo('admin'), updateOrderStatus);

router.post('/',                        createOrder);
router.get('/',                         getMyOrders);
// ⚠️ /:orderCode/cancel PHẢI đặt TRƯỚC /:orderCode để Express match đúng
router.put('/:orderCode/cancel',        cancelOrder);
router.get('/:orderCode',               getOrderDetail);

module.exports = router;
