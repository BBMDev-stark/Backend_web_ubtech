// routes/product.route.js
const express = require('express');
const router  = express.Router();

const {
  getProducts, getProductBySlug, getFeaturedProducts,
  getRelatedProducts, getCategories, searchSuggest,
  createProduct, updateProduct, deleteProduct, getAdminProducts,
} = require('../controllers/product.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// ⚠️ Route cụ thể TRƯỚC route có param (:slug)
router.get('/featured',       getFeaturedProducts);
router.get('/categories',     getCategories);
router.get('/search-suggest', searchSuggest);
router.get('/admin/all',      protect, restrictTo('admin'), getAdminProducts);
router.get('/',               getProducts);
router.get('/:slug',          getProductBySlug);
router.get('/:slug/related',  getRelatedProducts);

router.post('/',      protect, restrictTo('admin'), createProduct);
router.put('/:id',    protect, restrictTo('admin'), updateProduct);
router.delete('/:id', protect, restrictTo('admin'), deleteProduct);

module.exports = router;
