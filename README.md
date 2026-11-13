# LiveMart · Frontend

Ứng dụng React + Vite cho backend Go [livetream_app](https://github.com/tieuhoang-dev/livetream_app). Bố cục dùng bốn cột thẻ trên desktop và hai cột với thanh điều hướng dưới trên điện thoại.

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

Chat phòng và thanh toán qua cổng cần thêm tích hợp backend.

## Đưa repo lên GitHub

Tạo một repository trống tên `livetream_app_fe`. Từ thư mục mã nguồn đã giải nén, chạy:

```powershell
git init -b main
git add .
git commit -m "Initial LiveMart frontend"
git remote add origin https://github.com/<tai-khoan>/livetream_app_fe.git
git push -u origin main
```
