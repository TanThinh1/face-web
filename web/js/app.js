import { loadPeople, savePeople, loadDirty, saveDirty } from './storage.js';
import { Camera } from './camera.js';
import { loadModels, detectLive, detectHQ, identify, Tracker } from './recognizer.js';
import * as Sync from './sync.js';

const $ = id => document.getElementById(id);
const v = $('v'), cv = $('c'), ctx = cv.getContext('2d');
const cam = new Camera(v), tracker = new Tracker();
let people = loadPeople(), dirty = loadDirty(), running = false, lastAlert = 0, busy = false;
const status = t => ($('status').textContent = t);
let hold = 0;
const note = (t, ms = 4000) => { status(t); hold = Date.now() + ms; };
const syncMsg = t => ($('syncState').textContent = t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderList() {
  const names = Object.keys(people);
  $('list').innerHTML = names.length
    ? names.map(n => `<div class="person"><div>${esc(n)} <small>· ${people[n].length} mẫu</small></div><button class="x" data-n="${encodeURIComponent(n)}">Xóa</button></div>`).join('')
    : '<div class="hint">Chưa có ai. Hãy đăng ký ít nhất một người.</div>';
}
const store = () => { savePeople(people); saveDirty(dirty); renderList(); };

// ---- Đồng bộ: có thay đổi chưa gửi -> gửi lên; không thì kéo bản mới nhất về ----
async function refresh() {
  if (!Sync.active()) { syncMsg(Sync.enabled() ? '· chưa nhập mã' : '· chưa cấu hình server'); return; }
  try {
    if (dirty) { await Sync.push(people); dirty = false; }
    else {
      const r = await Sync.pull();
      if (r) people = r.data; else if (Object.keys(people).length) await Sync.push(people);
    }
    store(); syncMsg('· ✓ đã đồng bộ ' + new Date().toLocaleTimeString('vi-VN'));
  } catch { syncMsg('· ⚠ mất kết nối, đang dùng dữ liệu trên máy'); }
}
const commit = async () => { dirty = true; store(); await refresh(); };

function addSample(n, d, minDist = 0.06) {
  const arr = (people[n] ||= []);
  if (arr.some(x => faceapi.euclideanDistance(x, d) < minDist)) return false;
  arr.push(Array.from(d, x => +x.toFixed(4)));
  if (arr.length > 10) arr.shift();
  return true;
}

$('btnSync').onclick = async () => {
  Sync.setCode($('syncCode').value.trim());
  if (!Sync.active()) return refresh();
  try { // lần đầu bật: gộp dữ liệu máy này với server rồi gửi lên
    const r = await Sync.pull();
    if (r) for (const [n, arr] of Object.entries(r.data)) arr.forEach(d => addSample(n, d, 0.02));
    await commit();
  } catch { syncMsg('· ⚠ không kết nối được server'); }
};
document.addEventListener('visibilitychange', () => !document.hidden && !busy && refresh());
window.addEventListener('focus', () => !busy && refresh());
window.addEventListener('unhandledrejection', e => note('Lỗi: ' + (e.reason?.message || e.reason), 8000));
setInterval(() => { if (!document.hidden && !busy) refresh(); }, 30000);

$('list').onclick = async e => {
  const n = e.target.dataset.n; if (!n) return;
  const name = decodeURIComponent(n);
  if (confirm('Xóa ' + name + '?')) { await refresh(); delete people[name]; await commit(); }
};
$('th').oninput = () => ($('thv').textContent = (+$('th').value).toFixed(2));

// ---- Camera ----
async function openCam(fn) {
  try { await fn(); } catch { status('Không mở được camera (cần HTTPS + cấp quyền)'); return; }
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
    note(r.ok ? 'Đã gửi cảnh báo Telegram' : 'Gửi cảnh báo thất bại');
  } catch { note('Không kết nối được server'); }
}

async function loop() {
  if (!running) return;
  if (busy) ctx.clearRect(0, 0, cv.width, cv.height);
  if (v.readyState >= 2 && !busy) {
    const items = tracker.update(await detectLive(v), performance.now());
    ctx.clearRect(0, 0, cv.width, cv.height);
    const W = cv.width, mirror = cam.facing === 'user', th = +$('th').value, has = Object.keys(people).length > 0;
    ctx.lineWidth = Math.max(3, W / 200);
    ctx.font = `bold ${Math.round(W / 28)}px system-ui`;
    let unknown = false;
    for (const it of items) {
      const b = it.det.detection.box; let label, col;
      if (!has) { label = 'Chưa có dữ liệu'; col = '#f59e0b'; }
      else if (it.n < 2) { label = 'Đang nhận diện…'; col = '#64748b'; }
      else {
        const r = identify(people, it.desc, th);
        if (r.status === 'ok') { label = `${r.name} (${Math.round((1 - r.dist) * 100)}%)`; col = '#0d9488'; }
        else if (r.status === 'unsure') { label = `Không chắc: ${r.name}?`; col = '#f59e0b'; }
        else { label = 'Người lạ'; col = '#dc2626'; if (it.n >= 4) unknown = true; }
      }
      const x = mirror ? W - (b.x + b.width) : b.x, h = Math.round(W / 20);
      ctx.strokeStyle = ctx.fillStyle = col;
      ctx.strokeRect(x, b.y, b.width, b.height);
      ctx.fillRect(x, Math.max(0, b.y - h), ctx.measureText(label).width + 14, h);
      ctx.fillStyle = '#fff'; ctx.fillText(label, x + 7, Math.max(h - 8, b.y - 8));
    }
    if (unknown) sendAlert();
    if (Date.now() > hold) status(items.length ? `${items.length} khuôn mặt` : 'Không thấy khuôn mặt');
  }
  setTimeout(() => requestAnimationFrame(loop), 40);
}

// ---- Đăng ký ----
const needName = () => {
  const n = $('name').value.trim();
  if (!n) { alert('Nhập tên trước đã.'); $('name').focus(); return null; }
  return n;
};
$('btnSnap').onclick = async () => {
  const n = needName(); if (!n) return;
  if (busy) return note('Đang xử lý, đợi chút…');
  busy = true;
  const why = { none: 0, multi: 0, small: 0, blur: 0, dup: 0 };
  let ok = 0;
  try {
    await refresh();
    for (let t = 1; t <= 10 && ok < 5; t++) {
      note(`Đang lấy mẫu ${ok}/5 – nhìn thẳng, xoay mặt nhẹ`, 3000);
      const res = await detectHQ(v);
      if (!res.length) why.none++;
      else if (res.length > 1) why.multi++;
      else {
        const f = res[0];
        if (f.detection.score < 0.7) why.blur++;
        else if (f.detection.box.width < v.videoWidth * 0.12) why.small++;
        else if (addSample(n, f.descriptor, 0.04)) ok++;
        else why.dup++;
      }
      await sleep(500);
    }
    if (ok) await commit();
  } catch (e) { console.error(e); note('Lỗi: ' + (e.message || e), 8000); return; }
  finally { busy = false; }
  if (ok) return note(`Đã lưu ${ok} mẫu cho ${n}` + (ok < 3 ? ' – nên chụp thêm, xoay mặt nhẹ' : ''), 6000);
  const lab = { none: 'không thấy mặt', multi: 'có nhiều hơn 1 mặt trong khung', small: 'mặt quá nhỏ, hãy lại gần', blur: 'ảnh mờ hoặc thiếu sáng', dup: 'mẫu trùng với mẫu đã có' };
  note('Chưa lưu được: ' + lab[Object.entries(why).sort((x, y) => y[1] - x[1])[0][0]], 6000);
};
$('btnUp').onclick = () => needName() && $('file').click();
$('file').onchange = async e => {
  const n = $('name').value.trim(), files = [...e.target.files];
  e.target.value = '';
  if (busy) return note('Đang xử lý, đợi chút…');
  busy = true; let ok = 0;
  try {
    await refresh();
    for (const f of files) {
      const res = await detectHQ(await faceapi.bufferToImage(f));
      if (res.length === 1 && res[0].detection.score >= 0.7 && addSample(n, res[0].descriptor, 0.02)) ok++;
    }
    if (ok) await commit();
  } catch (er) { console.error(er); note('Lỗi: ' + (er.message || er), 8000); return; }
  finally { busy = false; }
  note(`Đã thêm ${ok}/${files.length} ảnh cho ${n}` + (ok < files.length ? ' (ảnh không thấy mặt, nhiều mặt, mờ hoặc trùng bị bỏ qua)' : ''), 7000);
};

// ---- Xuất / nhập ----
$('btnExp').onclick = async () => {
  const f = new File([JSON.stringify(people)], 'faces.json', { type: 'application/json' });
  if (navigator.canShare?.({ files: [f] })) return navigator.share({ files: [f] }).catch(() => {});
  const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = 'faces.json'; a.click();
};
$('btnImp').onclick = () => $('fimp').click();
$('fimp').onchange = async e => {
  try { Object.assign(people, JSON.parse(await e.target.files[0].text())); await commit(); }
  catch { alert('File không hợp lệ.'); }
  e.target.value = '';
};

$('btnMenu').onclick = () => $('sheet').classList.toggle('open');
$('btnClose').onclick = () => $('sheet').classList.remove('open');
const root = document.documentElement;
if (!root.requestFullscreen) $('btnFull').hidden = true;
$('btnFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen());

(async () => {
  $('syncCode').value = Sync.getCode(); renderList(); refresh();
  try { await loadModels(); status('Sẵn sàng'); ['btnCam', 'btnUp'].forEach(i => ($(i).disabled = false)); }
  catch { status('Lỗi tải mô hình – kiểm tra mạng'); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
