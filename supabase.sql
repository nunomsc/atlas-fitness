-- Executar uma vez no SQL Editor do projeto Supabase.
-- Uma linha por utilizador; o histórico inclui planos, notas e marcações.
create table if not exists public.atlas_histories (
  user_id uuid primary key references auth.users(id) on delete cascade,
  records jsonb not null default '[]'::jsonb check (jsonb_typeof(records) = 'array'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.atlas_histories enable row level security;
revoke all on public.atlas_histories from anon, authenticated;
grant select on public.atlas_histories to authenticated;
drop policy if exists atlas_read_own_history on public.atlas_histories;
create policy atlas_read_own_history on public.atlas_histories
  for select to authenticated using ((select auth.uid()) = user_id);

-- Escritas exclusivamente por esta função: verificação atómica da revisão.
-- O utilizador vem da sessão autenticada, nunca de um argumento do cliente.
create or replace function public.atlas_save_history(p_revision bigint, p_records jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  saved public.atlas_histories%rowtype;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  if p_revision is null or p_revision < 0 or p_records is null
     or jsonb_typeof(p_records) <> 'array' then
    raise exception 'Invalid history';
  end if;
  if p_revision = 0 then
    insert into public.atlas_histories(user_id, records)
      values (account_id, p_records)
      on conflict (user_id) do nothing returning * into saved;
  else
    update public.atlas_histories
      set records = p_records, revision = revision + 1, updated_at = now()
      where user_id = account_id and revision = p_revision
      returning * into saved;
  end if;
  if saved.user_id is not null then
    return jsonb_build_object('ok', true, 'revision', saved.revision);
  end if;
  select * into saved from public.atlas_histories where user_id = account_id;
  return jsonb_build_object('ok', false, 'revision', coalesce(saved.revision, 0),
    'records', coalesce(saved.records, '[]'::jsonb));
end;
$$;
revoke all on function public.atlas_save_history(bigint, jsonb) from public, anon;
grant execute on function public.atlas_save_history(bigint, jsonb) to authenticated;
