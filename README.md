# Tạo Sub — Video Builder

Ứng dụng Electron nằm trực tiếp tại thư mục `tao-sub`, dùng để xem trước dữ liệu
và ghép ảnh theo timing từ SRT.

## Chạy ứng dụng

Yêu cầu: Node.js 20+ và FFmpeg có trong PATH.

```bash
yarn
yarn dev
```

## Build

```bash
yarn build
```

File Excel cần có hai cột `STT` và `Nội dung`. Ảnh phải bắt đầu bằng số scene,
ví dụ `1-anh.jpg`, `002.png`. Chế độ `Clips riêng` ghi các clip vào thư mục
`clips` cạnh đường dẫn output đã chọn. Mặc định video được lưu tại
`tao-sub/output.mp4`.
