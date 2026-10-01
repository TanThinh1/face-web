import { loadPeople, savePeople } from './storage.js';
import { Camera } from './camera.js';
import { loadModels, detectAll, detectOne, buildMatcher, identify } from './recognizer.js';

const $ = id => document.getElementById(id);
const v = $('v'), cv = $('c'), ctx = cv.getContext('2d');
const cam = new Camera(v);
let people = loadPeople(), running = false, lastAlert = 0;
const status = t => ($('status').textContent = t);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderList() {
  const names = Object.keys(people);
  $('list').innerHTML = names.length
    ? names.map(n => `<div class="person"><div>${esc(n)} <small>· ${people[n].length} ảnh</small></div><button class="x" data-n="${encodeURIComponent(n)}">Xóa</button></div>`).join('')
    : '<div class="hint">Chưa có ai. Hãy đăng ký ít nhất một người.</div>';
}
$('list').onclick = e => {
  const n = e.target.dataset.n; if (!n) return;
  const name = decodeURIComponent(n);
  if (confirm('Xóa ' + name + '?')) { delete people[name]; savePeople(people); renderList(); }
};
$('th').oninput = () => ($('thv').textContent = (+$('th').value).toFixed(2));

async function openCam(fn) {
  try {
    await fn();
  } catch { status('Không mở được camera (cần HTTPS + cấp quyền)'); return; }
  $('c').parentElement.style.aspectRatio = v.videoWidth + '/' + v.videoHeight;
  cv.width = v.videoWidth; cv.height = v.videoHeight;
  ['btnFlip', 'btnSnap'].forEach(i => ($(i).disabled = false));
  $('btnCam').textContent = 'Tắt camera';
  if (!running) { running = true; loop(); }
}
function closeCam() {
  running = false; cam.stop(); ctx.clearRect(0, 0, cv.width, cv.height);
  $('btnCam').textContent = 'Bật camera';
  ['btnFlip', 'btnSnap'].forEach(i => ($(i).disabled = true));
  status('Đã tắt camera');
}
$('btnCam').onclick = () => (cam.active ? closeCam() : openCam(() => cam.start()));
$('btnFlip').onclick = () => openCam(() => cam.flip());

async function sendAlert() {
  if (!$('alertOn').checked || Date.now() - lastAlert < 30000) return;
  lastAlert = Date.now();
  try {
    const fd = new FormData(); fd.append('photo', await cam.snapshot(), 'unknown.jpg');
    const r = await fetch('/api/alert', { method: 'POST', body: fd });
    status(r.ok ? 'Đã gửi cảnh báo Telegram' : 'Gửi cảnh báo thất bại');
  } catch { status('Không kết nối được server'); }
}

async function loop() {
  if (!running) return;
  if (v.readyState >= 2) {
    const m = buildMatcher(people, +$('th').value);
    const res = await detectAll(v);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const W = cv.width, mirror = cam.facing === 'user';
    ctx.lineWidth = Math.max(2, W / 240);
    ctx.font = `bold ${Math.round(W / 30)}px system-ui`;
    let unknown = false;
    for (const r of res) {
      const b = r.detection.box, who = identify(m, r.descriptor);
      if (!who) unknown = true;
      const label = who ? `${who.name} (${Math.round(who.score * 100)}%)` : 'Người lạ';
      const x = mirror ? W - (b.x + b.width) : b.x, h = Math.round(W / 22);
      ctx.strokeStyle = ctx.fillStyle = who ? '#2dd4bf' : '#f87171';
      ctx.strokeRect(x, b.y, b.width, b.height);
      ctx.fillRect(x, Math.max(0, b.y - h), ctx.measureText(label).width + 12, h);
      ctx.fillStyle = '#04201c';
      ctx.fillText(label, x + 6, Math.max(h - 6, b.y - 6));
    }
    if (unknown && m) sendAlert();
    status(res.length ? `${res.length} khuôn mặt` : 'Không thấy khuôn mặt');
  }
  setTimeout(() => requestAnimationFrame(loop), 60);
}

const needName = () => {
  const n = $('name').value.trim();
  if (!n) { alert('Nhập tên trước đã.'); $('name').focus(); return null; }
  return n;
};
const addSample = (n, d) => { (people[n] ||= []).push(Array.from(d)); savePeople(people); renderList(); };

$('btnSnap').onclick = async () => {
  const n = needName(); if (!n) return;
  const res = await detectAll(v);
  if (res.length !== 1) return alert(res.length ? 'Chỉ để 1 người trong khung.' : 'Không thấy khuôn mặt.');
  addSample(n, res[0].descriptor); status('Đã lưu mẫu cho ' + n);
};
$('btnUp').onclick = () => needName() && $('file').click();
$('file').onchange = async e => {
  const n = $('name').value.trim(); let ok = 0;
  for (const f of e.target.files) {
    const r = await detectOne(await faceapi.bufferToImage(f));
    if (r) { addSample(n, r.descriptor); ok++; }
  }
  alert(`Đã thêm ${ok}/${e.target.files.length} ảnh cho ${n}.`); e.target.value = '';
};
$('btnExp').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(people)], { type: 'application/json' }));
  a.download = 'faces.json'; a.click();
};
$('btnImp').onclick = () => $('fimp').click();
$('fimp').onchange = async e => {
  try { Object.assign(people, JSON.parse(await e.target.files[0].text())); savePeople(people); renderList(); }
  catch { alert('File không hợp lệ.'); }
  e.target.value = '';
};

(async () => {
  renderList();
  try {
    await loadModels(); status('Sẵn sàng');
    ['btnCam', 'btnUp'].forEach(i => ($(i).disabled = false));
  } catch { status('Lỗi tải mô hình – kiểm tra mạng'); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
