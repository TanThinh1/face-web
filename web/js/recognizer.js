const MODEL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
// Live: nhanh. HQ (SSD): chính xác hơn, dùng khi đăng ký / tải ảnh.
const live = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
const hq = () => new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 });

export async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL),
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL),
  ]);
}
export const detectLive = i => faceapi.detectAllFaces(i, live()).withFaceLandmarks().withFaceDescriptors();
export const detectHQ = i => faceapi.detectAllFaces(i, hq()).withFaceLandmarks().withFaceDescriptors();

// Điểm của một người = trung bình khoảng cách của 2 mẫu gần nhất (ít bị kéo xuống bởi mẫu xấu)
function personDist(samples, d) {
  const ds = samples.map(s => faceapi.euclideanDistance(s, d)).sort((a, b) => a - b);
  const k = Math.min(2, ds.length);
  return ds.slice(0, k).reduce((a, b) => a + b, 0) / k;
}
// status: ok | unsure (2 người quá sát nhau) | unknown
export function identify(people, d, threshold, margin = 0.05) {
  const r = Object.entries(people).filter(([, s]) => s.length)
    .map(([name, s]) => ({ name, dist: personDist(s, d) })).sort((a, b) => a.dist - b.dist);
  const [a, b] = r;
  if (!a || a.dist > threshold) return { status: 'unknown', dist: a ? a.dist : 1 };
  if (b && b.dist <= threshold && b.dist - a.dist < margin) return { status: 'unsure', name: a.name, dist: a.dist };
  return { status: 'ok', name: a.name, dist: a.dist };
}

// Theo dõi khuôn mặt qua các khung hình và lấy trung bình descriptor để giảm nhiễu
const mean = ds => { const m = new Float32Array(128); ds.forEach(d => d.forEach((x, i) => (m[i] += x / ds.length))); return m; };
export class Tracker {
  constructor() { this.t = []; this.id = 0; }
  update(dets, now) {
    this.t = this.t.filter(k => now - k.seen < 1000);
    const used = new Set(), out = [];
    for (const d of dets) {
      const b = d.detection.box, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      let best = null, bd = Infinity;
      for (const k of this.t) {
        if (used.has(k)) continue;
        const dist = Math.hypot(k.cx - cx, k.cy - cy);
        if (dist < bd && dist < b.width * 0.8) { bd = dist; best = k; }
      }
      if (!best) { best = { id: ++this.id, descs: [] }; this.t.push(best); }
      used.add(best); Object.assign(best, { cx, cy, seen: now });
      best.descs.push(d.descriptor); if (best.descs.length > 6) best.descs.shift();
      out.push({ det: d, desc: mean(best.descs), n: best.descs.length });
    }
    return out;
  }
}
