// controllers/product.controller.js
const Product  = require('../models/Product');
const Category = require('../models/Category');

// ════════════════════════════════════════════════════
// LẤY DANH SÁCH SẢN PHẨM
// GET /api/products
//
// Query params hỗ trợ:
//   ?page=1          phân trang (mặc định trang 1)
//   ?limit=12        số SP mỗi trang (mặc định 12)
//   ?category=slug   lọc theo danh mục (dùng slug)
//   ?brand=Apple     lọc theo thương hiệu
//   ?minPrice=1000   giá tối thiểu
//   ?maxPrice=50000  giá tối đa
//   ?search=iphone   tìm kiếm text
//   ?sort=price_asc  sắp xếp (price_asc, price_desc, newest, bestsell, rating)
//   ?featured=true   chỉ lấy sản phẩm nổi bật
// ════════════════════════════════════════════════════
const getProducts = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 12,
      category,
      brand,
      minPrice,
      maxPrice,
      search,
      sort     = 'newest',
      featured,
    } = req.query;

    // ── Xây dựng điều kiện lọc ─────────────────────
    const filter = {
      status: 'active',
      isDeleted: false,
    };

    // Lọc theo danh mục (truyền slug)
    if (category) {
      const cat = await Category.findOne({ slug: category, type: 'product' });
      if (cat) filter.category = cat._id;
    }

    // Lọc theo thương hiệu
    if (brand) {
      filter.brand = { $regex: brand, $options: 'i' }; // không phân biệt hoa thường
    }

    // Lọc theo khoảng giá
    if (minPrice || maxPrice) {
      filter.$or = [
        // SP không có variant
        {
          basePrice: {
            ...(minPrice && { $gte: Number(minPrice) }),
            ...(maxPrice && { $lte: Number(maxPrice) }),
          },
        },
        // SP có variant
        {
          'variants.price': {
            ...(minPrice && { $gte: Number(minPrice) }),
            ...(maxPrice && { $lte: Number(maxPrice) }),
          },
        },
      ];
    }

    // Lọc sản phẩm nổi bật
    if (featured === 'true') {
      filter.isFeatured = true;
    }

    // Tìm kiếm text
    if (search) {
      filter.$text = { $search: search };
    }

    // ── Sắp xếp ────────────────────────────────────
    const sortMap = {
      price_asc:  { basePrice: 1 },
      price_desc: { basePrice: -1 },
      newest:     { createdAt: -1 },
      bestsell:   { soldCount: -1 },
      rating:     { ratingAvg: -1 },
    };
    const sortOption = sortMap[sort] || { createdAt: -1 };

    // ── Phân trang ──────────────────────────────────
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit))); // tối đa 50/trang
    const skip     = (pageNum - 1) * limitNum;

    // ── Chạy query song song để tối ưu tốc độ ──────
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('name slug images basePrice salePrice ratingAvg ratingCount soldCount brand isFeatured variants status') // chỉ lấy field cần cho danh sách
        .populate('category', 'name slug') // lấy thêm tên danh mục
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(), // .lean() nhanh hơn ~30% vì không tạo Mongoose document object
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext:    pageNum < Math.ceil(total / limitNum),
        hasPrev:    pageNum > 1,
      },
    });

  } catch (err) {
    console.error('getProducts error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// LẤY CHI TIẾT SẢN PHẨM
// GET /api/products/:slug
// ════════════════════════════════════════════════════
const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({
      slug,
      status: 'active',
      isDeleted: false,
    })
      .populate('category', 'name slug') // lấy tên danh mục
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm',
      });
    }

    // Tăng viewCount (không cần await – chạy ngầm cho nhanh)
    Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } }).exec();

    res.json({
      success: true,
      data: product,
    });

  } catch (err) {
    console.error('getProductBySlug error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// LẤY SẢN PHẨM NỔI BẬT (dùng cho trang chủ)
// GET /api/products/featured
// ════════════════════════════════════════════════════
const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({
      isFeatured: true,
      status: 'active',
      isDeleted: false,
    })
      .select('name slug images basePrice salePrice ratingAvg soldCount brand variants')
      .populate('category', 'name slug')
      .sort({ soldCount: -1 })
      .limit(8)
      .lean();

    res.json({ success: true, data: products });

  } catch (err) {
    console.error('getFeaturedProducts error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// LẤY SẢN PHẨM LIÊN QUAN
// GET /api/products/:slug/related
// ════════════════════════════════════════════════════
const getRelatedProducts = async (req, res) => {
  try {
    const { slug } = req.params;

    // Tìm sản phẩm hiện tại để lấy category
    const current = await Product.findOne({ slug }).select('category _id').lean();
    if (!current) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    // Lấy SP cùng danh mục, trừ SP hiện tại
    const related = await Product.find({
      category:  current.category,
      _id:       { $ne: current._id }, // loại trừ SP hiện tại
      status:    'active',
      isDeleted: false,
    })
      .select('name slug images basePrice salePrice ratingAvg soldCount variants')
      .sort({ soldCount: -1 })
      .limit(6)
      .lean();

    res.json({ success: true, data: related });

  } catch (err) {
    console.error('getRelatedProducts error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] TẠO SẢN PHẨM MỚI
// POST /api/products
// Cần role: admin
// ════════════════════════════════════════════════════
const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm thành công',
      data: product,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Slug đã tồn tại, hãy dùng slug khác' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('createProduct error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] CẬP NHẬT SẢN PHẨM
// PUT /api/products/:id
// Cần role: admin
// ════════════════════════════════════════════════════
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // new:true → trả về document sau update
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    res.json({ success: true, message: 'Cập nhật thành công', data: product });

  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] XÓA MỀM SẢN PHẨM (soft delete)
// DELETE /api/products/:id
// Cần role: admin
// ════════════════════════════════════════════════════
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, status: 'inactive' },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    res.json({ success: true, message: 'Đã xóa sản phẩm' });

  } catch (err) {
    console.error('deleteProduct error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// [ADMIN] LẤY TẤT CẢ SẢN PHẨM (kể cả inactive/draft)
// GET /api/products/admin/all
// ════════════════════════════════════════════════════
const getAdminProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (search) filter.$text = { $search: search };

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Number(limit));

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('name slug status basePrice salePrice stock soldCount ratingAvg isFeatured createdAt variants')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (err) {
    console.error('getAdminProducts error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// LẤY DANH MỤC SẢN PHẨM (dùng cho menu, filter)
// GET /api/products/categories
// ════════════════════════════════════════════════════
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ type: 'product', isActive: true, isDeleted: false })
      .select('name slug image parent order')
      .sort({ order: 1, name: 1 })
      .lean();
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('getCategories error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ════════════════════════════════════════════════════
// TÌM KIẾM GỢI Ý (autocomplete)
// GET /api/products/search-suggest?q=robot
// ════════════════════════════════════════════════════
const searchSuggest = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ success: true, data: [] });

    const products = await Product.find({
      status: 'active',
      isDeleted: false,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ],
    })
      .select('name slug images basePrice salePrice brand')
      .limit(6)
      .lean();

    res.json({ success: true, data: products });
  } catch (err) {
    console.error('searchSuggest error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getProducts,
  getProductBySlug,
  getFeaturedProducts,
  getRelatedProducts,
  getCategories,
  searchSuggest,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminProducts,
};
