const KEY = 'faces_v1';
export function loadPeople() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
export function savePeople(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); }
  catch { alert('Không lưu được dữ liệu.'); }
}
