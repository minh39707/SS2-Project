# HabitForge API

This is the backend for the HabitForge mobile application, built with Express and Supabase.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` based on `.env.example`:
   ```env
   PORT=4000
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
   ```

3. Start the server:
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## API Documentation

Dưới đây là tổng hợp tất cả các API hiện có để bạn dễ dàng test trên phần mềm Postman (hoặc Thunder Client/REST Client):

**Lưu ý quan trọng cho các API cần xác thực:**
Tất cả các API yêu cầu xác thực không dùng theo dạng token phổ thông (Bearer) mà dùng Header tùy chỉnh. 
Bạn hãy vào tab **Headers** của Postman, thêm key là `x-user-id` và value tương ứng là **ID của user** (chuỗi UUID nhận được sau khi đăng nhập thành công).

---

### 1. Nhóm API Hệ thống
- `GET /api/health`
  - Chức năng: Kiểm tra trạng thái hoạt động của Server.
  - Auth: Không yêu cầu
  - Trả về: `{ "status": "ok", "timestamp": "..." }`

### 2. Nhóm API Xác thực - Auth
- `POST /api/auth/email/sign-up`
  - Chức năng: Đăng ký tài khoản mới.
  - Body JSON: `{ "email": "user@example.com", "password": "password123", "name": "Tên Người Dùng" }`
  - Auth: Không
- `POST /api/auth/email/sign-in`
  - Chức năng: Đăng nhập tài khoản.
  - Body JSON: `{ "email": "user@example.com", "password": "password123" }`
  - Auth: Không (Lưu lại `id` từ JSON trả về để làm token)
- `POST /api/auth/google`
  - Chức năng: API dùng cho đăng nhập Google. (Hiện đang là placeholder).
  - Auth: Không

### 3. Nhóm API Người dùng - Users
- `GET /api/users/me`
  - Chức năng: Lấy thông tin cá nhân cơ bản và cấp độ (Level) của người dùng hiện tại dựa trên kinh nghiệm.
  - Header: `x-user-id: <user_id>`
- `GET /api/users/me/stats`
  - Chức năng: Lấy các chỉ số thống kê (HP, EXP, Streaks) của người dùng cho hệ thống level.
  - Header: `x-user-id: <user_id>`

### 4. Nhóm API Dashboard
- `GET /api/dashboard`
  - Chức năng: Lấy toàn bộ dữ liệu gộp hiển thị ở trang chủ màn hình chính (Dữ liệu Lịch theo tuần, Thói quen tốt, Thói quen xấu, Stats, Quick Actions...).
  - Header: `x-user-id: <user_id>`

### 5. Nhóm API Onboarding & Habits
- `POST /api/onboarding/sync`
  - Chức năng: Lưu hoặc cập nhật thông tin thói quen (habits) người dùng thiết lập ban đầu ở màn hình onboarding. Quá trình này sẽ gọi lệnh Upsert vào database dựa vào user_id.
  - Header: `x-user-id: <user_id>`
  - Body JSON: `{ "habit_name": "Tên thói quen", "habit_type": "loại", "time_period": "etc..." }`
