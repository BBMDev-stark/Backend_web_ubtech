// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  slug:      { type: String, required: true, lowercase: true, trim: true },
  type:      { type: String, enum: ['product', 'post'], required: true },
  parent:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  image:     { type: String, default: '' },
  order:     { type: Number, default: 0 },
  isActive:  { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
