-- 롤랜챔: 계정별 팀원 명단 / 내전 전적 스키마
--
-- 실행 방법: Neon 콘솔 > SQL Editor에 이 파일 내용을 붙여넣고 실행.
-- 전제 조건: Neon 콘솔에서 "Auth" 탭을 눌러 Managed Better Auth를 먼저
-- 활성화해 두어야 한다 (그래야 auth.user_id() 함수와 neon_auth.user 테이블이 생긴다).
-- 이 스키마를 실행한 뒤에는 "Data API" 탭에서 Data API도 활성화할 것 —
-- 활성화 시 Neon이 public 스키마에 대해 authenticated 롤에게 필요한
-- GRANT를 자동으로 걸어준다.

-- ---------- 내 팀원 명단 (roster.js가 쓰던 localStorage를 대체) ----------

create table if not exists roster_members (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default auth.user_id(),
  name text not null default '',
  tier text not null default 'GOLD',
  division int not null default 4,
  lines text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists roster_members_user_id_idx on roster_members (user_id);

alter table roster_members enable row level security;

create policy "select own roster" on roster_members
  for select using (auth.user_id() = user_id);

create policy "insert own roster" on roster_members
  for insert with check (auth.user_id() = user_id);

create policy "update own roster" on roster_members
  for update using (auth.user_id() = user_id) with check (auth.user_id() = user_id);

create policy "delete own roster" on roster_members
  for delete using (auth.user_id() = user_id);

-- ---------- 내전 전적 (matches.js가 쓰던 localStorage를 대체) ----------

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default auth.user_id(),
  mode text not null check (mode in ('aram', 'normal')),
  team_a text[] not null,
  team_b text[] not null,
  winner text not null check (winner in ('A', 'B')),
  played_at timestamptz not null default now()
);

create index if not exists matches_user_id_idx on matches (user_id);

alter table matches enable row level security;

create policy "select own matches" on matches
  for select using (auth.user_id() = user_id);

create policy "insert own matches" on matches
  for insert with check (auth.user_id() = user_id);

create policy "delete own matches" on matches
  for delete using (auth.user_id() = user_id);
