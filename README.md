# LiveMart · Frontend

Ứng dụng React + Vite cho backend Go [livetream_app](https://github.com/tieuhoang-dev/livetream_app). Giao diện nền tối với điểm nhấn hồng/cyan, sidebar trên desktop và điều hướng dưới trên điện thoại. Phòng LIVE dùng khung video dọc cùng thông tin người phát, bình luận và sản phẩm ghim phủ trên video.

## Chạy trên Windows

Cần Node.js 22.12+ và backend có API từ [commit ecb07fa](https://github.com/tieuhoang-dev/livetream_app/commit/ecb07fae9c44c8abe890142beac640c6356ec885) trở lên. Trong PowerShell, mở thư mục frontend và chạy:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Mở địa chỉ Vite in ra, thường là `http://localhost:5173`. Vite chuyển tiếp `/api`, `/api/auth/ws` và `/uploads` đến backend ở `http://127.0.0.1:8080`. Đổi `VITE_API_URL` trong `.env` nếu backend dùng địa chỉ hoặc port khác. Để thử từ điện thoại cùng Wi-Fi, mở `http://<IP-máy-tính>:5173` trên điện thoại và cho phép cổng Vite qua tường lửa mạng riêng của Windows nếu được hỏi. Backend có thể tiếp tục chạy trên máy tính.

Chọn **Dùng dữ liệu mẫu** ở cuối trang hoặc trên thông báo lỗi kết nối để thử trước. Thao tác mẫu lưu riêng theo tab trình duyệt. Dùng **Kết nối backend** để quay về API thật.

## Build

```powershell
npm run build
npm run preview
```

Bản build không có `VITE_PUBLIC_API_URL` mở ở chế độ mẫu. Chọn kết nối backend khi đang chạy `npm run preview` hoặc khi host chuyển tiếp cùng origin các route `/api`, `/uploads` và WebSocket. Nếu frontend và backend chạy ở hai origin, đặt `VITE_PUBLIC_API_URL` thành origin HTTPS của backend trước khi build và cấu hình backend/proxy cho CORS và WebSocket. Các biến `VITE_` là cấu hình công khai.

## Luồng tích hợp

- Đăng nhập, đăng ký, xác thực OTP và đặt lại mật khẩu. Backend cần cấu hình Brevo để gửi OTP.
- Tìm live theo tiêu đề, trạng thái, người bán và sản phẩm. Xem video và sản phẩm trong live, đặt hàng theo giá live.
- Mua ngoài live, lọc hàng còn kho, xem đơn và ghi nhận thanh toán nội bộ, hủy hoặc hoàn đơn.
- Kênh người bán quản lý danh mục, điều chỉnh kho, tạo/kết thúc live, gắn/gỡ sản phẩm và xem đơn ngoài live.

## Phát và xem video trực tiếp

1. Cập nhật cả frontend và backend lên bản tích hợp LiveKit rồi chạy `npm ci` lại.
2. Chạy LiveKit và cấu hình `.env` của Go theo [hướng dẫn backend](https://github.com/tieuhoang-dev/livetream_app/blob/main/API.md#video-qua-livekit).
3. Mở `http://localhost:5173` và đăng nhập. Vào **Kênh người bán → Phiên live → Tạo phiên live**, rồi bấm **Bắt đầu phát** trong phòng và cho phép camera/micro.
4. Dùng một tài khoản khác trong cửa sổ ẩn danh, mở cùng phòng và bấm **Xem trực tiếp**. Trên trình duyệt chặn tự phát âm thanh, bấm **Bật âm thanh**.

**Dừng phát** tắt camera và micro, giữ phiên bán hàng mở để phát lại. **Kết thúc phiên** đóng phiên và yêu cầu LiveKit ngắt người xem. Để phát từ điện thoại, mở frontend qua HTTPS và dùng một endpoint LiveKit WSS mà điện thoại có thể truy cập. `ws://127.0.0.1:7880` dùng cho thử nghiệm trên cùng máy. Chế độ dữ liệu mẫu chỉ mô phỏng phòng và sản phẩm.

Chủ phiên có thể bấm **Thêm hàng** ngay trong phòng để chọn sản phẩm từ kho, giá bán và số lượng dành cho live. Người xem đăng nhập để đọc và gửi bình luận trong cùng phiên. Danh sách hàng và bình luận tự cập nhật.

## Giao diện phòng LIVE

- Trên desktop: video dọc, nền mở rộng làm mờ, thanh tương tác và giỏ sản phẩm bên phải.
- Trên điện thoại: phòng chiếm toàn màn hình; bấm Giỏ hàng để mở bảng sản phẩm từ dưới lên.
- Vuốt lên/xuống trên vùng video hoặc dùng phím mũi tên trên desktop để chuyển giữa các phiên đang mở được API trả về. Vuốt trong bình luận không chuyển phòng.
- Bình luận có thể ẩn/hiện. Sản phẩm đang ghim mở chi tiết; người xem đặt hàng, chủ phiên dùng Thêm sản phẩm để quản lý kho live.
- Chia sẻ sao chép liên kết phòng; trình duyệt hỗ trợ có thể mở video toàn màn hình.
- Thả tim là hiệu ứng giao diện cục bộ, chưa đồng bộ tới người xem khác. Không hiển thị số lượt tim hoặc người xem giả.
- Ảnh và bình luận ví dụ chỉ thuộc chế độ Dùng dữ liệu mẫu. Video API vẫn đi qua LiveKit và giữ tỷ lệ của nguồn phát.

## Kiểm tra giao diện

```powershell
npx playwright install chromium
npm run test:ui
```

Các bài kiểm tra Chromium bao gồm bình luận, chuyển phòng bằng vuốt/phím,
chia sẻ/toàn màn hình, giỏ hàng → đặt hàng, đóng dialog/đổi kích thước màn
hình, quyền khách/chủ phiên, payload quản lý sản phẩm và lỗi LiveKit. Các ca
API dùng response giả lập để kiểm tra frontend; không xác nhận chất lượng
truyền video giữa hai thiết bị thật. Viewport được kiểm tra từ 320 đến 1440 px.
Có thể đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` để dùng Chromium đã cài trên máy.

## Đưa repo lên GitHub

Tạo một repository trống tên `livetream_app_fe`. Từ thư mục mã nguồn đã giải nén, chạy:

```powershell
git init -b main
git add .
git commit -m "Initial LiveMart frontend"
git remote add origin https://github.com/<tai-khoan>/livetream_app_fe.git
git push -u origin main
```
