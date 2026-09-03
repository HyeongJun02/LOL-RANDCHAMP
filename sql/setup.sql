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


-- ============================================================
-- 계정당 저장 한도
-- ============================================================
-- Data API는 브라우저가 DB를 직접 찌르는 구조라, 앱 코드의 한도는
-- 우회하면 그만이다. 실제 방어는 여기서 한다.
--
-- src/limits.js의 숫자와 맞춰둘 것. 한쪽만 바꾸면 화면에서는 되는데
-- 저장이 거절당하는 상황이 된다.
--
-- CHECK 제약이 아니라 트리거를 쓰는 이유: CHECK는 IMMUTABLE 함수만
-- 허용해서 크기 계산(pg_column_size 등)을 넣을 수 없고, 어떤 한도에
-- 걸렸는지 구분된 메시지를 줄 수도 없다.

create or replace function public.enforce_app_state_limits()
returns trigger
language plpgsql
as $$
declare
  -- 관리자는 한도 없음
  admin_id  constant text := '56a0f45a-26de-46f6-8edf-38b592a6caf7';
  max_roster  constant int := 60;
  max_matches constant int := 300;
  -- 배열 개수와 별개로, 한 행이 통째로 커지는 것도 막는다
  max_bytes constant int := 120000;
begin
  if new.user_id = admin_id then
    return new;
  end if;

  if jsonb_array_length(coalesce(new.roster, '[]'::jsonb)) > max_roster then
    raise exception '팀원은 최대 %명까지 저장할 수 있습니다.', max_roster
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(coalesce(new.matches, '[]'::jsonb)) > max_matches then
    raise exception '내전 기록은 최대 %경기까지 저장할 수 있습니다.', max_matches
      using errcode = 'check_violation';
  end if;

  if octet_length(coalesce(new.roster, '[]'::jsonb)::text)
     + octet_length(coalesce(new.matches, '[]'::jsonb)::text) > max_bytes then
    raise exception '저장 용량이 계정 한도를 넘었습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists app_state_limits on public.app_state;
create trigger app_state_limits
  before insert or update on public.app_state
  for each row execute function public.enforce_app_state_limits();
