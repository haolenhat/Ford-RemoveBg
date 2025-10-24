# Hướng dẫn thêm ảnh Background

## Cách thêm ảnh background của bạn:

### 1. Thêm ảnh vào thư mục
- Đặt các file ảnh của bạn vào thư mục này: `src/assets/backgrounds/`
- Các định dạng được hỗ trợ: `.jpg`, `.jpeg`, `.png`, `.webp`
- Khuyến nghị kích thước: 1920x1080 hoặc tỉ lệ 16:9

### 2. Cập nhật file index.ts
Mở file `src/assets/backgrounds/index.ts` và thêm ảnh của bạn:

```typescript
// Import background images
import officeBg from './office.jpg';
import beachBg from './beach.jpg';
import forestBg from './forest.jpg';

// Export background images
export const backgroundImages = {
  office: officeBg,
  beach: beachBg,
  forest: forestBg,
};

// Background configurations
export const backgroundConfigs = [
  {
    id: 'none',
    name: 'Không có nền',
    thumbnail: null,
    fullSize: null
  },
  {
    id: 'blur',
    name: 'Xóa phông',
    thumbnail: null,
    fullSize: 'blur'
  },
  {
    id: 'my-office',
    name: 'Văn phòng của tôi',
    thumbnail: backgroundImages.office,
    fullSize: backgroundImages.office
  },
  {
    id: 'my-beach',
    name: 'Bãi biển của tôi',
    thumbnail: backgroundImages.beach,
    fullSize: backgroundImages.beach
  },
  {
    id: 'my-forest',
    name: 'Rừng của tôi',
    thumbnail: backgroundImages.forest,
    fullSize: backgroundImages.forest
  },
];
```

### 3. Ví dụ thêm ảnh mới
Giả sử bạn có ảnh `my-photo.jpg`:

1. Đặt file vào thư mục `src/assets/backgrounds/my-photo.jpg`
2. Thêm import: `import myPhoto from './my-photo.jpg';`
3. Thêm vào backgroundImages: `myPhoto: myPhoto,`
4. Thêm vào backgroundConfigs:
```typescript
{
  id: 'my-photo',
  name: 'Ảnh của tôi',
  thumbnail: backgroundImages.myPhoto,
  fullSize: backgroundImages.myPhoto
}
```

### 4. Lưu ý
- Tên file không nên có khoảng trắng hoặc ký tự đặc biệt
- Sử dụng tên tiếng Anh cho file để tránh lỗi
- Ảnh nên có chất lượng cao để hiển thị đẹp
- Kích thước file không nên quá lớn để tải nhanh
