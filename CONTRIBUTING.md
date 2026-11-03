# Đóng góp

## Nhánh và pull request

- Tạo nhánh từ `main`: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
- Mỗi pull request nên giải thích **vì sao**, không chỉ **cái gì**.
- Giữ pull request nhỏ khi có thể; thay đổi schema và thay đổi giao diện nên tách nhau.
- Trước khi mở PR:

  ```sh
  cd frontend && npm run lint && npm run build && npm test
  cd backend && npm test
  ```

## Commit

- Dùng tiền tố `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Thân commit nêu lý do và ảnh hưởng.
- **Không thêm `Co-Authored-By` cho công cụ AI.** CI kiểm tra bằng `scripts/check-commit-messages.mjs`.
- Bật hook để tự xoá trước khi commit:

  ```sh
  git config core.hooksPath .githooks
  ```

  Hook sẽ bỏ các dòng `Co-Authored-By` nhắc tới Claude, Anthropic, DeepSeek, OpenAI, ChatGPT, Copilot hoặc Gemini.

## Thay đổi cơ sở dữ liệu

- Không sửa migration đã chạy ở môi trường khác. Tạo tệp mới trong `backend/migrations/`.
- Migration phải idempotent: dùng `IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`.
- Cập nhật `001_initial_schema.sql` cho cài đặt mới, và thêm migration cho môi trường đang chạy.
- Nêu rõ lệnh chạy migration trong mô tả PR.

## Giao diện

- Dùng component trong `src/components/ui` và các primitive trong `src/components/app`.
- Giữ nhãn tiếng Việt và tên truy cập ổn định; test dựa trên vai trò và nhãn.
- Kiểm tra ở 375 px và 1440 px.
- Không thêm dropdown native mới; dùng `NativeSelect`.

## Kiểm thử

- Test hành vi người dùng thấy, không test chi tiết nội bộ.
- Một lỗi được sửa cần có test tái hiện lỗi đó.
- Test frontend chạy ở chế độ `mock`, không gọi mạng.

## Báo lỗi

Kèm theo:

- bước tái hiện,
- kết quả mong đợi và thực tế,
- ảnh chụp hoặc log,
- phiên bản (commit, tag),
- vai trò tài khoản đang dùng.
