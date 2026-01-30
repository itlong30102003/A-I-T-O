# Kế hoạch Triển khai Live AR Camera Translation

## Mục tiêu
Xây dựng tính năng "Live AR Camera Translation" cho ứng dụng A-I-T-O, đạt chuẩn như Google Translate (nhận diện nhanh, xóa nền sạch, vẽ chữ đè lên mượt mà).

## Phân tích Tính khả thi
Kế hoạch đề xuất là **hoàn toàn khả thi** và sử dụng tech stack "Tiêu chuẩn Vàng" cho React Native AR.
- **Điểm mạnh**: Việc kết hợp `vision-camera` + `skia` + `reanimated` cho phép đạt được 60fps UI trên luồng JavaScript (thông qua Worklets/SharedValues), điều này cực kỳ quan trọng cho trải nghiệm AR.
- **Thách thức**:
    1.  **5fps OCR vs 60fps Hiển thị**: Chạy OCR ở tốc độ 5fps (mỗi 200ms) sẽ khiến khung hình bị "trễ" so với vật thể nếu người dùng di chuyển camera nhanh.
        - *Giải pháp*: Chúng ta sẽ sử dụng "Nội suy tọa độ" (Coordinate Interpolation) hoặc "Trung bình trượt" (Moving Average) ở Giai đoạn 2 để làm mượt chuyển động. Để có hiệu ứng "dính chặt" vào vật thể, người dùng cần giữ camera tương đối ổn định (đây là hạn chế vật lý chấp nhận được).
    2.  **Chuyển đổi Tọa độ (Coordinate Mapping)**: Ánh xạ tọa độ từ khung hình Camera (ví dụ: 1080x1920) sang Tọa độ màn hình (Screen View) rất dễ sai lệch do chế độ `resizeMode="cover"` và tỷ lệ khung hình khác nhau.
        - *Giải pháp*: Chúng ta sẽ xây dựng một tiện ích `coordinateMapper` mạnh mẽ ngay trong Giai đoạn 1.
    3.  **Khác biệt Android/iOS**: Hướng xoay camera và hệ tọa độ khác nhau. Cần kiểm tra kỹ lưỡng trên Android.

## Các Thay đổi Đề xuất

### Thư viện (Dependencies)
Chúng ta cần thêm các thư viện sau:
- `react-native-vision-camera` (v4)
- `react-native-worklets-core` (Bắt buộc cho Frame Processors)
- `@shopify/react-native-skia`
- `react-native-reanimated`

### Giai đoạn 1: Bộ khung & "Con mắt" (Core Camera & OCR) - Trọng tâm hiện tại
**Mục tiêu**: Mở camera, nhận diện được chữ, vẽ khung bao quanh đơn giản.
1.  **Cài đặt & Cấu hình**:
    - Thêm `react-native-vision-camera`, `reanimated`, `skia`.
    - Cấu hình `babel.config.js` cho Reanimated/Worklets.
    - Thêm quyền Camera trong `AndroidManifest.xml`.
2.  **Giao diện Camera**:
    - Tạo màn hình `LiveTranslationScreen`.
    - Triển khai component `Camera` với `useCameraDevice`.
3.  **Frame Processor ("Con mắt")**:
    - Tạo một JSI Frame Processor sử dụng `react-native-worklets-core`.
    - **Lưu ý**: Để gọi ML Kit hiệu năng cao, chúng ta sẽ viết Native Module (Java/C++) và bọc nó như một Frame Processor Plugin.
    - *Hành động*: Tạo `TextRecognitionFrameProcessor.java` (Android Native Module) nhận đầu vào là Frame và trả về `{ text, boundingBox, corners }`.
4.  **Debug Viewer**:
    - Dùng Skia vẽ các hình chữ nhật (`Rect`) dựa trên tọa độ trả về.
    - Triển khai hàm `screenCoordinateMapper` để khớp các hộp màu đỏ với vị trí chữ thực tế.

### Giai đoạn 2: "Bộ não" & Ổn định hóa (Logic & Stabilization)
**Mục tiêu**: Tracking mượt mà và dịch thuật chuẩn.
1.  **Thuật toán Tracking**:
    - Gán ID tạm thời cho các khối text dựa trên vị trí gần nhau trên màn hình.
    - Áp dụng bộ đệm `MovingAverage` cho tọa độ để giảm rung giật (jitter).
2.  **Tích hợp Dịch thuật**:
    - Kết nối `MLKitTranslationService` (đã có) vào luồng AR.
    - Logic: Chỉ kích hoạt dịch khi text đã ổn định trong > 500ms hoặc nội dung chưa thay đổi.

### Giai đoạn 3: "Phép thuật" AR (Graphics & In-painting)
**Mục tiêu**: Xóa nền và vẽ đè chữ.
1.  **Background In-painting (Xóa chữ cũ)**:
    - Lấy mẫu màu tại các điểm góc (dùng native helper hoặc Skia shader).
    - Vẽ một đa giác đặc (màu nền) đè lên chữ gốc.
2.  **Text Rendering (Vẽ chữ mới)**:
    - Vẽ text đã dịch nằm chính giữa khung vừa xóa nền.
    - Tự động thay đổi kích thước font (Auto-scale) để vừa khít chiều rộng.

### Giai đoạn 4: Tối ưu & Đóng gói
1.  **Hiệu năng**: Chuyển các tác vụ nặng sang Background Thread hoàn toàn.
2.  **UX**: Tự động đóng băng (Auto-freeze) khi giữ yên, Zoom, Chụp ảnh độ phân giải cao (High-Res capture).

## Yêu cầu Người dùng Review
> [!IMPORTANT]
> **Độ phức tạp của Native Module**: Kế hoạch này yêu cầu viết mã Java tùy chỉnh cho Frame Processor Plugin để cầu nối với ML Kit V2. Hiện tại không có gói `npm` có sẵn nào thực hiện *chính xác* việc xử lý Frame hiệu năng cao này cho ML Kit V2 Text Recognition trên React Native 0.83 (Kiến trúc mới) theo cách chúng ta cần. Chúng ta sẽ tự viết `TextRecognitionPlugin`.

## Kế hoạch Kiểm thử (Verification Plan)
- **Kiểm tra Giai đoạn 1**: Có thấy khung đỏ bao quanh chữ trên màn hình camera không? Vị trí có khớp không?
- **Kiểm tra Hiệu năng**: UI có chạy mượt 60fps trong khi OCR chạy nền ở 5fps không?
