// controllers/review.controller.js
const Review  = require('../models/Review');
const Order   = require('../models/Order');
const Product = require('../models/Product');

// ════════════════════════════════════════════════════
// VIẾT ĐÁNH GIÁ SẢN PHẨM
// POST /api/reviews
// Body: { productId, rating, title?, content?, orderCode? }
// ════════════════════════════════════════════════════
const createReview = async (req, res) => {
  try {
    const { productId, rating, title = '', content = '', orderCode } = req.body;

    // Validate
    if (!productId || !rating) {
      return res.status(400).json({ success: false, message: 'Thiếu productId hoặc rating' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating phải từ 1 đến 5 sao' });
    }

    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' });
    }

    // Kiểm tra đã review chưa
    const existing = await Review.findOne({ product: productId, user: req.user._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá sản phẩm này rồi. Chỉ được đánh giá 1 lần.',
      });
    }

    // Kiểm tra đã mua hàng chưa (nếu truyền orderCode)
    let isVerifiedPurchase = false;
    let orderId = null;

    if (orderCode) {
      const order = await Order.findOne({
        orderCode,
        user:   req.user._id,
        status: 'delivered',
        'items.product': productId,
      });
      if (order) {
        isVerifiedPurchase = true;
        orderId = order._id;
      }
    } else {
      // Tự động kiểm tra xem user có đơn delivered chứa SP này không
      const order = await Order.findOne({
        user:   req.user._id,
        status: 'delivered',
        'items.product': productId,
      });
      if (order) {
        isVerifiedPurchase = true;
        orderId = order._id;
      }
    }

    const review = await Review.create({
      product:            productId,
      user:               req.user._id,
      order:              orderId,
      rating:             Number(rating),
      title,
      content,
      isVerifiedPurchase,
      status:             'approved',
    });

    // Populate user info để trả về
    await review.populate('user', 'name avatar');

    res.status(201).json({
      success: true,
      message: isVerifiedPurchase
        ? 'Cam on ban da danh gia! (Da xac nhan mua hang)'
        : 'Cam on ban da danh gia!',
      data: review,
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Bạn đã đánh giá sản phẩm này rồi.' });
    }
    console.error('createReview error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// LẤY DANH SÁCH ĐÁNH GIÁ CỦA 1 SẢN PHẨM
// GET /api/reviews/product/:productId
// Query: ?page=1&limit=10&rating=5&sort=newest
// ════════════════════════════════════════════════════
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, rating, sort = 'newest' } = req.query;

    const filter = {
      product:   productId,
      status:    'approved',
      isDeleted: false,
    };
    if (rating) filter.rating = Number(rating);

    const sortMap = {
      newest:  { createdAt: -1 },
      oldest:  { createdAt: 1 },
      highest: { rating: -1 },
      lowest:  { rating: 1 },
      helpful: { helpfulCount: -1 },
    };
    const sortOption = sortMap[sort] || { createdAt: -1 };

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(50, Number(limit));

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name avatar')
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(filter),
    ]);

    // Tính thống kê rating (1-5 sao mỗi loại bao nhiêu)
    const ratingStats = await Review.aggregate([
      { $match: { product: new (require('mongoose').Types.ObjectId)(productId), status: 'approved', isDeleted: false } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    // Format thống kê thành object { 5: 10, 4: 5, 3: 2, 2: 0, 1: 1 }
    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingStats.forEach(s => { ratingBreakdown[s._id] = s.count; });

    // Lấy ratingAvg từ Product
    const product = await Product.findById(productId).select('ratingAvg ratingCount').lean();

    res.json({
      success: true,
      data:    reviews,
      stats: {
        avg:       product?.ratingAvg   || 0,
        total:     product?.ratingCount || 0,
        breakdown: ratingBreakdown,
      },
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (err) {
    console.error('getProductReviews error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// XEM ĐÁNH GIÁ CỦA TÔI
// GET /api/reviews/my
// ════════════════════════════════════════════════════
const getMyReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(50, Number(limit));

    const [reviews, total] = await Promise.all([
      Review.find({ user: req.user._id, isDeleted: false })
        .populate('product', 'name slug images basePrice')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Review.countDocuments({ user: req.user._id, isDeleted: false }),
    ]);

    res.json({
      success: true,
      data: reviews,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });

  } catch (err) {
    console.error('getMyReviews error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// CHỈNH SỬA ĐÁNH GIÁ
// PUT /api/reviews/:reviewId
// Body: { rating?, title?, content? }
// ════════════════════════════════════════════════════
const updateReview = async (req, res) => {
  try {
    const { rating, title, content } = req.body;

    const review = await Review.findOne({
      _id:       req.params.reviewId,
      user:      req.user._id,   // chỉ sửa review của mình
      isDeleted: false,
    });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating phải từ 1 đến 5' });
      }
      review.rating = Number(rating);
    }
    if (title   !== undefined) review.title   = title;
    if (content !== undefined) review.content = content;

    await review.save(); // post-save hook sẽ tự cập nhật ratingAvg

    res.json({ success: true, message: 'Đã cập nhật đánh giá', data: review });

  } catch (err) {
    console.error('updateReview error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// XÓA ĐÁNH GIÁ
// DELETE /api/reviews/:reviewId
// ════════════════════════════════════════════════════
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findOne({
      _id:       req.params.reviewId,
      user:      req.user._id,
      isDeleted: false,
    });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    review.isDeleted = true;
    await review.save();

    res.json({ success: true, message: 'Đã xóa đánh giá' });

  } catch (err) {
    console.error('deleteReview error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// ĐÁNH DẤU ĐÁNH GIÁ HỮU ÍCH
// POST /api/reviews/:reviewId/helpful
// Yêu cầu đăng nhập; mỗi user chỉ vote 1 lần
// ════════════════════════════════════════════════════
const markHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    // FIX B-02: Kiểm tra user đã vote chưa
    const userId = req.user._id;
    const alreadyVoted = review.helpfulBy.some(id => id.toString() === userId.toString());

    if (alreadyVoted) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh dấu hữu ích rồi',
        helpfulCount: review.helpfulCount,
      });
    }

    // Dùng $addToSet để đảm bảo atomic, tránh race condition
    const updated = await Review.findByIdAndUpdate(
      req.params.reviewId,
      {
        $addToSet: { helpfulBy: userId },
        $inc:      { helpfulCount: 1 },
      },
      { new: true }
    );

    res.json({ success: true, message: 'Cảm ơn phản hồi!', helpfulCount: updated.helpfulCount });

  } catch (err) {
    console.error('markHelpful error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] DUYỆT / TỪ CHỐI ĐÁNH GIÁ
// PUT /api/reviews/admin/:reviewId/status
// Body: { status: 'approved' | 'rejected' }
// ════════════════════════════════════════════════════
const updateReviewStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status phải là approved hoặc rejected' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.reviewId,
      { status },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    res.json({ success: true, message: `Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} đánh giá`, data: review });

  } catch (err) {
    console.error('updateReviewStatus error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  markHelpful,
  updateReviewStatus,
};
