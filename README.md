# 🎥 Background Remover App

Ứng dụng web để xóa nền và thay đổi background giống như Zoom, được xây dựng với React, TypeScript, MediaPipe và TensorFlow.js.

## ✨ Tính năng

- 🎯 **Xóa nền tự động**: Sử dụng AI để tự động xóa nền xung quanh người
- 🖼️ **Thay đổi background**: Chọn từ nhiều background có sẵn hoặc tải lên ảnh tùy chỉnh
- 📱 **Responsive design**: Hoạt động tốt trên desktop và mobile
- 🎨 **UI/UX đẹp**: Giao diện hiện đại với gradient và hiệu ứng mượt mà
- ⚡ **Real-time**: Xử lý video real-time với hiệu suất cao

## 🚀 Cách sử dụng

1. **Bật camera**: Nhấn nút "Bật Camera" để bắt đầu
2. **Chọn background**: 
   - Chọn từ các background có sẵn (văn phòng, bãi biển, rừng, thành phố, không gian)
   - Hoặc tải lên ảnh tùy chỉnh từ máy tính
   - Hoặc nhập URL ảnh
3. **Tắt camera**: Nhấn "Tắt Camera" khi hoàn thành

## 🛠️ Công nghệ sử dụng

- **React 18** với TypeScript
- **MediaPipe Selfie Segmentation** cho AI xóa nền
- **TensorFlow.js** cho machine learning
- **CSS Grid & Flexbox** cho layout responsive
- **Canvas API** cho xử lý video real-time

## 📦 Cài đặt

```bash
# Clone repository
git clone <repository-url>
cd my-react-app

# Cài đặt dependencies
npm install

# Chạy development server
npm run dev
```

## 🌐 Truy cập

Mở trình duyệt và truy cập `http://localhost:5173`

## 📱 Yêu cầu hệ thống

- Trình duyệt hiện đại hỗ trợ WebRTC (Chrome, Firefox, Safari, Edge)
- Camera và microphone
- Kết nối internet để tải MediaPipe models

## 🎨 Background có sẵn

- 🏢 Văn phòng
- 🏖️ Bãi biển  
- 🌲 Rừng
- 🏙️ Thành phố
- 🚀 Không gian

## 🔧 Tùy chỉnh

Bạn có thể:
- Thêm background mới trong `BackgroundSelector.tsx`
- Điều chỉnh chất lượng xử lý trong `BackgroundRemover.tsx`
- Thay đổi styling trong `App.css`

## 📄 License

MIT License - Sử dụng tự do cho mục đích cá nhân và thương mại.

---

**Lưu ý**: Ứng dụng cần quyền truy cập camera để hoạt động. Hãy cho phép quyền truy cập khi trình duyệt yêu cầu.