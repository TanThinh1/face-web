-- Chạy trong Supabase → SQL Editor. Bảng bị khóa hoàn toàn; chỉ truy cập qua 2 hàm bên dưới
-- bằng "id" (hash của mã đồng bộ), nên không ai liệt kê hay đọc được dữ liệu người khác.
create table if not exists face_sync (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table face_sync enable row level security;

create or replace function get_faces(p_id text)
returns table(data jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select data, updated_at from face_sync where id = p_id;
$$;

create or replace function put_faces(p_id text, p_data jsonb)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if length(p_id) <> 64 then raise exception 'bad id'; end if;
  if pg_column_size(p_data) > 1000000 then raise exception 'too large'; end if;
  insert into face_sync(id, data, updated_at) values (p_id, p_data, t)
  on conflict (id) do update set data = excluded.data, updated_at = t;
  return t;
end $$;

revoke all on function get_faces(text), put_faces(text, jsonb) from public;
grant execute on function get_faces(text), put_faces(text, jsonb) to anon;
