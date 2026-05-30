// seed-demo.js
// ╔══════════════════════════════════════════════════════════════╗
// ║  SEED SẢN PHẨM DEMO 10.000đ để test tính năng VietQR       ║
// ║  Chạy: node seed-demo.js                                    ║
// ║  Xóa demo: node seed-demo.js --delete                       ║
// ╚══════════════════════════════════════════════════════════════╝
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product  = require('./models/Product');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ubtech_vn';

const DEMO_SLUG = 'san-pham-demo-test-vietqr-10k';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected');

  const isDelete = process.argv.includes('--delete');

  if (isDelete) {
    const deleted = await Product.deleteOne({ slug: DEMO_SLUG });
    console.log(deleted.deletedCount > 0
      ? '🗑  Đã xóa sản phẩm demo'
      : 'ℹ️  Không tìm thấy sản phẩm demo để xóa');
    await mongoose.disconnect();
    return;
  }

  // Tìm hoặc tạo category "Demo & Test"
  let cat = await Category.findOne({ slug: 'demo-test' });
  if (!cat) {
    cat = await Category.create({
      name    : 'Demo & Test',
      slug    : 'demo-test',
      type    : 'product',
      isActive: true,
    });
    console.log('📂 Tạo category "Demo & Test"');
  }

  // Tạo / cập nhật sản phẩm demo
  const existing = await Product.findOne({ slug: DEMO_SLUG });
  const demoData = {
    name     : '🧪 [DEMO] Test VietQR 10.000đ',
    slug     : DEMO_SLUG,
    category : cat._id,
    brand    : 'UBTECH Demo',
    shortDesc: 'Sản phẩm dùng để test tính năng thanh toán VietQR. Giá 10.000đ.',
    description: `
      <p><strong>⚠ Đây là sản phẩm TEST — không phải hàng thật.</strong></p>
      <p>Dùng để kiểm tra flow thanh toán VietQR end-to-end:</p>
      <ol>
        <li>Thêm vào giỏ hàng</li>
        <li>Đặt hàng với phương thức VietQR</li>
        <li>Quét QR hoặc chuyển khoản đúng nội dung</li>
        <li>Hệ thống tự động xác nhận trong vài giây</li>
      </ol>
    `,
    images: [
      {
        url      : 'https://img.vietqr.io/image/970437-compact2.jpg?amount=10000&addInfo=DEMO+TEST',
        alt      : 'Demo VietQR',
        isPrimary: true,
      },
    ],
    basePrice : 10000,
    salePrice : null,
    stock     : 9999,   // luôn có hàng
    status    : 'active',
    isFeatured: false,
    isDeleted : false,
    tags      : ['demo', 'test', 'vietqr', 'thanh-toan'],
    attributes: [
      { key: 'Loại',      value: 'Sản phẩm test' },
      { key: 'Giá trị',   value: '10.000đ' },
      { key: 'Mục đích',  value: 'Test VietQR auto-payment' },
    ],
  };

  if (existing) {
    await Product.findByIdAndUpdate(existing._id, demoData);
    console.log('🔄 Cập nhật sản phẩm demo (đã tồn tại)');
  } else {
    await Product.create(demoData);
    console.log('✨ Tạo sản phẩm demo mới');
  }

  // In link để dùng ngay
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  console.log('\n──────────────────────────────────────────');
  console.log(`🛒 Link sản phẩm: ${baseUrl}/san-pham/${DEMO_SLUG}`);
  console.log(`💰 Giá: 10.000đ`);
  console.log(`📋 Để xóa demo: node seed-demo.js --delete`);
  console.log('──────────────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('✅ Xong!');
}

run().catch(err => { console.error('❌ Lỗi:', err); process.exit(1); });
