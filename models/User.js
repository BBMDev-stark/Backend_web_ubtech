// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  label:     { type: String, default: 'Nhà' },
  fullName:  { type: String, required: true },
  phone:     { type: String, required: true },
  province:  { type: String, required: true },
  district:  { type: String, required: true },
  ward:      { type: String, required: true },
  street:    { type: String, required: true },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên tối đa 100 ký tự'],
  },
  email: {
    type: String,
    required: [true, 'Email là bắt buộc'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
  },
  phone: {
    type: String,
    trim: true,
    match: [/^(0|\+84)[0-9]{8,9}$/, 'Số điện thoại không hợp lệ'],
  },
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [6, 'Mật khẩu tối thiểu 6 ký tự'],
    select: false,  // ← QUAN TRỌNG: không bao giờ trả về password trong query
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'customer'],
    default: 'customer',
  },
  avatar:        { type: String, default: '' },
  isActive:      { type: Boolean, default: true },
  isDeleted:     { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  refreshToken:  { type: String, select: false }, // ← cũng không trả về
  lastLogin:     { type: Date },
  addresses:     [addressSchema],
}, { timestamps: true });

// ── Tự động hash password trước khi lưu ──────────────
userSchema.pre('save', async function (next) {
  // Chỉ hash khi password thay đổi, không hash lại khi update field khác
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── So sánh password khi đăng nhập ───────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Trả về object an toàn (không có password) ────────
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

// Indexes (không dùng unique:true trong field để tránh warning)
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isDeleted: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
