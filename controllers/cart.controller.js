// controllers/cart.controller.js
const Cart    = require('../models/Cart');
const Product = require('../models/Product');

// Helper: lấy hoặc tạo giỏ hàng cho user
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// Helper: format cart response nhất quán
const formatCartResponse = (cart) => ({
  _id:         cart._id,
  items:       cart.items,
  totalItems:  cart.totalItems,
  totalAmount: cart.totalAmount,
  couponCode:  cart.couponCode || null,
});

// ════════════════════════════════════════════════════
// XEM GIỎ HÀNG
// GET /api/cart
// ════════════════════════════════════════════════════
const getCart = async (req, res) => {
  try {
    // FIX B-09: populate product để filter đúng — item.product là ObjectId hợp lệ
    // dù product đã bị xóa trong DB, nên phải populate mới biết product có null không
    const cart = await Cart.findOne({ user: req.user._id })
      .populate({ path: 'items.product', select: '_id isDeleted status' });

    if (!cart) {
      return res.json({
        success: true,
        data: { items: [], totalItems: 0, totalAmount: 0, couponCode: null },
      });
    }

    // Lọc bỏ item có product null (đã xóa khỏi DB) hoặc product isDeleted = true
    const validItems = cart.items.filter(
      item => item.product !== null && !item.product.isDeleted
    );

    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    res.json({ success: true, data: formatCartResponse(cart) });
  } catch (err) {
    console.error('getCart error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// THÊM SẢN PHẨM VÀO GIỎ
// POST /api/cart
// Body: { productId, variantId?, quantity? }
// ════════════════════════════════════════════════════
const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId)  return res.status(400).json({ success: false, message: 'Thiếu productId' });
    if (quantity < 1) return res.status(400).json({ success: false, message: 'Số lượng phải ít nhất là 1' });

    const product = await Product.findOne({ _id: productId, status: 'active', isDeleted: false });
    if (!product) return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại hoặc đã ngừng bán' });

    let price       = product.salePrice || product.basePrice;
    let stock       = product.stock;
    let variantName = '';
    let sku         = '';
    let variantObjId = null;

    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant || !variant.isActive) {
        return res.status(404).json({ success: false, message: 'Biến thể sản phẩm không tồn tại' });
      }
      price        = variant.salePrice || variant.price;
      stock        = variant.stock;
      variantName  = variant.name;
      sku          = variant.sku || '';
      variantObjId = variant._id;
    }

    if (stock <= 0) return res.status(400).json({ success: false, message: 'Sản phẩm đã hết hàng' });

    const primaryImage = product.images.find(img => img.isPrimary)?.url || product.images[0]?.url || '';
    const cart = await getOrCreateCart(req.user._id);

    const existingIndex = cart.items.findIndex(item => {
      const sameProduct = item.product.toString() === productId;
      const sameVariant = variantId
        ? item.variantId?.toString() === variantId
        : !item.variantId;
      return sameProduct && sameVariant;
    });

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + quantity;
      if (newQty > stock) {
        return res.status(400).json({ success: false, message: `Chỉ còn ${stock} sản phẩm trong kho` });
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].price    = price;
    } else {
      if (quantity > stock) {
        return res.status(400).json({ success: false, message: `Chỉ còn ${stock} sản phẩm trong kho` });
      }
      cart.items.push({
        product:     product._id,
        variantId:   variantObjId,
        variantName,
        name:        product.name,
        slug:        product.slug,   // ← lưu slug để frontend link đúng
        image:       primaryImage,
        price,
        quantity,
        sku,
      });
    }

    await cart.save();
    res.json({ success: true, message: 'Đã thêm vào giỏ hàng', data: formatCartResponse(cart) });
  } catch (err) {
    console.error('addToCart error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// CẬP NHẬT SỐ LƯỢNG
// PUT /api/cart/:itemId
// Body: { quantity }
// ════════════════════════════════════════════════════
const updateCartItem = async (req, res) => {
  try {
    const { itemId }   = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Số lượng phải ít nhất là 1' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Giỏ hàng trống' });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm trong giỏ' });

    // Kiểm tra tồn kho
    const product = await Product.findById(item.product);
    if (product) {
      let stock = product.stock;
      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (variant) stock = variant.stock;
      }
      if (quantity > stock) {
        return res.status(400).json({ success: false, message: `Chỉ còn ${stock} sản phẩm trong kho` });
      }
    }

    item.quantity = quantity;
    await cart.save();
    res.json({ success: true, message: 'Đã cập nhật giỏ hàng', data: formatCartResponse(cart) });
  } catch (err) {
    console.error('updateCartItem error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// XÓA 1 SẢN PHẨM KHỎI GIỎ
// DELETE /api/cart/:itemId
// ════════════════════════════════════════════════════
const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Giỏ hàng trống' });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm trong giỏ' });

    cart.items.pull({ _id: itemId });
    await cart.save();
    res.json({ success: true, message: 'Đã xóa sản phẩm khỏi giỏ', data: formatCartResponse(cart) });
  } catch (err) {
    console.error('removeCartItem error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// XÓA TOÀN BỘ GIỎ HÀNG
// DELETE /api/cart
// ════════════════════════════════════════════════════
const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], couponCode: null }
    );
    res.json({ success: true, message: 'Đã xóa toàn bộ giỏ hàng', data: { items: [], totalItems: 0, totalAmount: 0, couponCode: null } });
  } catch (err) {
    console.error('clearCart error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// ÁP DỤNG MÃ GIẢM GIÁ
// POST /api/cart/coupon
// Body: { couponCode }
// NOTE: Đây chỉ là PREVIEW — coupon được validate chính thức (atomic)
// khi tạo đơn hàng trong transaction. Cart chỉ lưu couponCode.
// ════════════════════════════════════════════════════
const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    if (!couponCode) return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giảm giá' });

    const Coupon = require('../models/Coupon');
    const coupon = await Coupon.findOne({
      code:      couponCode.toUpperCase().trim(),
      isActive:  true,
      startDate: { $lte: new Date() },
      endDate:   { $gte: new Date() },
    });

    if (!coupon) return res.status(400).json({ success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });

    const alreadyUsed = coupon.usedBy.some(id => id.toString() === req.user._id.toString());
    if (alreadyUsed) return res.status(400).json({ success: false, message: 'Bạn đã sử dụng mã giảm giá này rồi' });

    // FIX B-06: kiểm tra maxUsage để thông báo cho user sớm,
    // nhưng kiểm tra CUỐI CÙNG (atomic) vẫn ở trong transaction tạo đơn hàng
    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
    }

    const cart = await getOrCreateCart(req.user._id);
    if (cart.totalAmount < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng tối thiểu ${coupon.minOrderValue.toLocaleString('vi-VN')}đ để dùng mã này`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percent') {
      discountAmount = Math.floor(cart.totalAmount * coupon.discountValue / 100);
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    } else {
      discountAmount = Math.min(coupon.discountValue, cart.totalAmount);
    }

    cart.couponCode = coupon.code;
    await cart.save();

    res.json({
      success: true,
      message: `Áp dụng mã thành công! Giảm ${discountAmount.toLocaleString('vi-VN')}đ`,
      data: {
        couponCode:     coupon.code,
        discountType:   coupon.discountType,
        discountValue:  coupon.discountValue,
        discountAmount,
        totalAmount:    cart.totalAmount,
        finalAmount:    Math.max(0, cart.totalAmount - discountAmount),
      },
    });
  } catch (err) {
    console.error('applyCoupon error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// HỦY MÃ GIẢM GIÁ
// DELETE /api/cart/coupon
// ════════════════════════════════════════════════════
const removeCoupon = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { couponCode: null });
    res.json({ success: true, message: 'Đã hủy mã giảm giá' });
  } catch (err) {
    console.error('removeCoupon error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart, applyCoupon, removeCoupon };
