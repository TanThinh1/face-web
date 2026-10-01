import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
const K = 'sync_code_v1';
export const enabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const getCode = () => localStorage.getItem(K) || '';
export const setCode = c => (c ? localStorage.setItem(K, c) : localStorage.removeItem(K));
export const active = () => enabled() && getCode().length >= 8;

async function sid() {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('face-sync:' + getCode()));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function pull() {
  const rows = await rpc('get_faces', { p_id: await sid() });
  return rows[0] ? { data: rows[0].data, at: rows[0].updated_at } : null;
}
export async function push(data) { return rpc('put_faces', { p_id: await sid(), p_data: data }); }
