// models/Product.js
const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  sku:        { type: String },
  price:      { type: Number, required: true, min: 0 },
  salePrice:  { type: Number, min: 0, default: null },
  stock:      { type: Number, default: 0, min: 0 },
  images:     [String],
  attributes: [{ key: String, value: String }],
  isActive:   { type: Boolean, default: true },
}, { _id: true });

const productSchema = new mongoose.Schema({
  name:      { type: String, required: [true, 'Tên sản phẩm là bắt buộc'], trim: true },
  slug:      { type: String, required: true, lowercase: true, trim: true },
  category:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  brand:     { type: String, default: '' },
  shortDesc: { type: String, maxlength: 500 },
  description: { type: String },
  images:    [{ url: String, alt: String, isPrimary: { type: Boolean, default: false } }],
  attributes: [{ key: String, value: String }],
  variants:  [variantSchema],
  basePrice: { type: Number, min: 0, default: null },
  salePrice: { type: Number, min: 0, default: null },
  stock:     { type: Number, default: 0, min: 0 },
  ratingAvg:   { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  soldCount:   { type: Number, default: 0 },
  viewCount:   { type: Number, default: 0 },
  tags:      [String],
  isFeatured: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'outOfStock'],
    default: 'draft',
  },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true, toJSON: { virtuals: true } });

// FIX: guard khi prices rỗng (không có variant active) → tránh Math.min(...[]) = Infinity
productSchema.virtual('displayPrice').get(function () {
  if (this.variants && this.variants.length > 0) {
    const prices = this.variants
      .filter(v => v.isActive)
      .map(v => v.salePrice || v.price)
      .filter(p => p != null && p >= 0);

    if (prices.length > 0) return Math.min(...prices);
    // fallback: không có variant active → dùng giá base của product
  }
  return this.salePrice || this.basePrice || null;
});

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ basePrice: 1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ ratingAvg: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index(
  { name: 'text', shortDesc: 'text', tags: 'text', brand: 'text' },
  { weights: { name: 10, brand: 5, tags: 5, shortDesc: 2 }, name: 'product_text_search' }
);

module.exports = mongoose.model('Product', productSchema);
