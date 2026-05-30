// models/Coupon.js
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String, required: true,
    uppercase: true, trim: true,
  },
  description:   { type: String, default: '' },
  discountType:  { type: String, enum: ['percent', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  maxDiscount:   { type: Number, default: null },
  minOrderValue: { type: Number, default: 0 },
  maxUsage:      { type: Number, default: null },
  usedCount:     { type: Number, default: 0 },
  maxUsagePerUser: { type: Number, default: 1 },
  // FIX: thêm default: [] để đảm bảo usedBy luôn là array, tránh crash khi gọi .some() trên undefined
  usedBy: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  },
  startDate:     { type: Date, required: true },
  endDate:       { type: Date, required: true },
  isActive:      { type: Boolean, default: true },
}, { timestamps: true });

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
