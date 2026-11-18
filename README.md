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
- Khi đặt hàng, người mua chọn COD hoặc chuyển khoản ngân hàng. Backend lưu lựa chọn ở `payment_method`; chuyển khoản hiện theo hướng dẫn của người bán, chưa thu tiền tự động qua cổng thanh toán.
- Đặt hàng trong live chỉ đóng hộp đặt hàng, cập nhật tồn kho và giữ nguyên phòng/video. Hiện thông báo thành công kèm nút **Xem đơn**; chỉ khi bấm nút này người mua mới chuyển sang đơn vừa tạo. Mua ngoài live vẫn mở đơn như trước.
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

## Địa chỉ, kiện hàng và báo phí GHN

Ứng dụng chỉ lấy báo giá từ GHN, không tạo vận đơn, không đặt lịch lấy hàng.
Backend mặc định GHN staging, giữ Token/ShopId trong `.env`; xem SHIPPING.md
ở repo backend để cấu hình. Không có cấu hình hoặc hãng lỗi thì checkout
báo rõ, không dùng phí 0 hay phí shop nhập thay thế.

Chủ shop lưu địa chỉ lấy hàng tại Kênh người bán → Giao hàng. Khi tạo/sửa sản
phẩm, bổ sung khối lượng (gram) và dài/rộng/cao (cm) của kiện cho một đơn vị.
Sản phẩm cũ thiếu thông tin cần được sửa trước khi báo phí. Nhiều đơn vị được
cộng khối lượng và xếp chồng chiều cao; kiện dự tính hiển thị trong checkout.

Bắt đầu phát vẫn mặc định GPS và xác nhận địa chỉ riêng của phiên; có thể
chuyển nhập tay. Tên/điện thoại và số nhà/căn hộ do người dùng xác nhận. GPS
cần HTTPS/localhost và quyền trình duyệt, không theo dõi liên tục khi di chuyển.

Chọn tỉnh hiện tại, khu vực GHN nếu có nhiều vùng cũ, quận/huyện và phường/xã
trong danh mục hãng để báo phí. Endpoint tính phí GHN hiện dùng mã địa giới cũ,
GPS không được đoán mã khu vực. Danh mục được lấy qua backend, không gửi token
hãng vào trình duyệt. Danh mục phường offline trong src/wards.json vẫn hỗ trợ
nhập tay khi chưa kết nối được hãng, nhưng chưa đủ để xác nhận báo giá.

Checkout gửi mã khu vực và phương thức thanh toán cho backend; chỉ hiển thị
phí server trả. Tạo đơn nội bộ lấy lại báo giá và kiểm tra giá/kiện/nơi lấy,
lưu snapshot kèm môi trường, quote_only và thời điểm. COD có thể ảnh hưởng phụ
phí nên đổi phương thức sẽ lấy lại báo giá. Đặt xong vẫn trong live; Xem đơn
là thao tác chủ động. Không gửi đơn nội bộ sang hãng vận chuyển.

Leaflet/OpenStreetMap hỗ trợ kiểm tra ghim, giữ attribution. Dịch vụ reverse
geocoding cần Internet; địa chỉ nhập tay luôn dùng được. Bản demo có phí mẫu,
được ghi rõ là minh họa, không gọi GHN. Cập nhật cả backend và FE cùng nhau.

## Danh sách live qua WebSocket

Trang khám phá, danh sách chuyển phòng và tab Phiên live của người bán dùng
`/api/livestreams/ws` (ws/wss theo URL backend). Client gửi
`{type: "list_lives", request_id, query}` với bộ lọc, thứ tự và phân trang,
nhận `list_lives_success` gồm `data/total/page/page_size`. Backend đẩy snapshot
mới khi tạo/kết thúc live hoặc thêm/xóa sản phẩm trong live; FE không poll
REST để lấy danh sách. Mất kết nối thì tự nối lại, gửi lại bộ lọc hiện tại.

Kênh này công khai, chỉ đọc, không cần đăng nhập và không thay kết nối chat
`/api/auth/ws`. API chi tiết live, sản phẩm, đơn và media token vẫn dùng REST.
Cần cập nhật backend PR #13 cùng FE này; reverse proxy/tunnel phải hỗ trợ
WebSocket Upgrade. Vite đã proxy `/api` với `ws: true`.

Trong bước bắt đầu phát hoặc Cài đặt giao hàng, chọn **Tìm bưu cục GHN gần vị
trí này** để xem danh sách và ghim bưu cục theo quận/huyện GHN. GPS tự điền khu
vực khi tên khớp chắc chắn; có thể chọn khu vực thủ công. Khoảng cách là đường
chim bay trong phạm vi tra cứu, không bảo đảm gần nhất ngoài khu vực. Chọn
bưu cục nếu người bán tự mang hàng ra gửi; backend kiểm tra lại bưu cục và lấy
báo phí theo khu vực bưu cục đó. Khoảng cách chỉ dùng xếp hạng, không dùng để
nhân ra phí ship. Người mua vẫn ở trong live sau khi đặt hàng.

Tra bưu cục cần quyền GHN phù hợp; một số tài khoản yêu cầu captcha/mở quyền.
Giao diện báo rõ và vẫn cho dùng địa chỉ lấy hàng khi chưa tra được. Dữ liệu
thử nghiệm ghi nhãn staging; không tự tạo vận đơn hoặc hẹn lấy hàng. Kiểm thử
UI dùng danh mục/bưu cục và báo phí giả lập, chưa gọi tài khoản GHN thật.


## Realtime dùng chung

FE dùng một kết nối /api/ws theo phiên đăng nhập. Kết nối này phục vụ danh
sách/phòng live, sản phẩm, bình luận, media token, shipping và thông báo đơn;
không polling HTTP các phần đó. Root client ở src/realtime/client.js, hook ở
src/realtime/useSubscription.js. Backend root service và protocol nằm trong
REALTIME.md của repo BE. Video vẫn do LiveKit xử lý.

Backend chọn bưu cục hợp lệ gần nhất trong phạm vi tra cứu, trả selected. FE
mặc định bật Tự chọn bưu cục khi có vị trí/khu vực; có thể tắt để lấy hàng trực
tiếp tại địa chỉ đang live. Người bán kiểm tra rồi lưu nơi gửi. Không tạo vận
đơn. Checkout hiện Giao đến với tên/điện thoại/địa chỉ người mua trước xác nhận;
chi tiết đơn dùng cùng DeliverySummary. Khi nơi gửi/kiện đổi, WS báo lấy lại
phí. Mất kết nối chỉ đăng ký lại subscription, không tự gửi lại lệnh ghi.
