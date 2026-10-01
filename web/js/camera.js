export class Camera {
  constructor(video) { this.video = video; this.stream = null; this.facing = 'user'; }
  get active() { return !!this.stream; }
  async start() {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    const v = this.video;
    v.srcObject = this.stream;
    v.classList.toggle('mirror', this.facing === 'user');
    await v.play().catch(() => {});
    if (!v.videoWidth) await new Promise(r => (v.onloadedmetadata = r));
  }
  flip() { this.facing = this.facing === 'user' ? 'environment' : 'user'; return this.start(); }
  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null; this.video.srcObject = null;
  }
  snapshot() {
    const c = document.createElement('canvas');
    c.width = this.video.videoWidth; c.height = this.video.videoHeight;
    c.getContext('2d').drawImage(this.video, 0, 0);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
  }
}
