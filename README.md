# 🔐 Auth API – Hướng dẫn sử dụng

## Cài đặt & Chạy

```bash
# 1. Cài thư viện
npm install

# 2. Chạy server (development – tự reload khi sửa code)
npm run dev

# Server chạy tại: http://localhost:5000
```

---

## Danh sách API

| Method | URL | Mô tả | Cần token? |
|--------|-----|-------|-----------|
| POST | /api/auth/register | Đăng ký tài khoản | Không |
| POST | /api/auth/login | Đăng nhập | Không |
| POST | /api/auth/refresh-token | Làm mới access token | Không (cookie) |
| POST | /api/auth/logout | Đăng xuất | ✅ Có |
| GET | /api/auth/me | Xem thông tin bản thân | ✅ Có |

---

## Test bằng Thunder Client (VS Code) hoặc Postman

### 1. Đăng ký
```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Nguyễn Văn Test",
  "email": "test@gmail.com",
  "password": "123456",
  "phone": "0909123456"
}
```

### 2. Đăng nhập (tài khoản có sẵn từ seed)
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@ecommerce.vn",
  "password": "Admin@123456"
}
```
→ Copy accessToken từ response để dùng ở bước tiếp

### 3. Xem thông tin bản thân
```
GET http://localhost:5000/api/auth/me
Authorization: Bearer <dán accessToken vào đây>
```

### 4. Làm mới token (khi accessToken hết hạn)
```
POST http://localhost:5000/api/auth/refresh-token
(cookie refreshToken được gửi tự động)
```

### 5. Đăng xuất
```
POST http://localhost:5000/api/auth/logout
Authorization: Bearer <accessToken>
```

---

## Cách dùng middleware bảo vệ route trong code

```js
const { protect, restrictTo } = require('./middleware/auth.middleware');

// Chỉ cần đăng nhập
router.get('/profile', protect, getProfile);

// Chỉ admin mới vào được
router.delete('/users/:id', protect, restrictTo('admin'), deleteUser);

// Admin hoặc editor
router.post('/posts', protect, restrictTo('admin', 'editor'), createPost);
```
