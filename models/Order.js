// models/Order.js
const mongoose = require('mongoose');
const crypto   = require('crypto');

const orderItemSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  variantName: { type: String, default: '' },
  name:        { type: String, required: true },   // snapshot tên lúc mua
  image:       { type: String, default: '' },      // snapshot ảnh lúc mua
  sku:         { type: String, default: '' },
  price:       { type: Number, required: true },   // snapshot giá lúc mua
  quantity:    { type: Number, required: true, min: 1 },
  subtotal:    { type: Number, required: true },   // price × quantity
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  note:      { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderCode: { type: String },  // tự sinh: ORD-20260302-xxxx-rr

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  items: {
    type: [orderItemSchema],
    validate: [arr => arr.length > 0, 'Đơn hàng phải có ít nhất 1 sản phẩm'],
  },

  shippingAddress: {
    fullName: { type: String, required: true },
    phone:    { type: String, required: true },
    province: { type: String, required: true },
    district: { type: String, required: true },
    ward:     { type: String, required: true },
    street:   { type: String, required: true },
  },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
  },
  statusHistory: [statusHistorySchema],

  // Tài chính (VND – số nguyên)
  itemsTotal:  { type: Number, required: true },
  shippingFee: { type: Number, default: 30000 },
  discount:    { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  // Coupon snapshot
  coupon: {
    code:           { type: String, default: null },
    discountType:   { type: String },
    discountValue:  { type: Number },
    discountAmount: { type: Number },
  },

  paymentMethod: {
    type: String,
    enum: ['cod', 'bank_transfer', 'vietqr', 'vnpay', 'momo', 'zalopay'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid',
  },

  // Vận chuyển
  shippingProvider: { type: String, enum: ['ghn', 'ghtk', 'viettel_post', 'other', null], default: null },
  trackingCode:     { type: String, default: '' },
  estimatedDelivery:{ type: Date, default: null },

  note:      { type: String, maxlength: 500, default: '' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// ── Tự sinh orderCode ─────────────────────────────────
// FIX: tránh race condition bằng cách kết hợp timestamp milisecond + random suffix
// thay vì countDocuments (có thể trả về cùng count khi concurrent).
// Format: ORD-YYYYMMDD-HHmmssSSS-RR (RR = 2 ký tự random hex)
orderSchema.pre('save', function (next) {
  if (this.isNew && !this.orderCode) {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
    // FIX B-03: dùng crypto.randomBytes(3) = 6 hex chars → entropy 16^6 = 16M tổ hợp
    // thay vì Math.random() * 0xFF (256 tổ hợp) để loại bỏ collision khi tải cao
    const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.orderCode = `ORD-${dateStr}-${timeStr}-${randSuffix}`;
  }
  next();
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderCode: 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
