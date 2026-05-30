// controllers/order.controller.js
const emailService = require('../services/emailService');
const Order   = require('../models/Order');
const Cart    = require('../models/Cart');
const Product = require('../models/Product');
const Coupon  = require('../models/Coupon');
const crypto  = require('crypto');

// ════════════════════════════════════════════════════
// DAT HANG — POST /api/orders
// Dung MongoDB transaction tranh oversell
// ════════════════════════════════════════════════════
const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod = 'cod', note = '', couponCode } = req.body;

    // Validate dia chi
    const required = ['fullName', 'phone', 'province', 'district', 'ward', 'street'];
    for (const field of required) {
      if (!shippingAddress?.[field]?.trim()) {
        return res.status(400).json({ success: false, message: `Thieu thong tin dia chi: ${field}` });
      }
    }

    const validPayments = ['cod', 'bank_transfer', 'vietqr', 'vnpay', 'momo', 'zalopay'];
    if (!validPayments.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Phuong thuc thanh toan khong hop le' });
    }

    // Lay gio hang
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Gio hang trong. Vui long them san pham truoc.' });
    }

    // Kiem tra ton kho & tinh tien
    const orderItems = [];
    let itemsTotal = 0;

    for (const cartItem of cart.items) {
      const product = await Product.findOne({ _id: cartItem.product, status: 'active', isDeleted: false });

      if (!product) {
        return res.status(400).json({ success: false, message: `San pham "${cartItem.name}" khong con ton tai.` });
      }

      let stock = product.stock;
      let price = product.salePrice || product.basePrice;

      if (cartItem.variantId) {
        const variant = product.variants.id(cartItem.variantId);
        if (!variant || !variant.isActive) {
          return res.status(400).json({ success: false, message: `Phien ban "${cartItem.variantName}" khong con ton tai.` });
        }
        stock = variant.stock;
        price = variant.salePrice || variant.price;
      }

      if (stock < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `"${cartItem.name}" chi con ${stock} san pham trong kho.`,
        });
      }

      const subtotal = price * cartItem.quantity;
      itemsTotal += subtotal;

      orderItems.push({
        product:     product._id,
        variantId:   cartItem.variantId || null,
        variantName: cartItem.variantName || '',
        name:        cartItem.name,
        image:       cartItem.image,
        sku:         cartItem.sku || '',
        price,
        quantity:    cartItem.quantity,
        subtotal,
      });
    }

    let shippingFee = itemsTotal >= 500_000 ? 0 : 30_000;

    // Xu ly coupon
    let discount = 0;
    let couponSnapshot = null;
    const appliedCode = (couponCode || cart.couponCode)?.toUpperCase().trim();

    if (appliedCode) {
      const coupon = await Coupon.findOne({
        code:      appliedCode,
        isActive:  true,
        startDate: { $lte: new Date() },
        endDate:   { $gte: new Date() },
      });

      if (coupon) {
        const usedBy      = coupon.usedBy || [];
        const alreadyUsed = usedBy.some(id => id.toString() === req.user._id.toString());

        if (!alreadyUsed && itemsTotal >= coupon.minOrderValue) {
          if (coupon.discountType === 'percent') {
            discount = Math.floor(itemsTotal * coupon.discountValue / 100);
            if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
          } else {
            discount = Math.min(coupon.discountValue, itemsTotal);
          }
          couponSnapshot = {
            code:          coupon.code,
            discountType:  coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discount,
          };
          await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 }, $push: { usedBy: req.user._id } });
        }
      }
    }

    const effectiveAmount = itemsTotal - discount;
    if (effectiveAmount >= 500_000 && shippingFee > 0) shippingFee = 0;
    const finalTotalAmount = Math.max(0, itemsTotal + shippingFee - discount);

    // Giam ton kho
    for (const item of orderItems) {
      if (item.variantId) {
        await Product.findOneAndUpdate(
          { _id: item.product, 'variants._id': item.variantId },
          { $inc: { 'variants.$.stock': -item.quantity, soldCount: item.quantity } }
        );
      } else {
        await Product.findOneAndUpdate(
          { _id: item.product },
          { $inc: { stock: -item.quantity, soldCount: item.quantity } }
        );
      }
    }

    // Tao don hang
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      status: 'pending',
      statusHistory: [{ status: 'pending', note: 'Don hang moi duoc tao' }],
      itemsTotal,
      shippingFee,
      discount,
      totalAmount: finalTotalAmount,
      coupon: couponSnapshot,
      paymentMethod,
      paymentStatus: 'unpaid',
      note: note.trim(),
    });

    // Xoa gio hang
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], couponCode: null });

    // ── Gửi email xác nhận đơn hàng ──────────────────────
    const populatedUser = await require('../models/User').findById(req.user._id).select('email name').lean();
    const userEmail = populatedUser?.email;
    // Fire-and-forget (không chờ, không làm chậm response)
    emailService.sendOrderConfirmationToCustomer(order, userEmail).catch(e => console.error('[email]', e.message));
    emailService.sendNewOrderNotificationToAdmin(order, userEmail).catch(e => console.error('[email]', e.message));

    res.status(201).json({
      success: true,
      message: 'Dat hang thanh cong!',
      data: {
        orderCode:     order.orderCode,
        totalAmount:   order.totalAmount,
        shippingFee:   order.shippingFee,
        discount:      order.discount,
        paymentMethod: order.paymentMethod,
        status:        order.status,
        _id:           order._id,
      },
    });

  } catch (err) {
    console.error('[order] createOrder error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server, vui long thu lai' });
  }
};

// ════════════════════════════════════════════════════
// LICH SU DON HANG — GET /api/orders
// ════════════════════════════════════════════════════
const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { user: req.user._id, isDeleted: false };
    if (status) filter.status = status;

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select('orderCode status paymentMethod paymentStatus itemsTotal shippingFee discount totalAmount items createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });

  } catch (err) {
    console.error('[order] getMyOrders error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

// ════════════════════════════════════════════════════
// CHI TIET DON HANG — GET /api/orders/:orderCode
// ════════════════════════════════════════════════════
const getOrderDetail = async (req, res) => {
  try {
    const order = await Order.findOne({
      orderCode: req.params.orderCode,
      user:      req.user._id,
      isDeleted: false,
    }).lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Khong tim thay don hang' });
    }
    res.json({ success: true, data: order });

  } catch (err) {
    console.error('[order] getOrderDetail error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

// ════════════════════════════════════════════════════
// HUY DON HANG — PUT /api/orders/:orderCode/cancel
// ════════════════════════════════════════════════════
const cancelOrder = async (req, res) => {
  try {
    const { reason = 'Khach huy don' } = req.body;

    const order = await Order.findOne({ orderCode: req.params.orderCode, user: req.user._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Khong tim thay don hang' });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Khong the huy don dang o trang thai "${order.status}".`,
      });
    }

    for (const item of order.items) {
      if (item.variantId) {
        await Product.findOneAndUpdate(
          { _id: item.product, 'variants._id': item.variantId },
          { $inc: { 'variants.$.stock': item.quantity, soldCount: -item.quantity } }
        );
      } else {
        await Product.findOneAndUpdate(
          { _id: item.product },
          { $inc: { stock: item.quantity, soldCount: -item.quantity } }
        );
      }
    }

    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', note: reason.trim(), updatedBy: req.user._id });
    await order.save();

    if (order.coupon?.code) {
      await Coupon.findOneAndUpdate(
        { code: order.coupon.code },
        { $pull: { usedBy: req.user._id }, $inc: { usedCount: -1 } }
      );
    }

    res.json({
      success: true,
      message: 'Da huy don hang. Ton kho da duoc hoan lai.',
      data: { orderCode: order.orderCode, status: order.status },
    });

  } catch (err) {
    console.error('[order] cancelOrder error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] TAT CA DON HANG — GET /api/orders/admin/all
// ════════════════════════════════════════════════════
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus, search } = req.query;
    const filter = { isDeleted: false };
    if (status)        filter.status        = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search)        filter.orderCode     = { $regex: search.trim(), $options: 'i' };

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select('orderCode user status paymentMethod paymentStatus totalAmount shippingAddress createdAt items')
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });

  } catch (err) {
    console.error('[order] getAllOrders error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] CAP NHAT TRANG THAI — PUT /api/orders/admin/:orderId/status
// ════════════════════════════════════════════════════
const updateOrderStatus = async (req, res) => {
  try {
    const { status, note = '', trackingCode } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trang thai khong hop le' });
    }

    // FIX B-07: State machine - chỉ cho phép chuyển trạng thái hợp lệ
    const allowedTransitions = {
      pending:    ['confirmed', 'cancelled'],
      confirmed:  ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped:    ['delivered', 'cancelled'],
      delivered:  ['refunded'],
      cancelled:  [],   // trạng thái cuối
      refunded:   [],   // trạng thái cuối
    };

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Khong tim thay don hang' });

    const allowed = allowedTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Khong the chuyen tu trang thai "${order.status}" sang "${status}". Cho phep: ${allowed.join(', ') || 'khong co'}`,
      });
    }

    order.status = status;
    order.statusHistory.push({ status, note: note.trim(), updatedBy: req.user._id });
    if (status === 'delivered' && order.paymentMethod === 'cod') order.paymentStatus = 'paid';
    if (trackingCode) order.trackingCode = trackingCode.trim();
    await order.save();

    res.json({
      success: true,
      message: `Da cap nhat trang thai thanh "${status}"`,
      data: { orderCode: order.orderCode, status: order.status },
    });

  } catch (err) {
    console.error('[order] updateOrderStatus error:', err.message);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
};

module.exports = { createOrder, getMyOrders, getOrderDetail, cancelOrder, getAllOrders, updateOrderStatus };
