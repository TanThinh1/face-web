const K = 'faces_v1', D = 'faces_dirty_v1';
export const loadPeople = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch { return {}; } };
export const savePeople = p => { try { localStorage.setItem(K, JSON.stringify(p)); } catch { alert('Không lưu được dữ liệu.'); } };
export const loadDirty = () => localStorage.getItem(D) === '1';
export const saveDirty = d => localStorage.setItem(D, d ? '1' : '0');
