# Web nhận diện khuôn mặt (PWA)

Nhận diện khuôn mặt chạy trực tiếp trên trình duyệt (face-api), dùng được trên máy tính và điện thoại,
cài được như app. Ý tưởng lấy từ DeepCamera (skill `face-detection-recognition`) nhưng không cần Docker/GPU.

## Cấu trúc
face-web/
├── web/                    # Toàn bộ giao diện (tĩnh)
│   ├── index.html
│   ├── manifest.webmanifest, sw.js   # PWA + cache offline
│   ├── css/style.css
│   ├── js/app.js           # Giao diện + vòng lặp nhận diện
│   ├── js/camera.js        # Bật/tắt/đổi camera, chụp khung hình
│   ├── js/recognizer.js    # Tải mô hình, phát hiện, so khớp
│   ├── js/storage.js       # Lưu danh sách khuôn mặt (localStorage)
│   └── icons/icon.svg
├── server/                 # Tùy chọn: cảnh báo Telegram
│   ├── main.py
│   └── requirements.txt
├── .github/workflows/pages.yml   # Tự deploy HTTPS lên GitHub Pages
└── .env.example

## Chạy trên máy tính
Chỉ giao diện:
    python -m http.server 8000 --directory web
Có cảnh báo Telegram:
    pip install -r server/requirements.txt
    export TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
    uvicorn server.main:app --host 0.0.0.0 --port 8000
Mở http://localhost:8000

## Chạy trên điện thoại (camera cần HTTPS)
- Cách 1 (dễ nhất): đẩy repo lên GitHub -> Settings -> Pages -> Source: GitHub Actions.
  Mở https://<user>.github.io/<repo>/ trên điện thoại -> "Thêm vào màn hình chính".
  (Bản này không có cảnh báo Telegram vì không có server.)
- Cách 2 (có Telegram): chạy server rồi mở tunnel HTTPS: cloudflared tunnel --url http://localhost:8000

## Ghi chú
- Lần đầu cần mạng để tải mô hình (vài MB), sau đó được cache.
- Lưu vector 128 số (không phải ảnh) trong trình duyệt; có nút xuất/nhập JSON.
- Chỉ đăng ký/nhận diện người đã đồng ý.
