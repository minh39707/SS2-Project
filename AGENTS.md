# Project Overview

React Native app (Expo Router + JavaScript) + Node.js/Express backend.
Không có test suite. Mọi thay đổi phải verify bằng `npx expo start`.

## Stack
- Frontend: React Native, Expo Router (file-based routing), Supabase JS client
- Backend: Node.js, Express, Supabase Admin

## Quy tắc bất biến
- KHÔNG thay đổi logic, UI, hoặc behavior
- KHÔNG đổi tên export đang được sử dụng
- KHÔNG đụng đến: .env, package.json, app.json, jsconfig.json
- Mỗi thay đổi lớn → chạy `npx expo start` để verify
- Nếu không chắc chắn → hỏi, không tự quyết định

## Cấu trúc mục tiêu (sau refactor)
Frontend/
  app/            → Expo Router routes, chứa logic màn hình trực tiếp
  src/
    components/   → UI components (giữ nguyên)
    features/     → Logic theo domain: onboarding/, analytics/
    services/     → Mọi thứ có side effect: API, storage, Supabase
    hooks/        → Custom hooks (giữ nguyên)
    utils/        → Pure functions chỉ
    constants/    → Giữ nguyên

Backend/
  src/
    routes/       → Giữ nguyên
    middleware/   → Giữ nguyên
    services/
      ai/         → Gộp aiProvider + aiPrompts + aiSchemas vào đây
    utils/        → Chỉ giữ pure functions

## Vấn đề đã biết cần giải quyết
1. src/screens/ là lớp wrapper thừa — nên xóa, gộp vào app/
2. supabase.js + supabaseAuth.js — nên gộp thành 1 file
3. onboarding logic phân mảnh ở 4 chỗ — nên gộp vào features/onboarding/
4. analyticsPdf.js nằm sai ở utils/ — nên vào services/
5. Backend: aiPrompts.js + aiSchemas.js nên vào services/ai/
6. Có thể có dead code — cần audit trước khi xóa