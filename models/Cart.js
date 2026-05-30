// models/Cart.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  variantName: { type: String, default: '' },
  name:        { type: String, required: true },
  slug:        { type: String, default: '' },   // ← cache slug để link đúng trang SP
  image:       { type: String, default: '' },
  price:       { type: Number, required: true },
  quantity:    { type: Number, required: true, min: 1, default: 1 },
  sku:         { type: String, default: '' },
}, {
  _id: true,
  timestamps: { createdAt: 'addedAt', updatedAt: false },
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items:      { type: [cartItemSchema], default: [] },
  couponCode: { type: String, default: null },
}, { timestamps: true });

// Virtual: tổng tiền
cartSchema.virtual('totalAmount').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

// Virtual: tổng số lượng
cartSchema.virtual('totalItems').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

cartSchema.set('toJSON',   { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

cartSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('Cart', cartSchema);
