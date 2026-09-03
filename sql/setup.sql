-- 롤랜챔: 로그인 사용자의 명단/전적 저장소
-- Neon 콘솔 > SQL Editor 에 그대로 붙여넣고 실행하세요.
--
-- 사용자당 한 행만 둡니다. 명단도 전적도 항상 배열째로 읽고 쓰는 데이터라
-- 정규화된 테이블이 이득이 없습니다. 나중에 전적을 SQL로 집계할 일이 생기면
-- 그때 matches만 별도 테이블로 분리하면 됩니다.

create table if not exists public.app_state (
  user_id    text primary key default auth.user_id(),
  roster     jsonb not null default '[]'::jsonb,
  matches    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Data API는 브라우저에서 DB를 직접 찌릅니다.
-- RLS가 없으면 아무나 남의 명단을 읽고 지울 수 있습니다. 반드시 켜세요.
alter table public.app_state enable row level security;

-- RLS는 GRANT 위에 얹히는 것이라 권한도 같이 줘야 합니다.
grant select, insert, update, delete on public.app_state to authenticated;

-- 자기 행에만 접근 가능. USING은 읽기/삭제, WITH CHECK는 쓰기 검사입니다.
drop policy if exists app_state_own_row on public.app_state;
create policy app_state_own_row
  on public.app_state
  for all
  to authenticated
  using (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

-- 로그인 안 한 사용자(anon)에게는 아무 권한도 주지 않습니다.
-- 비로그인 상태에서는 앱이 localStorage만 씁니다.
