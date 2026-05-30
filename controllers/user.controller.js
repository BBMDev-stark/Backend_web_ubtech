// controllers/user.controller.js
const User   = require('../models/User');
const bcrypt = require('bcryptjs');

// ════════════════════════════════════════════════════
// XEM PROFILE BẢN THÂN
// GET /api/users/profile
// ════════════════════════════════════════════════════
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// CẬP NHẬT THÔNG TIN CÁ NHÂN
// PUT /api/users/profile
// Body: { name?, phone?, avatar? }
// ════════════════════════════════════════════════════
const updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const updates = {};

    if (name) {
      if (name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Tên phải có ít nhất 2 ký tự' });
      }
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      if (phone && !/^(0|\+84)[0-9]{8,9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ' });
      }
      updates.phone = phone;
    }

    if (avatar !== undefined) updates.avatar = avatar;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin nào để cập nhật' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).lean();

    res.json({ success: true, message: 'Cập nhật thông tin thành công', data: user });

  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// ĐỔI MẬT KHẨU
// PUT /api/users/change-password
// Body: { currentPassword, newPassword }
// ════════════════════════════════════════════════════
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }

    // Lấy user kèm password (field có select:false)
    const user = await User.findById(req.user._id).select('+password');

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    }

    // Cập nhật mật khẩu mới (pre-save hook tự hash)
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' });

  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// LẤY DANH SÁCH ĐỊA CHỈ
// GET /api/users/addresses
// ════════════════════════════════════════════════════
const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses').lean();
    res.json({ success: true, data: user.addresses });
  } catch (err) {
    console.error('getAddresses error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// THÊM ĐỊA CHỈ MỚI
// POST /api/users/addresses
// Body: { label, fullName, phone, province, district, ward, street, isDefault? }
// ════════════════════════════════════════════════════
const addAddress = async (req, res) => {
  try {
    const { label = 'Nhà', fullName, phone, province, district, ward, street, isDefault = false } = req.body;

    // Validate
    if (!fullName || !phone || !province || !district || !ward || !street) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin địa chỉ' });
    }

    const user = await User.findById(req.user._id);

    // Tối đa 5 địa chỉ
    if (user.addresses.length >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã lưu tối đa 5 địa chỉ. Vui lòng xóa bớt trước khi thêm.',
      });
    }

    // Nếu set isDefault → bỏ default của các địa chỉ cũ
    if (isDefault) {
      user.addresses.forEach(addr => { addr.isDefault = false; });
    }

    // Địa chỉ đầu tiên tự động là default
    const shouldBeDefault = isDefault || user.addresses.length === 0;

    user.addresses.push({ label, fullName, phone, province, district, ward, street, isDefault: shouldBeDefault });
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Đã thêm địa chỉ mới',
      data:    user.addresses,
    });

  } catch (err) {
    console.error('addAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// CẬP NHẬT ĐỊA CHỈ
// PUT /api/users/addresses/:addressId
// ════════════════════════════════════════════════════
const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, fullName, phone, province, district, ward, street, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
    }

    // Nếu set isDefault → bỏ default cũ
    if (isDefault === true) {
      user.addresses.forEach(addr => { addr.isDefault = false; });
      address.isDefault = true;
    }

    // Cập nhật từng field nếu có
    if (label     !== undefined) address.label     = label;
    if (fullName  !== undefined) address.fullName  = fullName;
    if (phone     !== undefined) address.phone     = phone;
    if (province  !== undefined) address.province  = province;
    if (district  !== undefined) address.district  = district;
    if (ward      !== undefined) address.ward      = ward;
    if (street    !== undefined) address.street    = street;

    await user.save();

    res.json({ success: true, message: 'Đã cập nhật địa chỉ', data: user.addresses });

  } catch (err) {
    console.error('updateAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// XÓA ĐỊA CHỈ
// DELETE /api/users/addresses/:addressId
// ════════════════════════════════════════════════════
const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
    }

    const wasDefault = address.isDefault;
    user.addresses.pull({ _id: addressId });

    // Nếu xóa địa chỉ default → tự động set địa chỉ đầu tiên còn lại làm default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json({ success: true, message: 'Đã xóa địa chỉ', data: user.addresses });

  } catch (err) {
    console.error('deleteAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// ĐẶT LÀM ĐỊA CHỈ MẶC ĐỊNH
// PUT /api/users/addresses/:addressId/default
// ════════════════════════════════════════════════════
const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
    }

    // Bỏ default tất cả → set default cho địa chỉ được chọn
    user.addresses.forEach(addr => { addr.isDefault = false; });
    address.isDefault = true;

    await user.save();

    res.json({ success: true, message: `Đã đặt "${address.label}" làm địa chỉ mặc định`, data: user.addresses });

  } catch (err) {
    console.error('setDefaultAddress error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] LẤY DANH SÁCH NGƯỜI DÙNG
// GET /api/users/admin/all
// ════════════════════════════════════════════════════
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query;

    const filter = { isDeleted: false };
    if (role)     filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search)   filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Number(limit));

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email phone role isActive emailVerified lastLogin createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });

  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] KHÓA / MỞ KHÓA TÀI KHOẢN
// PUT /api/users/admin/:userId/toggle-active
// ════════════════════════════════════════════════════
const toggleUserActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy user' });

    // Không cho khóa chính mình
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Không thể khóa tài khoản của chính mình' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `Tài khoản "${user.name}" đã được ${user.isActive ? 'mở khóa' : 'khóa'}`,
      data: { isActive: user.isActive },
    });

  } catch (err) {
    console.error('toggleUserActive error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAllUsers,
  toggleUserActive,
};
