"""Server tùy chọn: phục vụ web + gửi ảnh người lạ qua Telegram."""
import os
import httpx
from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles

app = FastAPI()
WEB = os.path.join(os.path.dirname(__file__), "..", "web")


@app.post("/api/alert")
async def alert(photo: UploadFile = File(...)):
    token, chat = os.getenv("TELEGRAM_BOT_TOKEN"), os.getenv("TELEGRAM_CHAT_ID")
    if not (token and chat):
        return {"ok": False, "error": "Thiếu TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID"}
    async with httpx.AsyncClient(timeout=20) as h:
        r = await h.post(
            f"https://api.telegram.org/bot{token}/sendPhoto",
            data={"chat_id": chat, "caption": "⚠️ Phát hiện người lạ"},
            files={"photo": (photo.filename or "unknown.jpg", await photo.read(), "image/jpeg")},
        )
    return {"ok": r.status_code == 200}


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
