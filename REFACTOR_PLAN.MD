# Refactor Plan

## Nguyên tắc làm việc
- Làm tuần tự từng phase, KHÔNG song song
- Kết thúc mỗi phase: báo cáo kết quả + hỏi xác nhận
- Phát hiện bất ngờ → dừng, báo cáo, không tự quyết định
- Mọi file di chuyển → verify không còn import cũ bằng grep

## Phase 0 — Chuẩn bị
- Kiểm tra git status sạch
- Tạo branch: `git checkout -b refactor/clean-codebase`
- Đếm tổng file hiện tại để so sánh sau

## Phase 1 — Audit (CHỈ ĐỌC)
Mục tiêu: hiểu thực trạng trước khi sửa bất cứ gì.

Cần trả lời:
- Mỗi file trong app/ có phải chỉ là wrapper của src/screens/ không?
  Nếu có logic riêng → ghi chú, không gộp
- supabaseAuth.js export gì? Có thể gộp vào supabase.js không?
- onboarding logic phân tán ở những file nào, quan hệ ra sao?
- analyticsPdf.js có side effect không (API call, file I/O)?
- File nào trong src/ không được import ở bất kỳ đâu? (dead code candidates)
- jsconfig.json đã có alias chưa? Có bao nhiêu `../../` relative imports?
- Backend: aiPrompts/aiSchemas có phụ thuộc gì ngoài aiProvider?

Output: bảng findings cho từng mục, phân loại: 
  ✅ Chắc chắn an toàn | ⚠️ Cần thảo luận | ❌ Không nên đụng

## Phase 2 — Xóa src/screens/
Điều kiện: Phase 1 xác nhận tất cả screens là wrapper đơn giản.

Với mỗi màn hình (làm từng cái, theo thứ tự tăng dần độ phức tạp):
1. Copy logic từ ScreenComponent vào file app/ tương ứng
2. Cập nhật imports trong file app/
3. Grep tìm nơi import ScreenComponent cũ → cập nhật hết
4. Xóa file ScreenComponent
5. Verify grep sạch → báo cáo → chờ xác nhận

Thứ tự: Auth → Home → Habits → Onboarding (từng cái)

## Phase 3 — Gộp Supabase
Điều kiện: Phase 1 xác nhận an toàn.
- Gộp supabaseAuth.js vào supabase.js
- Cập nhật toàn bộ import
- Xóa supabaseAuth.js

## Phase 4 — Tổ chức onboarding
Điều kiện: Phase 1 đã map được dependency graph.
- Tạo src/features/onboarding/
- Di chuyển: onboardingApi, onboardingStorage, OnboardingContext, utils/onboarding
- Tạo index.js re-export để backward compatible
- Cập nhật import dần

## Phase 5 — Di chuyển analyticsPdf
Điều kiện: Phase 1 xác nhận có side effect.
- utils/analyticsPdf.js → services/analyticsPdf.js

## Phase 6 — Backend AI utilities
- Tạo services/ai/: gộp aiProvider, aiPrompts, aiSchemas
- Tạo services/ai/index.js re-export
- Cập nhật toàn bộ import trong Backend

## Phase 7 — Import alias
Điều kiện: Phase 1 cho thấy có nhiều `../../` imports.
- Cập nhật jsconfig.json với paths aliases
- Verify babel config có module-resolver
- Cập nhật imports CHỈ cho các file đã được di chuyển ở các phase trước
- KHÔNG refactor import hàng loạt trong 1 lần

## Phase 8 — Dead code
Điều kiện: Phase 1 xác định rõ danh sách.
- Grep lần cuối để chắc chắn từng file
- Xóa từng file, ghi log vào CLEANUP_LOG.md

## Phase 9 — Tài liệu và tổng kết
- Cập nhật AGENTS.md phản ánh cấu trúc thực tế sau refactor
- Tạo CLEANUP_LOG.md: file đã xóa, di chuyển, import đã cập nhật
- Chạy checklist Definition of Done

## Definition of Done
- [ ] `find Frontend/src/screens -type f` → rỗng
- [ ] `grep -r "from.*screens/" Frontend` → rỗng  
- [ ] `ls Frontend/src/services/supabase*` → chỉ 1 file
- [ ] `npx expo start` → không lỗi
- [ ] `git diff --stat` → chỉ file moves + import updates, không có logic changes
- [ ] CLEANUP_LOG.md tồn tại với đầy đủ log