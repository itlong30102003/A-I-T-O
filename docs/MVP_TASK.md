# A-I-T-O MVP Implementation Tasks

## Mục tiêu MVP
Triển khai ứng dụng OCR Translator với 4 chức năng chính:
1. Chụp màn hình thời gian thực (MediaProjection)
2. Tự động nhận diện vùng chữ + bounding box
3. Nhận diện văn bản (Text Detection)
4. Hiển thị overlay chữ lên màn hình

---

## Phase 1: Screen Capture (MediaProjection)
- [ ] **1.1** Thêm quyền cần thiết vào `AndroidManifest.xml`
  - [ ] `FOREGROUND_SERVICE`
  - [ ] `FOREGROUND_SERVICE_MEDIA_PROJECTION`
  - [ ] `SYSTEM_ALERT_WINDOW`
- [ ] **1.2** Tạo Native Module `ScreenCaptureModule`
  - [ ] Class Java/Kotlin để khởi tạo MediaProjection
  - [ ] Request permission từ user
  - [ ] Xử lý result từ permission activity
- [ ] **1.3** Tạo Foreground Service cho screen capture
  - [ ] `ScreenCaptureService.java` - service chạy nền
  - [ ] Tạo notification channel
  - [ ] Quản lý lifecycle của MediaProjection
- [ ] **1.4** Capture frames bằng ImageReader
  - [ ] Setup VirtualDisplay
  - [ ] Capture frames theo interval
  - [ ] Convert Image sang Bitmap
- [ ] **1.5** Bridge Native -> JS
  - [ ] Expose methods: `startCapture()`, `stopCapture()`
  - [ ] Emit events khi có frame mới

---

## Phase 2: Text Region Detection + Bounding Box
- [ ] **2.1** Cài đặt ML Kit Text Recognition
  - [ ] Thêm dependency `com.google.mlkit:text-recognition`
  - [ ] Hoặc sử dụng `@react-native-ml-kit/text-recognition`
- [ ] **2.2** Tạo `TextDetectionModule`
  - [ ] Nhận Bitmap từ screen capture
  - [ ] Process bằng ML Kit TextRecognizer
  - [ ] Trích xuất bounding box của text blocks
- [ ] **2.3** Xử lý kết quả OCR
  - [ ] Parse TextBlock → Line → Element
  - [ ] Calculate coordinates relative to screen
  - [ ] Return JSON: `{ text, boundingBox: {x, y, w, h} }`

---

## Phase 3: Text Overlay Display
- [ ] **3.1** Thêm quyền SYSTEM_ALERT_WINDOW
  - [ ] Check permission tại runtime
  - [ ] Request user enable từ Settings
  - [ ] Sử dụng `rn-android-overlay-permission`
- [ ] **3.2** Tạo Overlay Service
  - [ ] `OverlayService.java` - floating window service
  - [ ] WindowManager với TYPE_APPLICATION_OVERLAY
  - [ ] Có thể contain React Native view
- [ ] **3.3** Render translated text
  - [ ] Nhận text + position từ JS
  - [ ] Tạo TextView/View tại vị trí bounding box
  - [ ] Styling: background, font, transparency
- [ ] **3.4** Update overlay dynamically
  - [ ] Xóa overlay cũ khi có text mới
  - [ ] Animation cho smooth transition

---

## Phase 4: Integration & Main Flow
- [ ] **4.1** Tạo ScreenCaptureScreen.tsx
  - [ ] UI button Start/Stop capture
  - [ ] Call native modules
  - [ ] Display status
- [ ] **4.2** Integrate flow: Capture → Detect → Overlay
  - [ ] Pipe captured frame to detection
  - [ ] Pipe detection result to overlay
  - [ ] Handle errors gracefully
- [ ] **4.3** Performance optimization
  - [ ] Throttle frame processing
  - [ ] Memory management
  - [ ] Battery optimization

---

## Phase 5: Testing & Verification
- [ ] **5.1** Test screen capture permission flow
- [ ] **5.2** Test overlay permission flow
- [ ] **5.3** Test OCR accuracy với Vietnamese text
- [ ] **5.4** Test performance trên các device khác nhau
