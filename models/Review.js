// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

  rating:  { type: Number, required: [true, 'Điểm đánh giá là bắt buộc'], min: 1, max: 5 },
  title:   { type: String, maxlength: 100, default: '' },
  content: { type: String, maxlength: 1000, default: '' },
  images:  [{ type: String }],

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved', // tự approve để test dễ, production đổi thành 'pending'
  },
  isVerifiedPurchase: { type: Boolean, default: false },
  helpfulCount:       { type: Number, default: 0 },
  // FIX B-02: lưu danh sách user đã vote helpful để tránh spam
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: [],
  }],
  isDeleted:          { type: Boolean, default: false },
}, { timestamps: true });

// ── Sau khi lưu review → tự cập nhật ratingAvg trên Product ──
reviewSchema.post('save', async function () {
  const Product = require('./Product');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { product: this.product, status: 'approved', isDeleted: false } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (stats.length > 0) {
    await Product.findByIdAndUpdate(this.product, {
      ratingAvg:   Math.round(stats[0].avg * 10) / 10,
      ratingCount: stats[0].count,
    });
  }
});

// Mỗi user chỉ review 1 lần / sản phẩm
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: 1 });

module.exports = mongoose.model('Review', reviewSchema);
