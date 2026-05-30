// routes/review.route.js
const express = require('express');
const router  = express.Router();

const {
  createReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  markHelpful,
  updateReviewStatus,
} = require('../controllers/review.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// ──────────────────────────────────────────────────────────
//  ROUTE                          METHOD  MÔ TẢ           QUYỀN
// ──────────────────────────────────────────────────────────
//  /                              POST    Viết đánh giá   Customer
//  /my                            GET     Review của tôi  Customer
//  /product/:productId            GET     Review SP       Tất cả
//  /admin/:reviewId/status        PUT     Duyệt/từ chối   Admin
//  /:reviewId                     PUT     Sửa đánh giá    Customer
//  /:reviewId                     DELETE  Xóa đánh giá    Customer
//  /:reviewId/helpful             POST    Đánh dấu hữu ích Tất cả
// ──────────────────────────────────────────────────────────

// Public (không cần login)
router.get('/product/:productId', getProductReviews);

// FIX B-02: markHelpful yêu cầu đăng nhập để chống spam
router.post('/:reviewId/helpful', protect, markHelpful);

// ⚠️ Admin route phải đặt TRƯỚC router.use(protect) và TRƯỚC /:reviewId
router.put('/admin/:reviewId/status', protect, restrictTo('admin'), updateReviewStatus);

// Cần login
router.use(protect);
router.post('/',    createReview);
router.get('/my',   getMyReviews);
router.put('/:reviewId',    updateReview);
router.delete('/:reviewId', deleteReview);

module.exports = router;
