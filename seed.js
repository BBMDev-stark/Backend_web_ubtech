// backend/seed.js — Chạy: node seed.js
// Seed toàn bộ dữ liệu thật từ file Excel Sản_phẩm.xlsx
// v3: Cập nhật ảnh sách từ s4h.edu.vn (ảnh webp chất lượng cao)
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://buiminh19102004_db_user:teQyAdi7BkELgSAg@cluster0.h2mkwii.mongodb.net/ubtech_vn?retryWrites=true&w=majority';

// ── Load models ─────────────────────────────────────────
const Category = require('./models/Category');
const Product  = require('./models/Product');
const User     = require('./models/User');
const Coupon   = require('./models/Coupon');

// ── Hàm tạo slug chuẩn ──────────────────────────────────
function toSlug(str) {
  const map = { 'à':'a','á':'a','ả':'a','ã':'a','ạ':'a','â':'a','ầ':'a','ấ':'a','ẩ':'a','ẫ':'a','ậ':'a','ă':'a','ằ':'a','ắ':'a','ẳ':'a','ẵ':'a','ặ':'a','è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e','ê':'e','ề':'e','ế':'e','ể':'e','ễ':'e','ệ':'e','ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i','ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ồ':'o','ố':'o','ổ':'o','ỗ':'o','ộ':'o','ơ':'o','ờ':'o','ớ':'o','ở':'o','ỡ':'o','ợ':'o','ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u','ư':'u','ừ':'u','ứ':'u','ử':'u','ữ':'u','ự':'u','ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y','đ':'d','À':'a','Á':'a','Ả':'a','Ã':'a','Ạ':'a','Â':'a','Ầ':'a','Ấ':'a','Ẩ':'a','Ẫ':'a','Ậ':'a','Ă':'a','Ằ':'a','Ắ':'a','Ẳ':'a','Ẵ':'a','Ặ':'a','È':'e','É':'e','Ẻ':'e','Ẽ':'e','Ẹ':'e','Ê':'e','Ề':'e','Ế':'e','Ể':'e','Ễ':'e','Ệ':'e','Ì':'i','Í':'i','Ỉ':'i','Ĩ':'i','Ị':'i','Ò':'o','Ó':'o','Ỏ':'o','Õ':'o','Ọ':'o','Ô':'o','Ồ':'o','Ố':'o','Ổ':'o','Ỗ':'o','Ộ':'o','Ơ':'o','Ờ':'o','Ớ':'o','Ở':'o','Ỡ':'o','Ợ':'o','Ù':'u','Ú':'u','Ủ':'u','Ũ':'u','Ụ':'u','Ư':'u','Ừ':'u','Ứ':'u','Ử':'u','Ữ':'u','Ự':'u','Ỳ':'y','Ý':'y','Ỷ':'y','Ỹ':'y','Ỵ':'y','Đ':'d' };
  return str.split('').map(c => map[c] || c).join('').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
}

// ════════════════════════════════════════════════════════
// DỮ LIỆU THẬT — 12 ROBOT + 9 KIT + 13 SÁCH = 34 SP
// images[]: ảnh thật từ ubtechvietnam.edu.vn (gallery)
//   - images[0] isPrimary: true  → ảnh đại diện
//   - images[1..N]               → ảnh gallery thêm
// ════════════════════════════════════════════════════════

// Base URL ảnh từ website UBTECH Vietnam
const WEB = 'https://ubtechvietnam.edu.vn/ENG/wp-content/uploads/sites/2';
const COM = 'https://ubtechvietnam.edu.vn/wp-content/uploads';

// Base URL ảnh sách từ s4h.edu.vn (ảnh webp chất lượng cao, nền tròn đẹp)
const S4H = 'https://s4h.edu.vn/wp-content/uploads/2024/01';

const ROBOTS = [
  {
    name: 'SCOREBOT KIT',
    basePrice: 2990000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/www.ubtechvietnam.com/wp-content/uploads/2021/03/scorebot_01.jpg', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/www.ubtechvietnam.com/wp-content/uploads/2021/03/ScoreBot_07.png` },
      { url: `https://m.media-amazon.com/images/I/71yzZ-0mLpL._AC_UF894,1000_QL80_.jpg` },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/ScoreBot_09-600x250.jpg` },
    ],
    description: 'Bộ công cụ ScoreBot cung cấp đầy đủ linh kiện để bạn tự tay xây dựng, lập trình và điều khiển một robot bóng đá có khả năng bắn và ghi bàn thật sự. Được Câu lạc bộ bóng đá Manchester City xác nhận chính thức, ScoreBot không chỉ là một dự án học tập thú vị mà còn là người bạn đồng hành lý tưởng trong các trận đấu bóng đá bằng robot – hoàn toàn do bạn tạo ra!',
    stock: 30, isFeatured: true, soldCount: 85,
    attributes: [{ key: 'Đối tượng', value: '8-14 tuổi' }, { key: 'Kết nối', value: 'Bluetooth' }, { key: 'Đối tác', value: 'Manchester City FC' }, { key: 'Số linh kiện', value: '261 linh kiện' }, { key: 'Cảm biến', value: 'Cảm biến siêu âm' }],
    tags: ['robot', 'jimu', 'scorebot', 'stem', 'bóng đá', 'lập trình'],
  },
  {
    name: 'UNICORNBOT KIT',
    basePrice: 4590000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/1hOwSthB6t45QUEgFvVuybhOlB_UvfKXk', isPrimary: true },
      { url: `https://images-na.ssl-images-amazon.com/images/I/71n5mLteFdL.jpg` },
      { url: `https://i5.walmartimages.com/asr/ee31433d-e1a4-4f93-a3d3-e86300a4b31b.3583b87ddb091c0ff9aaef89d6509c17.jpeg?odnHeight=768&odnWidth=768&odnBg=FFFFFF` },
    ],
    description: 'Mang thế giới thần thoại vào cuộc sống với Bộ UnicornBot trong dòng sản phẩm Series Thần thoại. Bộ kit này cho phép học sinh tự tay xây dựng và lập trình một chú kỳ lân tuyệt đẹp. Được trang bị cảm biến màu sắc và servo chuyển động mượt mà, UnicornBot có thể di chuyển, nhảy múa, tương tác và thực hiện nhiều hành động thú vị theo lập trình, khơi dậy trí tưởng tượng và đam mê công nghệ cho trẻ em.',
    stock: 25, isFeatured: true, soldCount: 62,
    attributes: [{ key: 'Series', value: 'Series Thần Thoại' }, { key: 'Cảm biến', value: 'Cảm biến màu sắc, servo' }, { key: 'Lập trình', value: 'JIMU App, Blockly' }],
    tags: ['robot', 'jimu', 'unicornbot', 'stem', 'trẻ em', 'lập trình'],
  },
  {
    name: 'TRACKBOT KIT',
    basePrice: 3990000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/TrackBot_04-600x600.jpg', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/TrackBot_14-600x600.jpg` },
      { url: `https://lh3.googleusercontent.com/d/11m7b7B1TEL0aegWofXCoJC-DlV1fpavt` },
    ],
    description: 'Bộ công cụ này cung cấp đầy đủ linh kiện để lắp ráp GrabberBot, DiggerBot hoặc sáng tạo robot JIMU theo ý tưởng riêng. Với động cơ tốc độ cao cho chuyển động mượt mà và đèn LED nhiều màu tạo cảm xúc, robot có thể biểu đạt trạng thái khác nhau theo lập trình của bạn.',
    stock: 40, soldCount: 45,
    attributes: [{ key: 'Robot lắp được', value: 'GrabberBot, DiggerBot' }, { key: 'Đặc điểm', value: 'Động cơ cao tốc, đèn LED' }],
    tags: ['robot', 'jimu', 'trackbot', 'stem', 'lắp ráp'],
  },
  {
    name: 'Yanshee',
    basePrice: 119990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/1HVhd73x_HfF1Syl-LfDMgsSgp2fgnN_L', isPrimary: true },
      { url: `https://www.mzxrobotics.com/img/96483/UBT-YANSHEE_altpic_5/500x500/UBT-YANSHEE.webp?time=1741863539` },
      { url: `https://mgmaingbx7bp.s3.ap-south-1.amazonaws.com/prod_images/251101_6905fdda6e0a09.21691950.webp` },
      { url: `https://storage.googleapis.com/bucket-two-leobotics/product/robot-educatif-humanoi%CC%88de-yanshee-ubtech-3.webp` },
    ],
    description: 'Robot Yanshee là robot giáo dục tích hợp trí tuệ nhân tạo, cảm biến, và khả năng lập trình đa dạng. Với thiết kế hình người linh hoạt, Yanshee hỗ trợ học sinh khám phá lập trình, điều khiển robot, và các ứng dụng AI trong thực tế. Đây là công cụ lý tưởng cho giáo dục STEM, khơi dậy tư duy sáng tạo và kỹ năng công nghệ cho thế hệ trẻ.',
    stock: 5, isFeatured: true, soldCount: 12,
    attributes: [{ key: 'Chiều cao', value: '38 cm (15 inch)' }, { key: 'Loại', value: 'Humanoid' }, { key: 'AI', value: 'Nhận diện khuôn mặt, giọng nói' }, { key: 'Lập trình', value: 'Python, C/C++, Java, Blockly, Scratch' }, { key: 'Kết nối', value: 'WiFi, Bluetooth' }, { key: 'Servo', value: '17 servo' }, { key: 'Cảm biến', value: 'Hồng ngoại, màu sắc, siêu âm, nhiệt độ, áp suất' }],
    tags: ['robot', 'yanshee', 'humanoid', 'ai', 'stem', 'python'],
  },
  {
    name: 'Alpha Mini',
    basePrice: 34990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/10dpsDljzIrY9U6TeSODxbmNMrB8OUSO-', isPrimary: true },
      { url: `https://media.loveitopcdn.com/5371/alpha-mini-2.jpg` },
      { url: `https://m.media-amazon.com/images/I/51ZxI2FFx8L._AC_UF350,350_QL50_.jpg` },
      { url: `https://image.bnews.vn/MediaUpload/Org/2021/11/25/maxresdefault-20211125143035.jpg` },
    ],
    description: 'Alpha Mini là robot hình người nhỏ gọn, được trang bị trí tuệ nhân tạo và khả năng lập trình linh hoạt. Với thiết kế dễ thương và các tính năng tương tác thông minh, Alpha Mini có thể nhảy múa theo nhạc, nhận diện khuôn mặt, kể chuyện và trở thành người bạn đồng hành lý tưởng cho trẻ em và học sinh.',
    stock: 10, isFeatured: true, soldCount: 28,
    attributes: [{ key: 'Chiều cao', value: '25 cm' }, { key: 'Servo', value: '14 Micro Servo' }, { key: 'Camera', value: 'HD 13MP, tự động lấy nét' }, { key: 'Mic', value: 'Mảng 4 mic, nhận diện giọng nói 3-5m' }, { key: 'AI', value: 'Nhận diện khuôn mặt, vật thể, sách tranh' }, { key: 'Kết nối', value: '4G LTE, WiFi, Bluetooth' }, { key: 'App', value: 'Alpha Mini App' }],
    tags: ['robot', 'alpha mini', 'humanoid', 'ai', 'ubtech', 'trẻ em'],
  },
  {
    name: 'AI UGOT',
    basePrice: 28490000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/17-nzBOR9sO5C7wtX3TQLTj0nFGD6VwQm', isPrimary: true },
      { url: `https://www.mzxrobotics.com/img/96483/UBT-UGOT-AI-CG_altpic_2/500x500/UBT-UGOT-AI-CG.webp?time=1730122701` },
      { url: `https://owebsite-cdn.ubtrobot.com/UGOT/ugot07_img02.jpg?image_process=format,webp/quality,Q_80` },
    ],
    description: 'UGOT là bộ kit robot giáo dục do UBTECH phát triển, nổi bật với thiết kế mô-đun linh hoạt, cho phép người dùng lắp ráp hơn 7 dạng robot khác nhau như ô tô tự lái, robot hình người, robot nhện và nhiều hơn nữa. Được lập trình thông qua Blockly và Python, UGOT mang lại trải nghiệm học STEM sâu sắc.',
    stock: 8, isFeatured: true, soldCount: 19,
    attributes: [{ key: 'Hình dạng', value: '7+ dạng robot' }, { key: 'Lập trình', value: 'Blockly, Python' }, { key: 'Kết nối', value: 'WiFi' }],
    tags: ['robot', 'ugot', 'mô-đun', 'ai', 'python', 'stem'],
  },
  {
    name: 'CADEBOT',
    basePrice: 700000000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/1K5Tue2ITNasEiUJr2EM0HEueqvkToP9A', isPrimary: true },
      { url: `https://www.mzxrobotics.com/img/96483/UBT-CADEBOT_altpic_1/500x500/UBT-CADEBOT.webp?time=1771515371` },
      { url: `https://image.made-in-china.com/202f0j00gUBvebMCncoE/Cadebot-L100-Large-Screen-Efficient-Delivery-Multi-Scene-Intelligent-Open-Delivery-Robot.jpg` },
    ],
    description: 'CADEBOT L100 là robot giao hàng tự động do UBTECH phát triển, thiết kế để phục vụ trong nhiều môi trường như nhà hàng, khách sạn, siêu thị và sân bay. Với khả năng điều hướng tự động, tránh chướng ngại vật và tích hợp AI tiên tiến, CADEBOT là giải pháp tự động hóa thương mại hàng đầu.',
    stock: 2, soldCount: 3,
    attributes: [{ key: 'Loại', value: 'Robot giao hàng thương mại' }, { key: 'Môi trường', value: 'Nhà hàng, khách sạn, sân bay' }, { key: 'AI', value: 'Điều hướng tự động, tránh chướng ngại' }],
    tags: ['robot', 'cadebot', 'thương mại', 'giao hàng', 'tự động hóa'],
  },
  {
    name: 'CRUZR',
    basePrice: 693000000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FU50aqn--4P133EitfmuPFI_Gy2n7Ew', isPrimary: true },
      { url: `https://saomaiedu.com/wp-content/uploads/2025/07/Robot-le-tan-CRUZR-2-510x510.webp` },
      { url: `https://saomaiedu.com/wp-content/uploads/2025/07/Robot-le-tan-CRUZR-1-510x510.webp` },
      { url: `https://preview.free3d.com/img/2018/02/2162666978072855979/zzzfypdh.jpg` },
    ],
    description: 'CRUZR là robot hình người tiên tiến do UBTECH phát triển, được thiết kế để nâng cao trải nghiệm khách hàng và tối ưu hóa quy trình vận hành trong các doanh nghiệp. Với khả năng tương tác tự nhiên, nhận diện giọng nói và khuôn mặt, CRUZR phù hợp cho ngân hàng, bệnh viện, trung tâm thương mại.',
    stock: 2, soldCount: 5,
    attributes: [{ key: 'Loại', value: 'Robot dịch vụ thương mại' }, { key: 'Navigation', value: 'U-SLAM, bản đồ đến 10.000 sqft' }, { key: 'AI', value: 'Nhận diện khuôn mặt, giọng nói, vật thể' }, { key: 'Ứng dụng', value: 'Ngân hàng, bệnh viện, TTTM, sân bay' }, { key: 'Tính năng', value: 'Video call, control center tập trung' }],
    tags: ['robot', 'cruzr', 'thương mại', 'dịch vụ', 'humanoid'],
  },
  {
    name: 'ADIBOT',
    basePrice: 460000000,
    images: [
      { url: 'https://mms.businesswire.com/media/20220104005441/en/1317723/5/ADIBOT-A_operating_room.jpg?download=1', isPrimary: true },
      { url: `https://www.schoolspecialty.com/wcsstore/SSIB2BStorefrontAssetStore/images/cleaning-facility-supplies/2021/ADIBOT/ADIBOT-S.png` },
      { url: `https://lh3.googleusercontent.com/d/1DjLRnfvrdrMHryqd6-sBJ9xQc4f1uGEz` },
      { url: `https://ubtechvietnam.edu.vn/www.ubtechvietnam.com/wp-content/uploads/2021/03/Adibot_21.png` },
    ],
    description: 'ADIBOT-A: Robot tự hành hoàn toàn, được trang bị 16 đèn UV-C không tạo ozone, cảm biến LiDAR kép, camera AI, cảm biến hồng ngoại và công nghệ định vị UWB. Robot khử khuẩn tự động thế hệ mới — hoạt động không cần người giám sát, phù hợp bệnh viện, khách sạn, văn phòng lớn.',
    stock: 3, soldCount: 7,
    attributes: [{ key: 'Loại', value: 'Robot khử khuẩn tự hành' }, { key: 'Công nghệ UV-C', value: '16 đèn UV-C, không tạo ozone' }, { key: 'Hiệu quả', value: 'Vô hiệu hoá 99.9% mầm bệnh' }, { key: 'Cảm biến', value: 'LiDAR kép, Camera AI, PIR, UWB' }, { key: 'Ứng dụng', value: 'Bệnh viện, khách sạn, trường học, văn phòng' }],
    tags: ['robot', 'adibot', 'khử khuẩn', 'uv-c', 'tự hành', 'y tế'],
  },
  // ── MỚI THÊM: Alpha 1E ──────────────────────────────────────
  {
    name: 'Alpha 1E',
    basePrice: 14990000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Alpha_1E_08.png', isPrimary: true },
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Alpha_1E_04.jpg' },
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Alpha_1E_02.jpg' },
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Alpha_1E_03.jpg' },
      { url: 'https://lh3.googleusercontent.com/d/1ZQfOilItslY3d5U_NPNvVLIqeYnMFiVO' },
    ],
    description: 'Alpha 1E là robot hình người giáo dục 16 bậc tự do, được thiết kế tối ưu cho học sinh K-12 tiếp cận STEM và lập trình. Với chiều cao 40.5 cm, kết nối WiFi và Bluetooth, Alpha 1E hỗ trợ lập trình Blockly, Python và Scratch qua ứng dụng Alpha Robot App. Đây là người bạn học tập lý tưởng trong các chương trình giáo dục robot cấp cơ sở.',
    stock: 15, isFeatured: true, soldCount: 22,
    attributes: [
      { key: 'Chiều cao', value: '40.5 cm' },
      { key: 'Servo', value: '16 DoF (bậc tự do)' },
      { key: 'Lập trình', value: 'Blockly, Python, Scratch' },
      { key: 'Kết nối', value: 'WiFi, Bluetooth' },
      { key: 'Đối tượng', value: 'K-12 (6-18 tuổi)' },
      { key: 'App', value: 'Alpha Robot App' },
    ],
    tags: ['robot', 'alpha 1e', 'humanoid', 'giáo dục', 'stem', 'k12', 'blockly'],
  },
  // ── MỚI THÊM: Walker S1 ─────────────────────────────────────
  {
    name: 'Walker S1',
    basePrice: 2500000000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/1AHPKshfGisAH8dalBPe6L5_CeX7OqYf-', isPrimary: true },
      { url: 'https://lh3.googleusercontent.com/d/1SEj7W9nXw8Axw8MUv8-z2Wk-9PhTPtpq' },
      { url: 'https://www.robotseuropa.com/media/catalog/product/cache/207e23213cf636ccdef205098cf3c8a3/u/b/ubtech-walker-s2-humanoid-back.jpg' },
    ],
    description: 'Walker S1 là robot hình người công nghiệp tiên tiến với 36 bậc tự do, chiều cao 145 cm và trọng lượng 77 kg. Được trang bị AI nhận thức không gian 3D qua công nghệ U-SLAM độc quyền, Walker S1 có khả năng đi bộ, leo cầu thang, cầm nắm vật thể và thực hiện các nhiệm vụ phức tạp trên dây chuyền sản xuất EV. Là robot hình người hai chân đầu tiên hoàn thành nhiệm vụ cụ thể trên dây chuyền sản xuất ô tô điện.',
    stock: 1, soldCount: 2,
    attributes: [
      { key: 'Chiều cao', value: '145 cm' },
      { key: 'Trọng lượng', value: '77 kg' },
      { key: 'DoF', value: '36 bậc tự do' },
      { key: 'AI', value: 'U-SLAM, nhận thức không gian 3D' },
      { key: 'Ứng dụng', value: 'Công nghiệp, sản xuất ô tô điện' },
      { key: 'Khả năng', value: 'Đi bộ, leo cầu thang, cầm nắm' },
    ],
    tags: ['robot', 'walker s1', 'humanoid', 'công nghiệp', 'ai', 'u-slam'],
  },
  // ── MỚI THÊM: Walker E ──────────────────────────────────────
  {
    name: 'Walker E',
    basePrice: 1800000000,
    images: [
      { url: 'https://owebsite-cdn.ubtrobot.com/resources/image/2025/07/23/700878425129029.jpg?image_process=format,webp/quality,Q_80', isPrimary: true },
      { url: 'https://www.robotsasia.com/pub/media/catalog/product/u/b/ubtech-walker-tienkung-embodied-intelligence-5.jpg' },
    ],
    description: 'Walker E là robot hình người thế hệ mới với 36 bậc tự do, khả năng nhận diện cảm xúc và tương tác tự nhiên như người thật. Được thiết kế cho các ứng dụng dịch vụ cao cấp như tiếp tân, triển lãm, và chăm sóc khách hàng, Walker E tích hợp AI đa cảm giác tiên tiến giúp mang lại trải nghiệm tương tác độc đáo với con người.',
    stock: 1, soldCount: 1,
    attributes: [
      { key: 'DoF', value: '36 bậc tự do' },
      { key: 'AI', value: 'Nhận diện cảm xúc, tương tác đa phương thức' },
      { key: 'Ứng dụng', value: 'Dịch vụ cao cấp, triển lãm, tiếp tân' },
      { key: 'Tính năng', value: 'Biểu đạt cảm xúc, giao tiếp tự nhiên' },
    ],
    tags: ['robot', 'walker e', 'humanoid', 'dịch vụ', 'cảm xúc', 'ai'],
  },
];

const KITS = [
  {
    name: 'AI FANTASY ZOO',
    basePrice: 8990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FekyybqvXMnb1dnFhjKNFG06H_cOYNf', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/uKit_Fantasy_Zoo_01.jpg` },
    ],
    description: 'Khóa học này áp dụng phương pháp làm việc nhóm để giúp học viên khám phá các phương pháp xây dựng các mô hình động vật khác nhau và có được kiến thức lập trình cơ bản để mô phỏng hành vi và cách thức của các loài động vật khác nhau. Một mặt, nó giúp học sinh hiểu sự việc và giải quyết vấn đề từ nhiều chiều. Mặt khác, nó củng cố khả năng giao tiếp, diễn đạt và chia sẻ của học sinh.',
    stock: 20, isFeatured: true, soldCount: 55,
    attributes: [{ key: 'Cấp độ', value: 'K1-K3 (6-9 tuổi)' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT & Bộ KH&CN' }, { key: 'Kỹ năng', value: 'Lập trình Blockly, làm việc nhóm' }],
    tags: ['ukit', 'kit', 'ai', 'fantasy zoo', 'k1-k3', 'stem'],
  },
  {
    name: 'AI SMART LIFE',
    basePrice: 20990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FekyybqvXMnb1dnFhjKNFG06H_cOYNf', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/uKit_Smart_Life_01.jpg` },
    ],
    description: 'Khóa học giúp học viên hiểu nguyên lý và ứng dụng của các loại cảm biến thông dụng qua hoạt động nhóm và các dự án thực tế như thùng rác, khu vườn hay xe quét rác thông minh. Qua đó, học viên phát triển tư duy sáng tạo, kỹ năng hợp tác, giao tiếp và duy trì niềm đam mê với trí tuệ nhân tạo.',
    stock: 15, isFeatured: true, soldCount: 32,
    attributes: [{ key: 'Cấp độ', value: 'K4-K6 (9-12 tuổi)' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT & Bộ KH&CN' }, { key: 'Dự án', value: 'Thùng rác, khu vườn, xe quét rác thông minh' }],
    tags: ['ukit', 'kit', 'ai', 'smart life', 'k4-k6', 'cảm biến', 'iot'],
  },
  {
    name: 'AI MAGIC WORLD',
    basePrice: 9490000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FekyybqvXMnb1dnFhjKNFG06H_cOYNf', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/uKit_Magic_World_01.jpg` },
    ],
    description: 'Khóa học giúp sinh viên làm quen với uCode để thiết kế hoạt hình, trò chơi và lập trình phần cứng thông minh. Qua quá trình viết mã và tương tác với cảm biến, học viên phát triển tư duy thuật toán, kỹ năng thực hành, khả năng sáng tạo và giải quyết vấn đề, từ đó nâng cao hứng thú với trí tuệ nhân tạo.',
    stock: 18, soldCount: 28,
    attributes: [{ key: 'Cấp độ', value: 'K3-K5 (8-11 tuổi)' }, { key: 'Phần mềm', value: 'uCode' }, { key: 'Kỹ năng', value: 'Lập trình game, thiết kế hoạt hình' }],
    tags: ['ukit', 'kit', 'ai', 'magic world', 'ucode', 'k3-k5'],
  },
  {
    name: 'AI TRANSFORMER WORKSHOP',
    basePrice: 28990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FekyybqvXMnb1dnFhjKNFG06H_cOYNf', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/uKit_Transformer_Workshop_01.jpg` },
    ],
    description: 'Khóa học giúp học sinh khám phá hiện tượng thực tế qua việc xây dựng mô hình như bảng quảng cáo chuyển đổi, robot tấn công, hay hệ thống cảnh báo. Bằng cách sử dụng các cảm biến và linh kiện điện tử, học sinh hiện thực hóa ý tưởng thành mô hình thực tế, phát triển tư duy đổi mới, kỹ năng giải quyết vấn đề và khả năng lập trình ứng dụng vào cuộc sống.',
    stock: 10, isFeatured: true, soldCount: 18,
    attributes: [{ key: 'Cấp độ', value: 'K7-K9 (12-15 tuổi)' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT & Bộ KH&CN' }, { key: 'Kỹ năng', value: 'Điện tử, lập trình nâng cao' }],
    tags: ['ukit', 'kit', 'ai', 'transformer', 'k7-k9', 'nâng cao'],
  },
  {
    name: 'AI SUPER ASISTANT',
    basePrice: 9990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FekyybqvXMnb1dnFhjKNFG06H_cOYNf', isPrimary: true },
      { url: `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzEn2W-6YwWvh4c8rKX_Bq6xSIXs8Zvf4vNw&s` },
    ],
    description: 'Khóa học sử dụng robot hình người Alpha Mini kết hợp lập trình đồ họa và phần cứng nguồn mở, giúp học sinh tiểu học tiếp cận kiến thức STEM theo phương pháp dự án sáng tạo. Học sinh phát triển tư duy logic, kỹ năng lập trình và khả năng giải quyết vấn đề thực tế.',
    stock: 12, soldCount: 22,
    attributes: [{ key: 'Cấp độ', value: 'K5-K8 (10-14 tuổi)' }, { key: 'Robot', value: 'Alpha Mini' }, { key: 'Phương pháp', value: 'Project-based Learning' }],
    tags: ['ukit', 'kit', 'ai', 'super assistant', 'alpha mini', 'k5-k8'],
  },
  {
    name: 'AI SUPER ENGINEER',
    basePrice: 25990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FekyybqvXMnb1dnFhjKNFG06H_cOYNf', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/uKit_Super_Engineer_01.jpg` },
    ],
    description: 'Khóa học giúp học sinh phát triển AI một cách chủ động thông qua nghiên cứu khoa học và các dự án thực tế trong lĩnh vực nông nghiệp, công nghiệp và robot. Qua đó, học sinh vận dụng kiến thức AI vào cuộc sống, nâng cao tư duy phản biện và kỹ năng thiết kế kỹ thuật.',
    stock: 8, isFeatured: true, soldCount: 15,
    attributes: [{ key: 'Cấp độ', value: 'K9-K12 (14-18 tuổi)' }, { key: 'Lĩnh vực', value: 'Nông nghiệp, công nghiệp, robot' }, { key: 'Kỹ năng', value: 'AI, nghiên cứu khoa học' }],
    tags: ['ukit', 'kit', 'ai', 'super engineer', 'k9-k12', 'nghiên cứu'],
  },
  // ── MỚI THÊM: Courtbot Kit ──────────────────────────────────
  {
    name: 'COURTBOT KIT',
    basePrice: 3590000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/www.ubtechvietnam.com/wp-content/uploads/2021/03/CourtBot_03.jpg', isPrimary: true },
      { url: 'https://lh3.googleusercontent.com/d/1GjW_zAWyPNv2S9lgQPOeanmXYGUqLASd' },
      { url: 'https://ubtechvietnam.edu.vn/www.ubtechvietnam.com/wp-content/uploads/2021/03/CourtBot_08.png' },
    ],
    description: 'COURTBOT KIT cho phép học sinh tự tay lắp ráp và lập trình một robot bóng rổ thực thụ. Bộ kit tích hợp hơn 200 linh kiện, kết hợp kiến thức vật lý, toán học và lập trình thông qua trò chơi thể thao. Học sinh điều khiển robot qua ứng dụng JIMU App với lập trình Blockly, phát triển tư duy kỹ thuật và kỹ năng giải quyết vấn đề sáng tạo.',
    stock: 35, isFeatured: true, soldCount: 47,
    attributes: [
      { key: 'Đối tượng', value: '8-14 tuổi' },
      { key: 'Số linh kiện', value: '200+ linh kiện' },
      { key: 'Lập trình', value: 'JIMU App, Blockly' },
      { key: 'Kết nối', value: 'Bluetooth' },
      { key: 'Kỹ năng', value: 'Vật lý, toán học, lập trình' },
    ],
    tags: ['robot', 'jimu', 'courtbot', 'bóng rổ', 'stem', 'lắp ráp'],
  },
  // ── MỚI THÊM: Astrobot Kit ──────────────────────────────────
  {
    name: 'ASTROBOT KIT',
    basePrice: 4990000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Astrobot_02.jpg', isPrimary: true },
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Astrobot_01.jpg' },
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Astrobot_03.jpg' },
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/03/Astrobot_07.jpg' },
    ],
    description: 'ASTROBOT KIT mang đến trải nghiệm xây dựng robot phi hành gia đầy sáng tạo. Bộ kit gồm hơn 300 linh kiện với cảm biến con quay hồi chuyển và gia tốc kế, cho phép lập trình qua JIMU App (Blockly) và Python. Học sinh phát triển tư duy STEM K-8, tìm hiểu khoa học vũ trụ qua lập trình và chế tạo thực tế.',
    stock: 28, isFeatured: true, soldCount: 38,
    attributes: [
      { key: 'Đối tượng', value: '8-14 tuổi (STEM K-8)' },
      { key: 'Số linh kiện', value: '300+ linh kiện' },
      { key: 'Cảm biến', value: 'Con quay hồi chuyển, gia tốc kế' },
      { key: 'Lập trình', value: 'JIMU App, Blockly, Python' },
      { key: 'Kết nối', value: 'Bluetooth' },
    ],
    tags: ['robot', 'jimu', 'astrobot', 'vũ trụ', 'stem', 'lắp ráp', 'python'],
  },
  // ── MỚI THÊM: AI Super Designer (bộ kit) ───────────────────
  {
    name: 'AI SUPER DESIGNER',
    basePrice: 22990000,
    images: [
      { url: 'https://lh3.googleusercontent.com/d/12FekyybqvXMnb1dnFhjKNFG06H_cOYNf', isPrimary: true },
      { url: `https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/uKit_Super_Engineer_01.jpg` },
    ],
    description: 'Khóa học AI Super Designer đặt học sinh vào vai kỹ sư AI, thiết kế các hệ thống thông minh ứng dụng trong nông nghiệp và công nghiệp. Thông qua các dự án thực tế, học sinh phát triển kỹ năng thiết kế hệ thống AI, lập trình nâng cao và tư duy kỹ thuật. Phù hợp cho học sinh K8-K10 với nền tảng lập trình cơ bản.',
    stock: 10, soldCount: 12,
    attributes: [
      { key: 'Cấp độ', value: 'K8-K10 (13-16 tuổi)' },
      { key: 'Kỹ năng', value: 'Thiết kế hệ thống AI, lập trình nâng cao' },
      { key: 'Lĩnh vực', value: 'Nông nghiệp thông minh, công nghiệp' },
      { key: 'Chứng nhận', value: 'Bộ GD&ĐT & Bộ KH&CN' },
    ],
    tags: ['ukit', 'kit', 'ai', 'super designer', 'k8-k10', 'thiết kế'],
  },
];

// ════════════════════════════════════════════════════════
// SÁCH — ảnh PRIMARY lấy từ s4h.edu.vn (webp, nền tròn đẹp)
//        ảnh gallery phụ giữ từ ubtechvietnam.edu.vn
// ════════════════════════════════════════════════════════
const BOOKS = [
  {
    name: 'AI FANTASY ZOO 1',
    basePrice: 210000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/Book_Fantasy_Zoo_06.png', isPrimary: true },
    ],
    description: 'Sách giáo trình AI Fantasy Zoo Tập 1 giúp học viên làm việc nhóm để xây dựng mô hình và lập trình mô phỏng hành vi động vật, qua đó phát triển tư duy đa chiều, kỹ năng giải quyết vấn đề, giao tiếp và chia sẻ.',
    stock: 200, soldCount: 320,
    attributes: [{ key: 'Cấp độ', value: 'K1-K3' }, { key: 'Tập', value: 'Tập 1' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'fantasy zoo', 'k1', 'k2', 'k3'],
  },
  {
    name: 'AI FANTASY ZOO 2',
    basePrice: 210000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/Book_Fantasy_Zoo_05.png', isPrimary: true },
    ],
    description: 'Sách giáo trình AI Fantasy Zoo Tập 2 tiếp tục hành trình khám phá thế giới động vật qua lập trình AI. Học viên nâng cao kỹ năng và xây dựng các mô hình phức tạp hơn.',
    stock: 200, soldCount: 290,
    attributes: [{ key: 'Cấp độ', value: 'K1-K3' }, { key: 'Tập', value: 'Tập 2' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'fantasy zoo', 'k1', 'k2', 'k3'],
  },
  {
    name: 'AI SMART LIFE 1',
    basePrice: 210000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/Book_Smart_Life_06-600x769.png', isPrimary: true },
    ],
    description: 'Sách giáo trình AI Smart Life Tập 1 giúp học viên hiểu nguyên lý và ứng dụng của các loại cảm biến thông dụng thông qua làm việc nhóm và thực hiện các dự án như thùng rác, khu vườn, xe quét rác thông minh.',
    stock: 180, soldCount: 270,
    attributes: [{ key: 'Cấp độ', value: 'K4-K6' }, { key: 'Tập', value: 'Tập 1' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'smart life', 'k4', 'k5', 'k6'],
  },
  {
    name: 'AI SMART LIFE 2',
    basePrice: 210000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/Book_Smart_Life_05-600x769.png', isPrimary: true },
    ],
    description: 'Sách giáo trình AI Smart Life Tập 2 nâng cao kiến thức về cảm biến và IoT. Học viên thực hiện các dự án thực tế phức tạp hơn, ứng dụng AI vào đời sống.',
    stock: 180, soldCount: 240,
    attributes: [{ key: 'Cấp độ', value: 'K4-K6' }, { key: 'Tập', value: 'Tập 2' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'smart life', 'k4', 'k5', 'k6'],
  },
  {
    name: 'SÁCH AI MAGIC WORLD',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-MAGIC-WORLD-1-1.webp', isPrimary: true },
    ],
    description: 'Sách giáo trình AI Magic World giúp học sinh phát triển AI một cách độc lập thông qua nghiên cứu khoa học và các dự án thực tế trong nông nghiệp, công nghiệp, robot.',
    stock: 160, soldCount: 215,
    attributes: [{ key: 'Cấp độ', value: 'K3-K5' }, { key: 'Phần mềm', value: 'uCode' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'magic world', 'k3', 'k4', 'k5'],
  },
  {
    name: 'AI TRANSFORMER WORKSHOP 1',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-TRANSFORMER-WORKSHOP-1.webp', isPrimary: true },
    ],
    description: 'Học sinh phát triển AI độc lập thông qua nghiên cứu khoa học và các dự án thực tế trong nông nghiệp, công nghiệp và robot. Qua đó, các em hiểu nguyên lý hoạt động của cảm biến và ứng dụng trong cuộc sống.',
    stock: 150, soldCount: 198,
    attributes: [{ key: 'Cấp độ', value: 'K7-K9' }, { key: 'Tập', value: 'Tập 1' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'transformer', 'k7', 'k8', 'k9'],
  },
  {
    name: 'AI TRANSFORMER WORKSHOP 2',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-TRANSFORMER-WORKSHOP-2.webp', isPrimary: true },
    ],
    description: 'Tiếp tục chương trình AI Transformer Workshop, học sinh nâng cao kỹ năng lập trình và điện tử. Xây dựng các hệ thống thông minh phức tạp hơn và ứng dụng AI vào thực tiễn.',
    stock: 150, soldCount: 172,
    attributes: [{ key: 'Cấp độ', value: 'K7-K9' }, { key: 'Tập', value: 'Tập 2' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'transformer', 'k7', 'k8', 'k9'],
  },
  {
    name: 'AI SUPER ASISTANT 1',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-Super-Assistant-1-1.webp', isPrimary: true },
    ],
    description: 'Khóa học sử dụng robot hình người Alpha Mini kết hợp lập trình đồ họa và phần cứng nguồn mở, giúp học sinh tiểu học tiếp cận kiến thức STEM thông qua phương pháp dự án sáng tạo.',
    stock: 120, soldCount: 155,
    attributes: [{ key: 'Cấp độ', value: 'K5-K8' }, { key: 'Tập', value: 'Tập 1' }, { key: 'Robot', value: 'Alpha Mini' }],
    tags: ['sách', 'giáo trình', 'ai', 'super assistant', 'k5', 'k6', 'k7', 'k8'],
  },
  {
    name: 'AI SUPER ASISTANT 2',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-Super-Assistan-2-1.webp', isPrimary: true },
    ],
    description: 'Tiếp tục chương trình AI Super Assistant, học sinh nâng cao kỹ năng lập trình với Alpha Mini và thực hiện các dự án STEM phức tạp hơn.',
    stock: 120, soldCount: 138,
    attributes: [{ key: 'Cấp độ', value: 'K5-K8' }, { key: 'Tập', value: 'Tập 2' }, { key: 'Robot', value: 'Alpha Mini' }],
    tags: ['sách', 'giáo trình', 'ai', 'super assistant', 'k5', 'k6', 'k7', 'k8'],
  },
  {
    name: 'AI SUPER DESIGNER 1',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-SUPER-DESIGNER-1.webp', isPrimary: true },
    ],
    description: 'Học sinh chủ động khám phá và phát triển AI thông qua các dự án thực tế trong nông nghiệp và công nghiệp, đóng vai kỹ sư để tìm hiểu nguyên lý hoạt động của các hệ thống thông minh.',
    stock: 100, soldCount: 120,
    attributes: [{ key: 'Cấp độ', value: 'K8-K10' }, { key: 'Tập', value: 'Tập 1' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'super designer', 'k8', 'k9', 'k10'],
  },
  {
    name: 'AI SUPER DESIGNER 2',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-SUPER-DESIGNER-2.webp', isPrimary: true },
    ],
    description: 'Tiếp tục hành trình khám phá AI với vai trò kỹ sư. Học sinh nâng cao kỹ năng thiết kế hệ thống thông minh và ứng dụng AI trong các ngành công nghiệp.',
    stock: 100, soldCount: 105,
    attributes: [{ key: 'Cấp độ', value: 'K8-K10' }, { key: 'Tập', value: 'Tập 2' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'super designer', 'k8', 'k9', 'k10'],
  },
  {
    name: 'AI SUPER ENGINEER 1',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-SuperEngineer-1.webp', isPrimary: true },
    ],
    description: 'Sách giáo trình AI Super Engineer Tập 1 giúp học sinh phát triển AI một cách chủ động thông qua nghiên cứu khoa học và các dự án thực tế trong nông nghiệp, công nghiệp và robot.',
    stock: 110, soldCount: 145,
    attributes: [{ key: 'Cấp độ', value: 'K9-K12' }, { key: 'Tập', value: 'Tập 1' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'super engineer', 'k9', 'k10', 'k11', 'k12'],
  },
  {
    name: 'AI SUPER ENGINEER 2',
    basePrice: 210000,
    images: [
      { url: 'https://s4h.edu.vn/wp-content/uploads/2024/01/AI-Super-Engineer-2.webp', isPrimary: true },
    ],
    description: 'Sách giáo trình AI Super Engineer Tập 2 tiếp tục nâng cao kỹ năng thiết kế và lập trình AI. Học sinh thực hiện các dự án phức tạp hơn và ứng dụng AI trong nhiều lĩnh vực.',
    stock: 110, soldCount: 130,
    attributes: [{ key: 'Cấp độ', value: 'K9-K12' }, { key: 'Tập', value: 'Tập 2' }, { key: 'Chứng nhận', value: 'Bộ GD&ĐT' }],
    tags: ['sách', 'giáo trình', 'ai', 'super engineer', 'k9', 'k10', 'k11', 'k12'],
  },
  {
    name: 'AI APPLICATION & EXPLORATION 1',
    basePrice: 210000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/Book_AppExploration_05.png', isPrimary: true },
    ],
    description: 'Khóa học giúp học sinh hiểu nguyên lý và ứng dụng thực tế của AI trong đời sống, từ đó mở rộng tư duy, tầm nhìn và định hướng nhận thức đúng đắn về vai trò của AI trong xã hội hiện đại.',
    stock: 90, soldCount: 88,
    attributes: [{ key: 'Cấp độ', value: 'K10-K12' }, { key: 'Tập', value: 'Tập 1' }, { key: 'Chứng nhận', value: 'Bộ KH&CN' }],
    tags: ['sách', 'giáo trình', 'ai', 'application', 'k10', 'k11', 'k12'],
  },
  {
    name: 'AI APPLICATION & EXPLORATION 2',
    basePrice: 210000,
    images: [
      { url: 'https://ubtechvietnam.edu.vn/wp-content/uploads/2021/04/Book_AppExploration_04-600x769.png', isPrimary: true },
    ],
    description: 'Tiếp tục chương trình AI Application & Exploration, học sinh nâng cao hiểu biết về ứng dụng AI trong các lĩnh vực như y tế, giáo dục, kinh doanh và đưa ra những phân tích sâu sắc.',
    stock: 90, soldCount: 75,
    attributes: [{ key: 'Cấp độ', value: 'K10-K12' }, { key: 'Tập', value: 'Tập 2' }, { key: 'Chứng nhận', value: 'Bộ KH&CN' }],
    tags: ['sách', 'giáo trình', 'ai', 'application', 'k10', 'k11', 'k12'],
  },
];

const COUPONS = [
  { code: 'WELCOME10', description: 'Giảm 10% đơn đầu tiên (tối đa 500.000đ)', discountType: 'percent', discountValue: 10, maxDiscount: 500000, minOrderValue: 200000, startDate: new Date('2024-01-01'), endDate: new Date('2027-12-31'), maxUsage: 1000, isActive: true },
  { code: 'UBTECH500', description: 'Giảm 500.000đ cho đơn từ 5 triệu', discountType: 'fixed', discountValue: 500000, minOrderValue: 5000000, startDate: new Date('2024-01-01'), endDate: new Date('2027-12-31'), maxUsage: 500, isActive: true },
  { code: 'STEM2025', description: 'Giảm 15% cho sản phẩm giáo dục STEM (tối đa 2.000.000đ)', discountType: 'percent', discountValue: 15, maxDiscount: 2000000, minOrderValue: 1000000, startDate: new Date('2024-01-01'), endDate: new Date('2027-12-31'), maxUsage: 200, isActive: true },
  { code: 'FREESHIP', description: 'Miễn phí vận chuyển', discountType: 'fixed', discountValue: 30000, minOrderValue: 100000, startDate: new Date('2024-01-01'), endDate: new Date('2027-12-31'), maxUsage: 2000, isActive: true },
];

// ════════════════════════════════════════════════════════
// MAIN SEED
// ════════════════════════════════════════════════════════
async function seed() {
  try {
    console.log('🔌 Kết nối MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[OK] Đã kết nối\n');

    console.log('🗑️  Xóa dữ liệu cũ...');
    await Category.deleteMany({ type: 'product' });
    await Product.deleteMany({});
    await Coupon.deleteMany({});
    console.log('[OK] Đã xóa\n');

    console.log('📁 Tạo categories...');
    const cats = await Category.insertMany([
      { name: 'Robot',   slug: 'robot',  type: 'product', order: 1, isActive: true, isDeleted: false },
      { name: 'Bộ Kit',  slug: 'bo-kit', type: 'product', order: 2, isActive: true, isDeleted: false },
      { name: 'Sách',    slug: 'sach',   type: 'product', order: 3, isActive: true, isDeleted: false },
    ]);
    const catMap = {};
    cats.forEach(c => { catMap[c.slug] = c._id; });
    console.log('[OK] 3 categories\n');

    // ── makeDoc: dùng data.images[] thay vì data.image ──────
    const makeDoc = (data, catSlug) => ({
      name:        data.name,
      slug:        toSlug(data.name),
      category:    catMap[catSlug],
      brand:       'UBTECH',
      shortDesc:   data.description.substring(0, 300),
      description: data.description,
      // Dùng images[] thật từ web; mỗi item có { url, isPrimary?, alt? }
      images: data.images.map((img, idx) => ({
        url:       img.url,
        alt:       img.alt || data.name,
        isPrimary: img.isPrimary || idx === 0,
      })),
      basePrice:   data.basePrice,
      salePrice:   data.salePrice || null,
      stock:       data.stock,
      attributes:  data.attributes,
      tags:        data.tags,
      isFeatured:  data.isFeatured || false,
      soldCount:   data.soldCount || 0,
      status:      'active',
      isDeleted:   false,
    });

    console.log('[SEED] Tạo robots...');
    await Product.insertMany(ROBOTS.map(r => makeDoc(r, 'robot')));
    console.log(`[OK] ${ROBOTS.length} robots\n`);

    console.log('🔧 Tạo bộ kit...');
    await Product.insertMany(KITS.map(k => makeDoc(k, 'bo-kit')));
    console.log(`[OK] ${KITS.length} bộ kit\n`);

    console.log('📚 Tạo sách...');
    await Product.insertMany(BOOKS.map(b => makeDoc(b, 'sach')));
    console.log(`[OK] ${BOOKS.length} sách\n`);

    console.log('🎟️  Tạo coupons...');
    await Coupon.insertMany(COUPONS);
    console.log(`[OK] ${COUPONS.length} coupons\n`);

    const adminExists = await User.findOne({ email: 'admin@ecommerce.vn' });
    if (!adminExists) {
      await User.create({ name: 'Admin UBTECH', email: 'admin@ecommerce.vn', password: 'Admin@123456', role: 'admin', phone: '0973212834', isActive: true });
      console.log('[OK] Tạo admin: admin@ecommerce.vn / Admin@123456');
    }
    const customerExists = await User.findOne({ email: 'khachhang@gmail.com' });
    if (!customerExists) {
      await User.create({ name: 'Nguyễn Văn An', email: 'khachhang@gmail.com', password: 'Customer@123', role: 'customer', phone: '0909123456', isActive: true });
      console.log('[OK] Tạo customer: khachhang@gmail.com / Customer@123');
    }

    const total = await Product.countDocuments();
    console.log('\n══════════════════════════════════════');
    console.log('[DONE] SEED HOÀN TẤT!');
    console.log(`📦 ${total} sản phẩm (${ROBOTS.length} robot, ${KITS.length} kit, ${BOOKS.length} sách)`);
    console.log('🖼️  Ảnh sách (isPrimary): lấy từ s4h.edu.vn (webp, nền tròn đẹp)');
    console.log('🖼️  Ảnh gallery phụ: lấy từ ubtechvietnam.edu.vn');
    console.log('🎟️  Coupon: WELCOME10, UBTECH500, STEM2025, FREESHIP');
    console.log('══════════════════════════════════════');

  } catch (err) {
    console.error('[ERROR] Seed error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();