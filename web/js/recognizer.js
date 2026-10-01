const MODEL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
const opt = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

export async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL),
  ]);
}
export const detectAll = input =>
  faceapi.detectAllFaces(input, opt()).withFaceLandmarks().withFaceDescriptors();
export const detectOne = input =>
  faceapi.detectSingleFace(input, opt()).withFaceLandmarks().withFaceDescriptor();

export function buildMatcher(people, threshold) {
  const labeled = Object.entries(people).map(([n, ds]) =>
    new faceapi.LabeledFaceDescriptors(n, ds.map(d => new Float32Array(d))));
  return labeled.length ? new faceapi.FaceMatcher(labeled, threshold) : null;
}
export function identify(matcher, descriptor) {
  if (!matcher) return null;
  const b = matcher.findBestMatch(descriptor);
  return b.label === 'unknown' ? null : { name: b.label, score: 1 - b.distance };
}
