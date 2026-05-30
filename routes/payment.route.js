// routes/payment.route.js
const express = require('express');
const router  = express.Router();

const {
  createPayment,
  vnpayCallback,
  vnpayIPN,
  momoCallback,
  zalopayCallback,
  getPaymentByOrder,
  adminConfirmBankTransfer,
  confirmVietQR,
  getVietQRPaymentStatus,
} = require('../controllers/payment.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// ──────────────────────────────────────────────────────────────────────
//  ROUTE                        METHOD  MÔ TẢ                  AUTH
// ──────────────────────────────────────────────────────────────────────
//  /create                      POST    Tạo link thanh toán      Login
//  /order/:orderId              GET     Lịch sử TT đơn hàng     Login
//  /vnpay/callback              GET     VNPay redirect về        Public
//  /vnpay/ipn                   GET     VNPay server notify      Public
//  /momo/callback               POST    MoMo IPN notify          Public
//  /zalopay/callback            POST    ZaloPay notify           Public
// ──────────────────────────────────────────────────────────────────────

// ⚠️ Callback từ cổng TT KHÔNG được bảo vệ bằng JWT
// (vì cổng TT gọi thẳng vào server, không có token)
// Bảo mật bằng chữ ký (signature) của từng cổng

// Polling VietQR — PUBLIC (orderCode đủ dài để bảo mật, không cần JWT)
router.get('/vietqr/status/:orderCode', getVietQRPaymentStatus);

// Public callbacks
router.get('/vnpay/callback',   vnpayCallback);
router.get('/vnpay/ipn',        vnpayIPN);
router.post('/momo/callback',   momoCallback);
router.post('/zalopay/callback',zalopayCallback);

// Cần đăng nhập
router.use(protect);
router.post('/create',          createPayment);
router.get('/order/:orderId',   getPaymentByOrder);

// FIX B-04: Admin xác nhận chuyển khoản thủ công
router.put('/admin/bank-transfer/:orderId/confirm', restrictTo('admin'), adminConfirmBankTransfer);
// Admin xác nhận VietQR
router.put('/admin/vietqr/:orderId/confirm', restrictTo('admin'), confirmVietQR);


module.exports = router;
