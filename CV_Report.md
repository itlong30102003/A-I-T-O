# Báo Cáo Dự Án: AITO (AI Text Overlay) - Real-time Screen Translator

## 1. Mục Tiêu Dự Án (Project Goals)
- Phát triển một ứng dụng di động cho phép **dịch thuật trực tiếp trên màn hình (Real-time Screen Translation)** mà không cần chuyển đổi qua lại giữa các ứng dụng.
- Cung cấp trải nghiệm liền mạch bằng cách nhận diện văn bản (OCR) từ bất kỳ ứng dụng nào đang mở, dịch và **hiển thị (overlay)** văn bản đã dịch đè lên chính xác vị trí của văn bản gốc.
- Hỗ trợ đa dạng chế độ dịch: dịch liên tục theo thời gian thực (Real-time Mode) hoặc dịch theo vùng/ứng dụng được chọn (Selection Mode).
- Tối ưu hóa hiệu năng và pin thông qua xử lý bất đồng bộ, cơ chế cache giải thuật, và hạn chế tần suất gọi API không cần thiết (Debouncing).

## 2. Công Nghệ Sử Dụng (Technology Stack)
- **Frontend / Mobile Framework:** React Native (v0.83), TypeScript.
- **Native Android Modules:** Java / Kotlin. Xây dựng các Native Modules để can thiệp sâu vào hệ thống Android:
  - `MediaProjection API`: Chụp màn hình liên tục với hiệu suất cao.
  - `WindowManager API`: Vẽ UI (Overlay) nổi trên tất cả các ứng dụng khác, xử lý Touch Events xuyên thấu ứng dụng.
- **Trí Tuệ Nhân Tạo & Xử lý Ảnh (AI & Computer Vision):**
  - **Google ML Kit**: Sử dụng thư viện ML Kit (On-device) cho Text Recognition V2 (nhận diện chữ) và On-device Translation (dịch thuật ngoại tuyến).
  - **Vision Camera & Worklets**: Xử lý Frame hình ảnh luồng trực tiếp với `react-native-vision-camera`, kết hợp `react-native-worklets-core` để tăng tốc độ xử lý mà không bị nghẽn (bottleneck) tại RN Bridge.
- **Đồ họa & UI/UX (Graphics):** 
  - `@shopify/react-native-skia`: Căn chỉnh tọa độ, tạo bounding boxes và render text/UI 2D có hiệu năng cao trực tiếp trên frame màn hình.
  - `react-native-reanimated`: Xử lý animation mượt mà (60fps) cho các components.
- **Backend & Cơ Sở Dữ Liệu:** Firebase (Authentication, Firestore Database, Google Sign-in integration).
- **Quản lý State & Storage:** React Native Async Storage.

## 3. Kết Quả Đạt Được (Key Achievements & Features)
- **Kiến trúc Pipeline Tối Ưu (Highly Optimized Pipeline):** Xây dựng luồng dữ liệu (Capture → OCR → Translate → Overlay) cực kỳ tối ưu. Tính năng Text similarity cache và Translation cache (hashing) giúp giảm trên 50% số lượng request dịch thuật dư thừa, giúp app chạy mượt ở chế độ Auto mà không làm nóng máy.
- **Native-React Native Integration:** Triển khai thành công kết nối phức tạp giữa các Native Modules (chụp màn hình nền, Overlay UI) với React Native logic, giúp thao tác của người dùng không bị cản trở bởi app dịch.
- **Trải Nghiệm Dịch Tức Thì (Instant Overlay Translation):** Đạt được độ trễ cực thấp từ lúc có thay đổi trên màn hình đến khi hiển thị kết quả (<1s), giúp hiển thị khung viền (bounding boxes) và văn bản dịch khớp hoàn hảo với layout của ngôn ngữ gốc.
- **Offline & Privacy First:** Nhờ tích hợp On-device ML Kit Models, ứng dụng có thể dịch thuật mà không yêu cầu kết nối mạng chuẩn (đối với một số ngôn ngữ), đảm bảo tính riêng tư cho dữ liệu trên màn hình người dùng.
- **Chế độ Selection & Realtime linh hoạt:** Phát triển logic State Machine xử lý vòng đời của Tool khá phức tạp: vừa hỗ trợ Overlay toàn màn hình tự động, vừa cho phép người dùng Crop vị trí cụ thể bằng tay thông qua Selection Mode.

---

### Gợi ý các gạch đầu dòng ngắn gọn để đưa trực tiếp vào CV:

**Tên dự án:** AITO (Real-time Screen Translation App)
**Vị trí:** Mobile Developer (React Native / Android Native)
**Công nghệ:** React Native, TypeScript, Kotlin/Java, Google ML Kit (OCR & Translation), MediaProjection API, WindowManager (Overlay Layer), React Native Skia, Firebase.
- Thiết kế và phát triển ứng dụng dịch màn hình thời gian thực (Real-time Overlay), cho phép dịch trực tiếp text từ bất kỳ app nào đang chạy mà không cần thoát app.
- Xây dựng hệ thống Native Interface (Kotlin/Java) tích hợp `MediaProjection` để chụp màn hình hiệu năng cao và `WindowManager` để vẽ UI đè lên hệ thống (System-level Overlay).
- Tích hợp **Google ML Kit** để xử lý OCR nhận diện văn bản (Text Detection) và Dịch thuật ngay trên thiết bị viền (On-device Processing), đảm bảo quyền riêng tư và hoạt động offline ổn định.
- Tối ưu hóa "Capture → OCR → Translate → Overlay" pipeline với cơ chế Debouncing, Image Hashing và Text Cache, giảm >50% tài nguyên CPU hao phí và hiện tượng giật lag màn hình.
- Ứng dụng `@shopify/react-native-skia` tính toán và tạo overlay bounding box chính xác đè lên văn bản gốc để mang lại trải nghiệm Native mượt mà nhất.
