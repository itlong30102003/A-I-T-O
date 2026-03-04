# AITO - AI Translation Overlay

AITO is a React Native Android application that provides real-time translation and text overlays on top of other apps. It leverages screen capture, Optical Character Recognition (OCR), and machine translation to seamlessly translate text directly on your screen.

## Features Use Cases
- **Real-time Translation Mode:** Continuously captures the screen, extracts text, translates it, and overlays the translated text precisely over the original content.
- **Selection Mode:** A dedicated app picker and selection flow for translating specific applications or regions.
- **Document Translation Mode (Planned):** Support for translating PDFs, Word documents, and images while maintaining document structure.

## Tech Stack
- **Framework:** React Native
- **Native Android:** Java (for System Overlay Window, Screen Capture MediaProjection)
- **Services:** Firebase (Authentication/Database)
- **UI:** Custom design system matching Next.js reference style, `lucide-react-native`

## Getting Started

### Prerequisites
- Node.js & npm or yarn
- Android Studio & Android SDK (API 34/35)

### Installation & Run

1. Clone the repository and install dependencies:
   ```sh
   npm install
   ```

2. Start the Metro bundler:
   ```sh
   npm start
   ```

3. Open a new terminal and run the app on Android:
   ```sh
   npm run android
   ```

> **Note:** Since AITO relies heavily on Android's `SYSTEM_ALERT_WINDOW` (Draw over other apps) and `MediaProjection` (Screen capture), it is best tested on a physical Android device or an emulator with Play Store support.

---

## Future Updates

### Document Translation Mode
In the future, a new translation mode will be introduced to support translating documents efficiently while maintaining their layout.

**Supported Formats:**
- **Images (PNG, JPG):** Reuse existing real-time OCR engine to extract, translate, and display translated text.
- **PDF & Word (.docx):**
  - *Cloud API Approach (Layout Preservation):* Use Google Cloud Document Translation API or Azure Document Translation to keep 100% of the original structure (tables, images, layouts).
  - *Local OCR Approach (Cost-Saving):* Render documents to static images locally and run local OCR to extract plain text without layout preservation.

**Planned Dependencies:**
- `react-native-document-picker`
- `react-native-fs`
- `react-native-pdf`
- `mammoth` (for local `.docx` parsing)
