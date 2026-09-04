-- 롤랜챔 스키마
-- Neon 콘솔 > SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 됩니다.
--
-- 주의: 이 스크립트는 app_state.matches 컬럼을 지웁니다.
--       개인 계정에 쌓여 있던 내전 기록이 사라집니다(명세서 B 결정).
--       내전 기록은 이제 '방' 안에만 있습니다.

-- ------------------------------------------------------------
-- 굴려보고 정하는 숫자들 (여기 목록만 보면 어디를 고칠지 알 수 있다)
-- ------------------------------------------------------------
-- 화면 쪽 값은 src/tuning.js 한 파일에 다 모아뒀다. 아래 것들은
-- 서버가 실제로 지급·거절에 쓰는 값이라 이 파일에서 고치고 다시 실행해야
-- 한다. 짝이 되는 값이 tuning.js에도 있으면 같이 고칠 것.
--
--   place_bets       … 마켓별 1인 상한 (퍼블 2000 / 언더오버 3000)
--                      → tuning.js BET_CAP
--   lock_betting     … 퍼블 배당 n * 0.85, 티어당 +2%, 언더오버 1.98
--                      → tuning.js FIRST_BLOOD_RATE / TIER_BONUS / KILLS_ODDS
--   award_participation … 경기 참여 보상 (승 1500 / 패 1000)
--                      → tuning.js SCRIM_REWARD
--   roll_season      … 매월 1일 되돌릴 끼꼬 (10000)
--                      → tuning.js MONTHLY_KKIKO
--   adjust_points    … 방장이 한 번에 조정할 수 있는 폭 (100000)
--                      → tuning.js ADJUST_CAP
--   open_betting     … 배팅 시간 허용 범위 (30초 ~ 60분)
--   enforce_room_limits … 방/멤버/참가자/경기 한도 → src/limits.js
--
-- 총 킬 기준선은 서버에 없다. 화면이 정해서 마켓 이름('kills_53.5')에
-- 박아 보내므로 tuning.js의 KILLS_PER_PLAYER만 고치면 된다.

-- ============================================================
-- 0. 공용
-- ============================================================

-- 관리자는 모든 한도에서 제외. src/limits.js와 같은 값이어야 한다.
create or replace function public.admin_id()
returns text language sql immutable as $fn$
  select '56a0f45a-26de-46f6-8edf-38b592a6caf7'::text;
$fn$;

-- 내전은 우리 동네 밤에 한다. 달 경계도 KST 기준.
create or replace function public.now_month()
returns text language sql stable as $fn$
  select to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
$fn$;


-- ============================================================
-- 1. 팀원 명단 (기존)
-- ============================================================
-- 로그인 안 해도 쓰는 도구(라인 분배, 랜덤 뽑기)가 계속 참조하므로 남긴다.
-- 내전 기록만 방으로 옮겨간다.

create table if not exists public.app_state (
  user_id    text primary key default auth.user_id(),
  roster     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state drop column if exists matches;

alter table public.app_state enable row level security;
grant select, insert, update, delete on public.app_state to authenticated;

drop policy if exists app_state_own_row on public.app_state;
create policy app_state_own_row on public.app_state
  for all to authenticated
  using (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

-- Data API는 브라우저가 DB를 직접 찌른다. 앱 코드의 한도는 우회하면 그만이라
-- 실제 방어는 여기서 한다. CHECK가 아니라 트리거인 이유: CHECK는 IMMUTABLE
-- 함수만 허용해서 크기 계산을 넣을 수 없고, 어디에 걸렸는지 구분도 못 한다.
create or replace function public.enforce_app_state_limits()
returns trigger language plpgsql as $fn$
begin
  if new.user_id = public.admin_id() then
    return new;
  end if;
  if jsonb_array_length(coalesce(new.roster, '[]'::jsonb)) > 60 then
    raise exception '팀원은 최대 60명까지 저장할 수 있습니다.' using errcode = 'check_violation';
  end if;
  if octet_length(coalesce(new.roster, '[]'::jsonb)::text) > 60000 then
    raise exception '저장 용량이 계정 한도를 넘었습니다.' using errcode = 'check_violation';
  end if;
  return new;
end; $fn$;

drop trigger if exists app_state_limits on public.app_state;
create trigger app_state_limits
  before insert or update on public.app_state
  for each row execute function public.enforce_app_state_limits();


-- ============================================================
-- 2. 사용자 (끼꼬 포인트)
-- ============================================================
-- points는 클라이언트가 절대 직접 못 쓴다. 콘솔에서 update 한 줄이면
-- 잔액이 999999999가 되기 때문이다. 아래 GRANT에서 nickname 컬럼만 연다.

create table if not exists public.profiles (
  user_id            text primary key default auth.user_id(),
  nickname           text,
  -- 옛 계정 단위 잔액. 이제 방마다 room_wallets를 쓴다.
  -- 지우면 이 표를 통째로 돌려주는 get_me()의 반환 타입이 바뀌어서 남겨둔다.
  points             int  not null default 10000,
  points_month       text not null default public.now_month(),
  role               text not null default 'user',
  agreed_fairplay_at timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;


-- ============================================================
-- 3. 방
-- ============================================================

create table if not exists public.rooms (
  id         bigint generated always as identity primary key,
  name       text not null,
  join_code  text not null unique,
  owner_id   text not null default auth.user_id(),
  version    int  not null default 0,
  created_at timestamptz not null default now()
);

-- 끼꼬 잔액은 계정이 아니라 '방 안'에 있다.
--
-- 계정 하나에 잔액 하나면, 혼자(또는 친구 한 명과) 방을 새로 만들어서
-- 서로 몰아주기만 해도 본방 잔액이 불어난다. 방마다 지갑을 따로 두면
-- 그렇게 만든 끼꼬는 그 방 밖으로 못 나간다.
create table if not exists public.room_wallets (
  room_id      bigint not null references public.rooms(id) on delete cascade,
  user_id      text   not null,
  points       int    not null default 10000,
  points_month text   not null default public.now_month(),
  primary key (room_id, user_id)
);

create table if not exists public.room_members (
  room_id   bigint not null references public.rooms(id) on delete cascade,
  user_id   text   not null,
  role      text   not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user on public.room_members (user_id);

-- 방 색과 엠블럼. 방마다 다른 색이 돌면 '우리 방'이라는 게 생긴다.
-- 색은 키만 저장한다. 임의의 CSS 값을 넣게 두면 그걸로 화면을 망가뜨릴 수 있다.
alter table public.rooms add column if not exists accent text not null default 'gold';
alter table public.rooms drop constraint if exists rooms_accent_chk;
alter table public.rooms add constraint rooms_accent_chk
  check (accent in ('gold', 'blue', 'green', 'purple', 'red', 'cyan'));

alter table public.rooms add column if not exists emblem text not null default '⚔️';
alter table public.rooms drop constraint if exists rooms_emblem_chk;
alter table public.rooms add constraint rooms_emblem_chk
  check (length(emblem) between 1 and 8);

-- 유령 멤버: 사이트에 가입하기 싫다는 친구를 방장이 대신 만들어 준다.
-- 계정이 없으니 로그인해서 들어올 수는 없고, 참가자와 묶어 두기 위한
-- 자리표시자다. user_id는 'ghost:<uuid>'로 실제 계정과 절대 겹치지 않는다.
alter table public.room_members add column if not exists is_ghost boolean not null default false;

-- 그 방에서 뛰는 사람. 계정 없는 손님도 linked_user_id 없이 들어온다.
create table if not exists public.room_players (
  id             bigint generated always as identity primary key,
  room_id        bigint not null references public.rooms(id) on delete cascade,
  name           text   not null,
  tier           text   not null default 'GOLD',
  division       int    not null default 4,
  linked_user_id text,
  unique (room_id, name)
);
create index if not exists room_players_room on public.room_players (room_id);

-- 팀은 room_players.id 배열로 담는다. 이름으로 담으면 이름을 바꿀 때마다
-- 경기를 전부 훑어 갈아야 하고, 놓치면 한 사람이 두 명으로 갈라진다.
create table if not exists public.scrims (
  id         bigint generated always as identity primary key,
  room_id    bigint not null references public.rooms(id) on delete cascade,
  mode       text   not null check (mode in ('aram','normal')),
  team_a     jsonb  not null,
  team_b     jsonb  not null,
  winner     text   check (winner in ('A','B')),
  created_by text   not null default auth.user_id(),
  played_at  timestamptz not null default now()
);
create index if not exists scrims_room_played on public.scrims (room_id, played_at desc);

create table if not exists public.hall_of_fame (
  room_id      bigint not null references public.rooms(id) on delete cascade,
  month        text   not null,
  user_id      text   not null,
  display_name text   not null,
  kkiko_points int    not null,
  primary key (room_id, month, user_id)
);


-- 재귀 차단.
-- rooms 정책은 "내가 이 방 멤버인가"를 물으려고 room_members를 읽는다.
-- 그런데 room_members 정책도 같은 걸 물으면 정책이 자기를 다시 부른다.
-- SECURITY DEFINER 함수는 RLS를 건너뛰므로 여기서 고리를 끊는다.
create or replace function public.is_room_member(rid bigint)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from room_members where room_id = rid and user_id = auth.user_id()
  );
$fn$;

create or replace function public.is_room_admin(rid bigint)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from room_members
     where room_id = rid and user_id = auth.user_id() and role in ('owner','admin')
  );
$fn$;

create or replace function public.is_room_owner(rid bigint)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from rooms where id = rid and owner_id = auth.user_id());
$fn$;


-- 같은 방 사람의 닉네임과 끼꼬는 봐야 순위를 만든다.
-- 방을 공유하지 않는 남의 프로필은 안 보인다.
drop policy if exists profiles_visible on public.profiles;
create policy profiles_visible on public.profiles
  for select to authenticated
  using (
    user_id = auth.user_id()
    or exists (
      select 1
        from public.room_members a
        join public.room_members b on b.room_id = a.room_id
       where a.user_id = auth.user_id()
         and b.user_id = public.profiles.user_id
    )
  );

-- 닉네임만 열어준다. points/role은 아래 GRANT에서 컬럼 단위로 막혀
-- 함수로만 움직인다.
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles
  for update to authenticated
  using (user_id = auth.user_id())
  with check (user_id = auth.user_id());

grant select on public.profiles to authenticated;
grant update (nickname) on public.profiles to authenticated;


-- 시즌 (월간 초기화)
create table if not exists public.app_season (
  id            int primary key default 1 check (id = 1),
  current_month text not null,
  rolled_at     timestamptz not null default now()
);
insert into public.app_season (id, current_month)
  values (1, public.now_month())
  on conflict (id) do nothing;

grant select on public.app_season to authenticated;


-- 매월 1일 끼꼬를 10,000으로 되돌린다. Neon 무료에 스케줄러가 없어
-- 크론 대신 로그인할 때(get_me) 확인하는 지연 실행이다.
--
-- 여러 달이 밀려도 한 번에 처리된다. 중간 달들은 아무도 안 들어온 달이라
-- 남길 기록이 없고, 마지막으로 알던 달(cur) 이름으로 한 번만 박제한다.
create or replace function public.roll_season()
returns void language plpgsql security definer set search_path = public as $fn$
declare
  m   text := public.now_month();
  cur text;
begin
  -- 흔한 경우(같은 달)에 잠금까지 가지 않도록 먼저 싸게 확인한다
  if (select current_month from app_season where id = 1) >= m then
    return;
  end if;

  -- 두 명이 동시에 들어오면 둘 다 롤할 수 있다. 잠근 뒤 다시 읽어야 한다.
  -- 먼저 읽고 잠그면 둘 다 옛 값을 보고 통과한다.
  select current_month into cur from app_season where id = 1 for update;
  if cur >= m then
    return;
  end if;

  -- 초기화 전에 박제. 끼꼬만 남기면 된다 - 내전 성적은 scrims에 그대로 있어
  -- 언제든 그 달만 떼어 다시 계산할 수 있다.
  insert into hall_of_fame (room_id, month, user_id, display_name, kkiko_points)
  select w.room_id, cur, w.user_id, coalesce(nullif(p.nickname, ''), '이름없음'), w.points
    from room_wallets w
    join profiles p on p.user_id = w.user_id
  on conflict (room_id, month, user_id) do nothing;

  -- 방마다 따로 초기화된다. 한 방에서 잘 벌었다고 다른 방이 따라 오르지 않는다
  update room_wallets set points = 10000, points_month = m;
  update app_season set current_month = m, rolled_at = now() where id = 1;
end; $fn$;


-- 로그인 직후 클라이언트가 부르는 유일한 부트스트랩.
-- 프로필이 없으면 만들고, 달이 넘어갔으면 여기서 시즌을 롤한다.
create or replace function public.get_me()
returns public.profiles language plpgsql security definer set search_path = public as $fn$
declare me profiles;
begin
  perform public.roll_season();
  insert into profiles (user_id) values (auth.user_id()) on conflict (user_id) do nothing;
  select * into me from profiles where user_id = auth.user_id();
  return me;
end; $fn$;


alter table public.rooms         enable row level security;
alter table public.room_wallets  enable row level security;
alter table public.room_members  enable row level security;
alter table public.room_players  enable row level security;
alter table public.scrims        enable row level security;
alter table public.hall_of_fame  enable row level security;

-- 입장 코드는 컬럼 단위로 뺀다. 멤버 전원이 코드를 볼 수 있으면
-- 재발급이 아무 의미가 없다. 방장·부방장은 get_join_code()로 본다.
grant select (id, name, owner_id, version, created_at, accent, emblem) on public.rooms to authenticated;
grant update (name, accent, emblem) on public.rooms to authenticated;
grant select on public.room_members to authenticated;
-- 잔액은 같은 방 사람끼리 서로 본다 (포인트 탭의 순위가 그것이다).
-- 쓰기는 안 연다. 열면 콘솔 한 줄로 자기 잔액을 고칠 수 있다.
grant select on public.room_wallets to authenticated;
grant select on public.hall_of_fame to authenticated;
grant select, insert, update, delete on public.room_players to authenticated;
grant select, insert, delete on public.scrims to authenticated;

drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms
  for select to authenticated using (public.is_room_member(id));

drop policy if exists rooms_admin_edit on public.rooms;
create policy rooms_admin_edit on public.rooms
  for update to authenticated
  using (public.is_room_admin(id)) with check (public.is_room_admin(id));

drop policy if exists members_read on public.room_members;
create policy members_read on public.room_members
  for select to authenticated using (public.is_room_member(room_id));

drop policy if exists wallets_read on public.room_wallets;
create policy wallets_read on public.room_wallets
  for select to authenticated using (public.is_room_member(room_id));

drop policy if exists players_read on public.room_players;
create policy players_read on public.room_players
  for select to authenticated using (public.is_room_member(room_id));

drop policy if exists players_admin_write on public.room_players;
create policy players_admin_write on public.room_players
  for all to authenticated
  using (public.is_room_admin(room_id)) with check (public.is_room_admin(room_id));

drop policy if exists scrims_read on public.scrims;
create policy scrims_read on public.scrims
  for select to authenticated using (public.is_room_member(room_id));

drop policy if exists scrims_admin_write on public.scrims;
create policy scrims_admin_write on public.scrims
  for all to authenticated
  using (public.is_room_admin(room_id)) with check (public.is_room_admin(room_id));

drop policy if exists hof_read on public.hall_of_fame;
create policy hof_read on public.hall_of_fame
  for select to authenticated using (public.is_room_member(room_id));


-- 한도. 방 5 / 멤버 50 / 참가자 50 / 경기 1000 (명세서 F).
-- src/limits.js와 같은 값이어야 한다. 한쪽만 바꾸면 화면에서는 되는데
-- 저장이 거절당한다.
create or replace function public.enforce_room_limits()
returns trigger language plpgsql as $fn$
declare n int;
begin
  if tg_table_name = 'room_players' then
    select count(*) into n from room_players where room_id = new.room_id;
    if n >= 50 then
      raise exception '방 참가자는 최대 50명까지예요.' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'scrims' then
    select count(*) into n from scrims where room_id = new.room_id;
    if n >= 1000 then
      raise exception '한 방에 최대 1000경기까지 남길 수 있어요. 오래된 기록을 지워주세요.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end; $fn$;

drop trigger if exists room_players_limit on public.room_players;
create trigger room_players_limit before insert on public.room_players
  for each row execute function public.enforce_room_limits();

drop trigger if exists scrims_limit on public.scrims;
create trigger scrims_limit before insert on public.scrims
  for each row execute function public.enforce_room_limits();


-- 방에 뭔가 바뀌면 version을 올린다. 클라이언트는 이 한 컬럼만 폴링하고,
-- 값이 달라졌을 때만 상세를 다시 받는다. Data API에 실시간 구독이 없어서
-- 폴링이 불가피한데, 방 전체를 매번 읽으면 그게 곧 DB 부하다.
create or replace function public.bump_room_version()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  update rooms set version = version + 1
   where id = coalesce(new.room_id, old.room_id);
  return null;
end; $fn$;

drop trigger if exists scrims_bump on public.scrims;
create trigger scrims_bump after insert or update or delete on public.scrims
  for each row execute function public.bump_room_version();

drop trigger if exists players_bump on public.room_players;
create trigger players_bump after insert or update or delete on public.room_players
  for each row execute function public.bump_room_version();

drop trigger if exists members_bump on public.room_members;
create trigger members_bump after insert or update or delete on public.room_members
  for each row execute function public.bump_room_version();


-- ============================================================
-- 4. 방 함수
-- ============================================================
-- 헷갈리는 0/O/1/I는 뺀다. 코드는 입으로 불러주는 값이다.
create or replace function public.new_join_code()
returns text language sql volatile as $fn$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
  from generate_series(1, 6);
$fn$;

-- 방에 들어온 사람에게 지갑을 하나 준다. 이미 있으면 그대로 둔다
-- (나갔다 다시 들어와도 잔액이 초기화되면 안 된다).
create or replace function public.ensure_wallet(p_room bigint, p_user text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  insert into room_wallets (room_id, user_id) values (p_room, p_user)
  on conflict (room_id, user_id) do nothing;
end; $fn$;


create or replace function public.create_room(p_name text)
returns public.rooms language plpgsql security definer set search_path = public as $fn$
declare
  me   text := auth.user_id();
  n    int;
  room rooms;
begin
  if me is null then raise exception '로그인이 필요해요.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception '방 이름을 적어주세요.'; end if;

  if me <> public.admin_id() then
    select count(*) into n from rooms where owner_id = me;
    if n >= 3 then raise exception '방은 최대 3개까지 만들 수 있어요.'; end if;
  end if;

  insert into profiles (user_id) values (me) on conflict (user_id) do nothing;

  -- 코드가 겹치면 다시 뽑는다. 32^6이라 거의 안 겹치지만 unique가 막아준다.
  for i in 1..5 loop
    begin
      insert into rooms (name, join_code, owner_id)
        values (trim(p_name), public.new_join_code(), me)
        returning * into room;
      exit;
    exception when unique_violation then
      if i = 5 then raise; end if;
    end;
  end loop;

  insert into room_members (room_id, user_id, role) values (room.id, me, 'owner');
  perform public.ensure_wallet(room.id, me);
  return room;
end; $fn$;


create or replace function public.join_room(p_code text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare
  me  text := auth.user_id();
  rid bigint;
  n   int;
begin
  if me is null then raise exception '로그인이 필요해요.'; end if;

  select id into rid from rooms where join_code = upper(trim(p_code));
  if rid is null then raise exception '그런 입장 코드가 없어요.'; end if;

  -- 이미 멤버면 그냥 방 번호만 준다. 한 번 들어온 방은 코드 없이 다시 들어온다.
  if exists (select 1 from room_members where room_id = rid and user_id = me) then
    return rid;
  end if;

  select count(*) into n from room_members where room_id = rid;
  if n >= 50 then raise exception '이 방은 인원이 가득 찼어요.'; end if;

  insert into profiles (user_id) values (me) on conflict (user_id) do nothing;
  insert into room_members (room_id, user_id) values (rid, me);
  perform public.ensure_wallet(rid, me);
  return rid;
end; $fn$;


create or replace function public.get_join_code(p_room bigint)
returns text language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_room_admin(p_room) then
    raise exception '방장과 부방장만 입장 코드를 볼 수 있어요.';
  end if;
  return (select join_code from rooms where id = p_room);
end; $fn$;


create or replace function public.reset_join_code(p_room bigint)
returns text language plpgsql security definer set search_path = public as $fn$
declare code text;
begin
  if not public.is_room_owner(p_room) then
    raise exception '방장만 입장 코드를 새로 뽑을 수 있어요.';
  end if;
  for i in 1..5 loop
    begin
      update rooms set join_code = public.new_join_code()
       where id = p_room returning join_code into code;
      exit;
    exception when unique_violation then
      if i = 5 then raise; end if;
    end;
  end loop;
  return code;
end; $fn$;


create or replace function public.set_member_role(p_room bigint, p_user text, p_role text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_room_owner(p_room) then
    raise exception '방장만 권한을 바꿀 수 있어요.';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception '부방장 또는 멤버로만 바꿀 수 있어요.';
  end if;
  -- 방장이 스스로를 강등하면 그 방에 방장이 없어진다.
  -- 방장 자리를 넘기는 건 transfer_room으로 한다.
  if p_user = auth.user_id() then
    raise exception '자기 권한은 바꿀 수 없어요.';
  end if;
  update room_members set role = p_role where room_id = p_room and user_id = p_user;
end; $fn$;


create or replace function public.transfer_room(p_room bigint, p_user text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_room_owner(p_room) then
    raise exception '방장만 방을 넘길 수 있어요.';
  end if;
  if not exists (select 1 from room_members where room_id = p_room and user_id = p_user) then
    raise exception '그 사람은 이 방 멤버가 아니에요.';
  end if;
  update rooms set owner_id = p_user where id = p_room;
  update room_members set role = 'admin' where room_id = p_room and user_id = auth.user_id();
  update room_members set role = 'owner' where room_id = p_room and user_id = p_user;
end; $fn$;


create or replace function public.kick_member(p_room bigint, p_user text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_room_admin(p_room) then
    raise exception '방장과 부방장만 내보낼 수 있어요.';
  end if;
  if p_user = (select owner_id from rooms where id = p_room) then
    raise exception '방장은 내보낼 수 없어요.';
  end if;
  -- 나간 사람이 참가자에 묶인 채로 남으면, 그 참가자는 없는 계정을
  -- 가리키게 되고 참여 포인트가 허공으로 나간다
  update room_players set linked_user_id = null
   where room_id = p_room and linked_user_id = p_user;
  delete from room_members where room_id = p_room and user_id = p_user;
end; $fn$;


-- 멤버 ↔ 참가자 묶기.
--
-- '이 계정이 곧 이 참가자다'를 방장이 정해준다. 묶어두면 경기 참여
-- 포인트가 자동으로 가고, 나중에 '자기 경기에는 못 걸게' 같은 것도
-- 이 연결 하나로 판단할 수 있다.
--
-- 한 사람은 한 참가자에만, 한 참가자는 한 사람에게만 묶인다.
-- (room_players.linked_user_id 컬럼 + room_players_one_account 유니크)
-- p_player가 null이면 연결을 끊는다.
create or replace function public.link_room_player(
  p_room bigint, p_user text, p_player bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare owner_of text;
begin
  if not public.is_room_admin(p_room) then
    raise exception '방장과 부방장만 참가자를 연결할 수 있어요.';
  end if;
  if not exists (select 1 from room_members where room_id = p_room and user_id = p_user) then
    raise exception '그 사람은 이 방 멤버가 아니에요.';
  end if;

  -- 옮겨 묶는 것도 되어야 한다. 먼저 이 사람의 옛 연결부터 푼다
  update room_players set linked_user_id = null
   where room_id = p_room and linked_user_id = p_user;

  if p_player is null then return; end if;

  select linked_user_id into owner_of from room_players
   where id = p_player and room_id = p_room;
  if not found then
    raise exception '그 참가자는 이 방에 없어요.';
  end if;
  if owner_of is not null and owner_of <> p_user then
    raise exception '그 참가자는 이미 다른 멤버와 연결돼 있어요.';
  end if;

  update room_players set linked_user_id = p_user where id = p_player;
end; $fn$;


-- 유령 멤버 추가. 사이트를 안 쓰는 친구도 참가자와 묶어두려면
-- 묶일 상대가 필요하다. 로그인할 수 없는 자리표시자 계정을 만든다.
create or replace function public.add_ghost_member(p_room bigint, p_name text)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  uid  text := 'ghost:' || gen_random_uuid()::text;
  nm   text := nullif(trim(p_name), '');
  n    int;
begin
  if not public.is_room_admin(p_room) then
    raise exception '방장과 부방장만 유령 멤버를 만들 수 있어요.';
  end if;
  if nm is null then raise exception '이름을 적어주세요.'; end if;
  if length(nm) > 16 then raise exception '이름은 16자까지예요.'; end if;

  select count(*) into n from room_members where room_id = p_room;
  if n >= 50 then raise exception '이 방은 인원이 가득 찼어요.'; end if;

  insert into profiles (user_id, nickname) values (uid, nm);
  insert into room_members (room_id, user_id, is_ghost) values (p_room, uid, true);
  perform public.ensure_wallet(p_room, uid);
  return uid;
end; $fn$;


-- 유령 멤버 지우기. 진짜 계정은 kick_member로만 나간다.
create or replace function public.remove_ghost_member(p_room bigint, p_user text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_room_admin(p_room) then
    raise exception '방장과 부방장만 지울 수 있어요.';
  end if;
  if not exists (
    select 1 from room_members
     where room_id = p_room and user_id = p_user and is_ghost
  ) then
    raise exception '유령 멤버가 아니에요.';
  end if;

  update room_players set linked_user_id = null
   where room_id = p_room and linked_user_id = p_user;
  delete from room_members where room_id = p_room and user_id = p_user;
  delete from room_wallets where room_id = p_room and user_id = p_user;
  -- 프로필은 그 방에서만 쓰던 자리표시자라 같이 지운다
  delete from profiles where user_id = p_user;
end; $fn$;


-- 방장이 끼꼬를 직접 더하고 뺀다.
--
-- 또또 정산이 꼬였거나 벌칙/상을 줄 때 쓴다. 방장에게 이 힘을 주면
-- '조용히 자기 잔액만 올려두는' 게 가능해지므로, 성공하면 반드시 로그를
-- 남긴다. 로그는 방 사람 누구나 본다. 감추고 쓸 수 있으면 안 된다.
create or replace function public.adjust_points(
  p_room bigint, p_user text, p_delta int, p_reason text)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  who    text;
  why    text := nullif(trim(p_reason), '');
  after_ int;
begin
  perform public.roll_season();

  if not public.is_room_owner(p_room) then
    raise exception '방장만 끼꼬를 조정할 수 있어요.';
  end if;
  if not exists (select 1 from room_members where room_id = p_room and user_id = p_user) then
    raise exception '그 사람은 이 방 멤버가 아니에요.';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception '더하거나 뺄 끼꼬를 적어주세요.';
  end if;
  -- 한 번에 움직일 수 있는 폭을 묶어둔다. 오타로 0을 하나 더 붙이면
  -- 그 방 순위가 통째로 의미를 잃는다
  if abs(p_delta) > 100000 then
    raise exception '한 번에 100,000 끼꼬까지 조정할 수 있어요.';
  end if;

  perform public.ensure_wallet(p_room, p_user);

  -- 잔액은 0 밑으로 내려가지 않는다
  update room_wallets set points = greatest(0, points + p_delta)
   where room_id = p_room and user_id = p_user
   returning points into after_;

  insert into point_ledger (user_id, room_id, delta, reason, counterpart_user_id)
  values (p_user, p_room, p_delta, 'adjust', auth.user_id());

  select coalesce(nullif(nickname, ''), '이름없음') into who from profiles where user_id = p_user;

  perform public.log_room(p_room, 'adjust', jsonb_build_object(
    'who', who, 'delta', p_delta, 'after', after_, 'reason', why));
end; $fn$;


create or replace function public.leave_room(p_room bigint)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  -- 방장이 나가면 방에 주인이 없어진다. 넘기고 나가거나, 방을 지워야 한다.
  if public.is_room_owner(p_room) then
    raise exception '방장은 나갈 수 없어요. 방을 넘기거나 삭제해 주세요.';
  end if;
  update room_players set linked_user_id = null
   where room_id = p_room and linked_user_id = auth.user_id();
  delete from room_members where room_id = p_room and user_id = auth.user_id();
end; $fn$;


create or replace function public.delete_room(p_room bigint)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_room_owner(p_room) then
    raise exception '방장만 방을 삭제할 수 있어요.';
  end if;
  delete from rooms where id = p_room;
end; $fn$;


-- ============================================================
-- 5. 포인트 원장 · 방 피드
-- ============================================================
-- 잔액(room_wallets.points)과 내역(point_ledger)을 둘 다 둔다.
-- 잔액을 매번 원장 합계로 계산하면 내역이 쌓일수록 느려지고,
-- 원장이 없으면 "누가 누구에게 얼마 보냈는지"를 볼 방법이 없다.
-- 어긋나지 않게 항상 같은 함수 안에서 함께 갱신한다.

create table if not exists public.point_ledger (
  id                  bigint generated always as identity primary key,
  user_id             text   not null,
  room_id             bigint references public.rooms(id) on delete set null,
  delta               int    not null,
  reason              text   not null,
  counterpart_user_id text,
  ref_id              bigint,
  created_at          timestamptz not null default now()
);
create index if not exists point_ledger_user on public.point_ledger (user_id, created_at desc);

create table if not exists public.room_logs (
  id         bigint generated always as identity primary key,
  room_id    bigint not null references public.rooms(id) on delete cascade,
  type       text   not null,
  payload    jsonb  not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists room_logs_room on public.room_logs (room_id, id desc);

alter table public.point_ledger enable row level security;
alter table public.room_logs    enable row level security;

-- 읽기만 열어준다. 쓰기는 전부 함수 안에서만 일어난다.
grant select on public.point_ledger to authenticated;
grant select on public.room_logs to authenticated;

drop policy if exists ledger_own on public.point_ledger;
create policy ledger_own on public.point_ledger
  for select to authenticated using (user_id = auth.user_id());

drop policy if exists logs_read on public.room_logs;
create policy logs_read on public.room_logs
  for select to authenticated using (public.is_room_member(room_id));


-- 피드 한 줄. 이름은 그때 값을 payload에 박아 둔다 - 닉네임은 바뀌지만
-- 지난 기록은 그때 이름으로 남아야 한다.
--
-- ponytail: 넣을 때마다 오래된 줄을 지운다. 인덱스를 탄 한 문장이고
-- 방마다 하루 몇 줄 수준이라 이걸로 충분하다. 로그가 폭증하면
-- 주기적으로 한 번에 지우는 쪽으로 옮길 것.
create or replace function public.log_room(rid bigint, p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  insert into room_logs (room_id, type, payload) values (rid, p_type, p_payload);

  delete from room_logs
   where room_id = rid
     and id <= coalesce(
       (select id from room_logs where room_id = rid order by id desc offset 500 limit 1), 0);
end; $fn$;


-- 같은 방 멤버끼리만 보낼 수 있다. 모르는 사람에게는 못 보낸다.
create or replace function public.transfer_points(p_room bigint, p_to text, p_amount int)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  me       text := auth.user_id();
  my_name  text;
  to_name  text;
begin
  perform public.roll_season();

  if not public.is_room_member(p_room) then
    raise exception '이 방의 멤버가 아니에요.';
  end if;
  if p_to = me then
    raise exception '자기 자신에게는 보낼 수 없어요.';
  end if;
  if not exists (select 1 from room_members where room_id = p_room and user_id = p_to) then
    raise exception '그 사람은 이 방 멤버가 아니에요.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception '보낼 끼꼬를 1 이상으로 적어주세요.';
  end if;

  perform public.ensure_wallet(p_room, me);
  perform public.ensure_wallet(p_room, p_to);

  -- 잔액 확인과 차감을 한 문장으로 한다. 따로 하면 두 요청이 같은 잔액을
  -- 보고 둘 다 통과해서, 가진 것보다 많이 보낼 수 있다.
  -- 이 방 지갑에서만 오간다. 다른 방으로는 못 넘긴다.
  update room_wallets set points = points - p_amount
   where room_id = p_room and user_id = me and points >= p_amount;
  if not found then
    raise exception '이 방의 끼꼬가 모자라요.';
  end if;

  update room_wallets set points = points + p_amount
   where room_id = p_room and user_id = p_to;

  insert into point_ledger (user_id, room_id, delta, reason, counterpart_user_id)
  values (me,   p_room, -p_amount, 'transfer_out', p_to),
         (p_to, p_room,  p_amount, 'transfer_in',  me);

  select coalesce(nullif(nickname, ''), '이름없음') into my_name from profiles where user_id = me;
  select coalesce(nullif(nickname, ''), '이름없음') into to_name from profiles where user_id = p_to;

  perform public.log_room(p_room, 'transfer', jsonb_build_object(
    'from', my_name, 'to', to_name, 'amount', p_amount));
end; $fn$;


-- 트리거·내부 함수는 클라이언트가 직접 부를 이유가 없다.
revoke execute on function public.roll_season() from public;
revoke execute on function public.bump_room_version() from public;
revoke execute on function public.enforce_room_limits() from public;
revoke execute on function public.enforce_app_state_limits() from public;
revoke execute on function public.log_room(bigint, text, jsonb) from public;

grant execute on function
  public.get_me(),
  public.create_room(text),
  public.join_room(text),
  public.get_join_code(bigint),
  public.reset_join_code(bigint),
  public.set_member_role(bigint, text, text),
  public.transfer_room(bigint, text),
  public.kick_member(bigint, text),
  public.link_room_player(bigint, text, bigint),
  public.add_ghost_member(bigint, text),
  public.remove_ghost_member(bigint, text),
  public.adjust_points(bigint, text, int, text),
  public.leave_room(bigint),
  public.delete_room(bigint),
  public.transfer_points(bigint, text, int),
  public.is_room_member(bigint),
  public.is_room_admin(bigint),
  public.is_room_owner(bigint)
to authenticated;


-- ============================================================
-- 6. 또또 (배팅)
-- ============================================================
-- 여기서부터 경기는 돈이 걸린 물건이다. 그래서 scrims에 대한 클라이언트
-- 직접 쓰기를 회수하고 전부 함수로만 만든다. 경기를 직접 넣을 수 있으면
-- 참여 포인트를 무한히 찍을 수 있다.

alter table public.scrims add column if not exists status text not null default 'settled';
alter table public.scrims add column if not exists total_kills int;
alter table public.scrims add column if not exists first_blood_player_id bigint;
alter table public.scrims add column if not exists undo_count int not null default 0;
alter table public.scrims add column if not exists bet_total bigint not null default 0;
alter table public.scrims add column if not exists bet_count int not null default 0;
alter table public.scrims add column if not exists locked_at timestamptz;
-- 배팅 자동 마감 시각. null이면 방장이 직접 닫을 때까지 열려 있다
alter table public.scrims add column if not exists betting_closes_at timestamptz;
alter table public.scrims add column if not exists settled_at timestamptz;

alter table public.scrims drop constraint if exists scrims_status_chk;
alter table public.scrims add constraint scrims_status_chk
  check (status in ('betting', 'locked', 'settled'));

create index if not exists scrims_room_status on public.scrims (room_id, status);

-- 한 사람이 한 방에서 두 참가자에 묶이면 참여 포인트를 두 번 받는다
create unique index if not exists room_players_one_account
  on public.room_players (room_id, linked_user_id)
  where linked_user_id is not null;

-- 되돌리기가 같은 줄을 두 번 뒤집지 않게 표시해 둔다
alter table public.point_ledger add column if not exists reversed_at timestamptz;

revoke insert, update, delete on public.scrims from authenticated;
drop policy if exists scrims_admin_write on public.scrims;


-- 마켓별 집계. 배당을 구하려면 "이 선택지에 총 얼마"가 필요한데, 매번 bets를
-- SUM하면 배팅이 쌓일수록 느려진다. 걸 때 이 한 줄만 고치면 배당 조회는
-- 항상 한 줄 읽기다.
create table if not exists public.bet_pools (
  scrim_id     bigint not null references public.scrims(id) on delete cascade,
  market       text   not null,
  selection    text   not null,
  total_amount bigint not null default 0,
  bet_count    int    not null default 0,
  odds         numeric(6, 2),
  primary key (scrim_id, market, selection)
);

create table if not exists public.bets (
  id         bigint generated always as identity primary key,
  scrim_id   bigint not null references public.scrims(id) on delete cascade,
  room_id    bigint not null references public.rooms(id) on delete cascade,
  user_id    text   not null,
  market     text   not null,
  selection  text   not null,
  amount     int    not null check (amount > 0),
  odds       numeric(6, 2),
  payout     int,
  created_at timestamptz not null default now(),
  -- 같은 마켓에 두 선택지를 걸 수 없다 (1팀 승리와 2팀 승리를 같이 못 건다)
  unique (scrim_id, user_id, market)
);
create index if not exists bets_scrim on public.bets (scrim_id);
create index if not exists bets_user on public.bets (user_id, created_at desc);

alter table public.bet_pools enable row level security;
alter table public.bets enable row level security;

grant select on public.bet_pools to authenticated;
grant select on public.bets to authenticated;

-- 배당은 마감 전까지 안 보인다. 실시간으로 보이면 마감 직전에 유리한 쪽으로
-- 몰리는 눈치싸움이 되고, 늦게 거는 사람이 항상 유리해진다.
drop policy if exists pools_read on public.bet_pools;
create policy pools_read on public.bet_pools
  for select to authenticated
  using (exists (
    select 1 from public.scrims s
     where s.id = scrim_id and s.status <> 'betting' and public.is_room_member(s.room_id)
  ));

-- 정산 전에는 내 배팅만. 정산되면 전원에게 공개된다 (그게 재미고, 억제 장치다)
drop policy if exists bets_read on public.bets;
create policy bets_read on public.bets
  for select to authenticated
  using (
    public.is_room_member(room_id)
    and (
      user_id = auth.user_id()
      or exists (select 1 from public.scrims s where s.id = scrim_id and s.status = 'settled')
    )
  );


-- 승부 조작 동의. 한 번만 받는다.
create or replace function public.agree_fairplay()
returns void language sql security definer set search_path = public as $fn$
  update profiles set agreed_fairplay_at = now()
   where user_id = auth.user_id() and agreed_fairplay_at is null;
$fn$;


-- 경기에 참여한 사람에게 승 1500 / 패 1000.
-- 계정에 연결된 참가자만 받는다 (설정 탭에서 연결한다).
create or replace function public.award_participation(p_scrim bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare s scrims;
begin
  select * into s from scrims where id = p_scrim;
  if s.winner is null then return; end if;

  with sides as (
    select jsonb_array_elements_text(s.team_a)::bigint as pid, 'A' as side
    union all
    select jsonb_array_elements_text(s.team_b)::bigint, 'B'
  ),
  paid as (
    select rp.linked_user_id as uid,
           case when sides.side = s.winner then 1500 else 1000 end as amt
      from sides
      join room_players rp on rp.id = sides.pid
     where rp.linked_user_id is not null
  ),
  ins as (
    insert into point_ledger (user_id, room_id, delta, reason, ref_id)
    select uid, s.room_id, amt, 'scrim', p_scrim from paid
    returning user_id, delta
  )
  update room_wallets w set points = w.points + x.d
    from (select user_id, sum(delta) d from ins group by user_id) x
   where w.room_id = s.room_id and w.user_id = x.user_id;
end; $fn$;


-- 기록 탭에서 바로 남기는 경기. 배팅 없이 결과만 넣는다.
create or replace function public.record_scrim(
  p_room bigint, p_mode text, p_team_a jsonb, p_team_b jsonb, p_winner text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare sid bigint; n int;
begin
  perform public.roll_season();
  if not public.is_room_admin(p_room) then
    raise exception '방장과 부방장만 기록을 남길 수 있어요.';
  end if;
  if p_winner not in ('A', 'B') then
    raise exception '이긴 팀을 골라주세요.';
  end if;

  select count(*) into n from scrims where room_id = p_room;
  if n >= 1000 then
    raise exception '한 방에 최대 1000경기까지 남길 수 있어요. 오래된 기록을 지워주세요.';
  end if;

  insert into scrims (room_id, mode, team_a, team_b, winner, status, settled_at)
    values (p_room, p_mode, p_team_a, p_team_b, p_winner, 'settled', now())
    returning id into sid;

  perform public.award_participation(sid);
  return sid;
end; $fn$;


-- 배팅용 경기를 연다. 결과는 아직 없다.
-- 인자를 늘리면 옛 함수가 그대로 남아 오버로드가 된다. PostgREST가 어느
-- 것을 부를지 못 골라서 ambiguous 오류를 낸다. 먼저 지운다.
drop function if exists public.open_betting(bigint, text, jsonb, jsonb);

-- p_close_seconds: 몇 초 뒤에 자동으로 마감할지. null이면 방장이 직접 닫는다.
-- 마감 시각을 서버가 정해서 내려줘야 한다. 각자 브라우저 시계로 재면
-- 시계가 몇 초씩 어긋난 사람들 사이에서 '누구는 됐고 누구는 안 되는' 일이 생긴다.
create or replace function public.open_betting(
  p_room bigint, p_mode text, p_team_a jsonb, p_team_b jsonb,
  p_close_seconds int default null)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare sid bigint; n int; closes timestamptz;
begin
  perform public.roll_season();
  if not public.is_room_admin(p_room) then
    raise exception '방장과 부방장만 배팅을 열 수 있어요.';
  end if;
  if exists (select 1 from scrims where room_id = p_room and status in ('betting', 'locked')) then
    raise exception '아직 끝나지 않은 배팅 경기가 있어요. 그것부터 정산해 주세요.';
  end if;

  select count(*) into n from scrims where room_id = p_room;
  if n >= 1000 then
    raise exception '한 방에 최대 1000경기까지 남길 수 있어요.';
  end if;

  if p_close_seconds is not null then
    if p_close_seconds < 30 or p_close_seconds > 3600 then
      raise exception '배팅 시간은 30초에서 60분 사이로 정해주세요.';
    end if;
    closes := now() + make_interval(secs => p_close_seconds);
  end if;

  insert into scrims (room_id, mode, team_a, team_b, status, betting_closes_at)
    values (p_room, p_mode, p_team_a, p_team_b, 'betting', closes)
    returning id into sid;

  perform public.log_room(p_room, 'betting_open', jsonb_build_object(
    'scrim', sid, 'mode', p_mode,
    'size', jsonb_array_length(p_team_a) + jsonb_array_length(p_team_b),
    'closes_at', closes));
  return sid;
end; $fn$;


-- 장바구니에 담은 것들을 한 번에. 조합 배당이 아니라 독립 배팅 여러 건이다.
-- 하나라도 막히면 전부 안 들어간다.
create or replace function public.place_bets(p_scrim bigint, p_bets jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  me    text := auth.user_id();
  s     scrims;
  total bigint;
  b     jsonb;
  cap   int;
begin
  perform public.roll_season();

  select * into s from scrims where id = p_scrim;
  if s.id is null then raise exception '경기를 찾을 수 없어요.'; end if;
  if not public.is_room_member(s.room_id) then
    raise exception '이 방의 멤버가 아니에요.';
  end if;
  if s.status <> 'betting' then
    raise exception '지금은 배팅할 수 없어요. 이미 마감됐습니다.';
  end if;
  -- 시간이 다 됐으면 status가 아직 betting이어도 더 받지 않는다.
  -- 누군가 lock_betting을 부르기 전까지의 틈을 여기서 막는다
  if s.betting_closes_at is not null and now() >= s.betting_closes_at then
    raise exception '배팅 시간이 끝났어요.';
  end if;
  if (select agreed_fairplay_at from profiles where user_id = me) is null then
    raise exception '배팅에 신경쓰지 않고 경기를 진행하겠다는 동의가 먼저예요.';
  end if;
  if jsonb_array_length(coalesce(p_bets, '[]'::jsonb)) = 0 then
    raise exception '담은 배팅이 없어요.';
  end if;

  -- 고정 배당 마켓은 시스템이 지급을 책임진다. 한 사람이 크게 걸면
  -- 손실이 커지므로 마켓별로 상한을 둔다.
  for b in select * from jsonb_array_elements(p_bets) loop
    if (b->>'amount')::int <= 0 then
      raise exception '배팅 금액은 1 이상이어야 해요.';
    end if;
    cap := case
      when b->>'market' = 'first_blood' then 2000
      when b->>'market' like 'kills%' then 3000
      else null
    end;
    if cap is not null and (b->>'amount')::int > cap then
      raise exception '이 항목은 한 번에 % 끼꼬까지 걸 수 있어요.', cap;
    end if;
  end loop;

  select sum((x->>'amount')::int) into total from jsonb_array_elements(p_bets) x;

  -- 잔액 확인과 차감을 한 문장으로. 갈라놓으면 두 요청이 같은 잔액을 보고
  -- 둘 다 통과해서 가진 것보다 많이 걸 수 있다.
  perform public.ensure_wallet(s.room_id, me);
  update room_wallets set points = points - total
   where room_id = s.room_id and user_id = me and points >= total;
  if not found then
    raise exception '이 방의 끼꼬가 모자라요.';
  end if;

  begin
    insert into bets (scrim_id, room_id, user_id, market, selection, amount)
    select p_scrim, s.room_id, me, x->>'market', x->>'selection', (x->>'amount')::int
      from jsonb_array_elements(p_bets) x;
  exception when unique_violation then
    raise exception '같은 항목에는 한 번만 걸 수 있어요. 이미 건 항목이 있습니다.';
  end;

  insert into bet_pools (scrim_id, market, selection, total_amount, bet_count)
  select p_scrim, x->>'market', x->>'selection', (x->>'amount')::int, 1
    from jsonb_array_elements(p_bets) x
  on conflict (scrim_id, market, selection) do update
    set total_amount = bet_pools.total_amount + excluded.total_amount,
        bet_count    = bet_pools.bet_count + excluded.bet_count;

  update scrims
     set bet_total = bet_total + total,
         bet_count = (select count(distinct user_id) from bets where scrim_id = p_scrim)
   where id = p_scrim;

  -- 개별 배팅은 피드에 안 남긴다. 그게 로그 쓰기의 대부분이고,
  -- 정산 때 요약 한 줄이면 볼 건 다 본다.
  insert into point_ledger (user_id, room_id, delta, reason, ref_id)
  values (me, s.room_id, -total, 'bet', p_scrim);
end; $fn$;


-- 게임 시작. 여기서 배당이 확정되고 공개된다.
create or replace function public.lock_betting(p_scrim bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare s scrims; pool bigint; n int; expired boolean;
begin
  select * into s from scrims where id = p_scrim;
  if s.id is null then raise exception '경기를 찾을 수 없어요.'; end if;
  if s.status <> 'betting' then raise exception '이미 마감된 경기예요.'; end if;

  expired := s.betting_closes_at is not null and now() >= s.betting_closes_at;

  -- 시간이 다 된 뒤에는 아무 멤버나 닫을 수 있다. 방장만 닫게 두면
  -- 방장이 화면을 안 보고 있을 때 아무도 배당을 못 보는 상태로 멈춘다.
  -- (실제로 닫는 건 시간을 본 첫 사람의 브라우저다)
  if not expired and not public.is_room_admin(s.room_id) then
    raise exception '방장과 부방장만 마감할 수 있어요.';
  end if;
  if expired and not public.is_room_member(s.room_id) then
    raise exception '이 방의 멤버가 아니에요.';
  end if;

  -- 승리팀은 패리뮤추얼. 많이 걸린 쪽이 낮은 배당을 가져가고,
  -- 나간 만큼만 들어오는 제로섬이라 끼꼬 총량이 늘지 않는다.
  select coalesce(sum(total_amount), 0) into pool
    from bet_pools where scrim_id = p_scrim and market = 'winner';

  update bet_pools
     set odds = case when total_amount = 0 then null
                     else round(pool::numeric / total_amount, 2) end
   where scrim_id = p_scrim and market = 'winner';

  -- 퍼블은 고정 배당. 공정값(인원 n배)보다 낮게 잡아서 이 자체가
  -- 끼꼬 소각 장치가 된다.
  --
  -- 여기에 티어 보정을 얹는다. 퍼블은 잘하는 사람이 딸 확률이 높은데
  -- 배당이 전원 같으면 아무도 낮은 티어에 걸 이유가 없다. 티어 한 칸당
  -- 2%씩, 골드를 1.00으로 두고 아래로 갈수록 조금 높인다.
  -- 명단에서 지워진 참가자(조회 실패)는 보정 없이 기본값을 쓴다.
  n := jsonb_array_length(s.team_a) + jsonb_array_length(s.team_b);
  update bet_pools bp
     set odds = round(
           n * 0.85 * (1 + (3 - coalesce(t.idx, 3)) * 0.02),
           2)
    from (
      select rp.id,
             array_position(
               array['IRON','BRONZE','SILVER','GOLD','PLATINUM',
                     'EMERALD','DIAMOND','MASTER','GRANDMASTER'],
               rp.tier) - 1 as idx
        from room_players rp
    ) t
   where bp.scrim_id = p_scrim
     and bp.market = 'first_blood'
     and t.id = bp.selection::bigint;

  -- 위 조인에서 빠진 선택지(명단에서 지워진 참가자)는 기본값으로 채운다
  update bet_pools set odds = round(n * 0.85, 2)
   where scrim_id = p_scrim and market = 'first_blood' and odds is null;

  update bet_pools set odds = 1.98
   where scrim_id = p_scrim and market like 'kills%';

  update scrims set status = 'locked', locked_at = now() where id = p_scrim;

  perform public.log_room(s.room_id, 'betting_locked', jsonb_build_object(
    'scrim', p_scrim, 'people', s.bet_count, 'total', s.bet_total));
end; $fn$;


-- 실제 경기 결과를 넣고 한 번에 정산한다.
-- 중간에 하나라도 실패하면 전부 되돌아간다. 절반만 지급되는 상황이 없어야 한다.
create or replace function public.settle_scrim(
  p_scrim bigint, p_winner text, p_total_kills int, p_first_blood bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  s           scrims;
  winner_void boolean;
  fb_void     boolean;
  kills_void  boolean;
  prev        int;
begin
  perform public.roll_season();

  select * into s from scrims where id = p_scrim;
  if s.id is null then raise exception '경기를 찾을 수 없어요.'; end if;
  if not public.is_room_admin(s.room_id) then
    raise exception '방장과 부방장만 결과를 넣을 수 있어요.';
  end if;
  -- 이미 정산된 경기에 다시 불러도 아무 일이 없어야 한다.
  -- 네트워크 재시도로 두 번 지급되는 사고를 막는다.
  if s.status = 'settled' then return; end if;
  if s.status <> 'locked' then
    raise exception '배팅을 먼저 마감해 주세요.';
  end if;
  if p_winner not in ('A', 'B') then raise exception '이긴 팀을 골라주세요.'; end if;

  update scrims
     set winner = p_winner, total_kills = p_total_kills,
         first_blood_player_id = p_first_blood,
         status = 'settled', settled_at = now()
   where id = p_scrim
   returning * into s;

  -- 적중한 쪽에 아무도 안 걸었으면 그 마켓은 통째로 환불이다.
  -- 결과를 안 넣은 항목(총 킬, 퍼블)도 마찬가지.
  winner_void := not exists (
    select 1 from bet_pools
     where scrim_id = p_scrim and market = 'winner'
       and selection = p_winner and total_amount > 0);
  fb_void := p_first_blood is null;
  kills_void := p_total_kills is null;

  update bets b
     set odds = p.odds,
         payout = case
           when b.market = 'winner' and winner_void then b.amount
           when b.market = 'first_blood' and fb_void then b.amount
           when b.market like 'kills%' and kills_void then b.amount
           when b.market = 'winner' and b.selection = p_winner
             then floor(b.amount * p.odds)::int
           when b.market = 'first_blood' and b.selection = p_first_blood::text
             then floor(b.amount * p.odds)::int
           when b.market like 'kills%' and (
                (b.selection = 'over' and p_total_kills > split_part(b.market, '_', 2)::numeric)
             or (b.selection = 'under' and p_total_kills < split_part(b.market, '_', 2)::numeric))
             then floor(b.amount * p.odds)::int
           else 0
         end
    from bet_pools p
   where b.scrim_id = p_scrim
     and p.scrim_id = b.scrim_id and p.market = b.market and p.selection = b.selection;

  with paid as (
    select user_id, sum(payout)::int as amt
      from bets where scrim_id = p_scrim and payout > 0 group by user_id
  ),
  ins as (
    insert into point_ledger (user_id, room_id, delta, reason, ref_id)
    select user_id, s.room_id, amt, 'payout', p_scrim from paid
    returning user_id, delta
  )
  update room_wallets w set points = w.points + x.d
    from (select user_id, sum(delta) d from ins group by user_id) x
   where w.room_id = s.room_id and w.user_id = x.user_id;

  perform public.award_participation(p_scrim);

  perform public.log_room(s.room_id, 'settled', jsonb_build_object(
    'scrim', p_scrim, 'winner', p_winner,
    'kills', p_total_kills, 'bet_total', s.bet_total));

  -- 방 기록 경신. 깨진 줄 모르고 지나가면 기록이 있으나 마나다.
  -- 한 방에 경기가 1000판까지라 매번 훑어도 부담이 없다.
  if p_total_kills is not null then
    select max(total_kills) into prev from scrims
     where room_id = s.room_id and id <> p_scrim and total_kills is not null;
    if prev is null or p_total_kills > prev then
      perform public.log_room(s.room_id, 'record', jsonb_build_object(
        'kind', 'kills', 'value', p_total_kills, 'prev', prev));
    end if;
  end if;

  if s.bet_total > 0 then
    select max(bet_total) into prev from scrims
     where room_id = s.room_id and id <> p_scrim and status = 'settled';
    if prev is null or s.bet_total > prev then
      perform public.log_room(s.room_id, 'record', jsonb_build_object(
        'kind', 'bet', 'value', s.bet_total, 'prev', prev));
    end if;
  end if;
end; $fn$;


-- 결과를 잘못 넣는 일은 반드시 생긴다. 지급을 전부 뒤집고 마감 직후로 돌린다.
-- 방장이 결과를 바꿔 배팅을 흔들 수도 있으므로, 되돌린 사실을 피드에 남겨
-- 모두에게 보이게 한다.
create or replace function public.unsettle_scrim(p_scrim bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare s scrims;
begin
  select * into s from scrims where id = p_scrim;
  if s.id is null then raise exception '경기를 찾을 수 없어요.'; end if;
  if not public.is_room_owner(s.room_id) then
    raise exception '방장만 정산을 되돌릴 수 있어요.';
  end if;
  if s.status <> 'settled' then raise exception '아직 정산되지 않은 경기예요.'; end if;
  if s.locked_at is null then
    raise exception '배팅 없이 남긴 기록은 되돌릴 게 없어요. 지우고 다시 남겨 주세요.';
  end if;

  -- 아직 안 뒤집은 줄만 고른다. 안 그러면 두 번째 되돌리기가
  -- 첫 번째로 이미 취소한 지급까지 또 뒤집는다.
  with back as (
    update point_ledger set reversed_at = now()
     where ref_id = p_scrim and reversed_at is null
       and reason in ('payout', 'scrim')
    returning user_id, delta
  ),
  ins as (
    insert into point_ledger (user_id, room_id, delta, reason, ref_id, reversed_at)
    select user_id, s.room_id, -delta, 'undo', p_scrim, now() from back
    returning user_id, delta
  )
  update room_wallets w set points = w.points + x.d
    from (select user_id, sum(delta) d from ins group by user_id) x
   where w.room_id = s.room_id and w.user_id = x.user_id;

  update bets set payout = null, odds = null where scrim_id = p_scrim;

  update scrims
     set winner = null, total_kills = null, first_blood_player_id = null,
         status = 'locked', settled_at = null, undo_count = undo_count + 1
   where id = p_scrim;

  perform public.log_room(s.room_id, 'settle_undone', jsonb_build_object(
    'scrim', p_scrim, 'count', s.undo_count + 1));
end; $fn$;


create or replace function public.delete_scrim(p_scrim bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  s        scrims;
  n_people int;
  n_amount bigint;
begin
  select * into s from scrims where id = p_scrim;
  if s.id is null then return; end if;

  select count(distinct user_id), coalesce(sum(amount), 0)
    into n_people, n_amount
    from bets where scrim_id = p_scrim;

  -- 배팅 없는 기록은 부방장도 지울 수 있다. 돈이 걸린 판은 방장만.
  -- 예전엔 배팅이 걸리면 아예 못 지웠는데, 잘못 연 또또를 취소할 방법이
  -- 없어서 가짜 결과를 넣어 정산해야만 다음 판으로 넘어갈 수 있었다.
  if n_people > 0 then
    if not public.is_room_owner(s.room_id) then
      raise exception '배팅이 걸린 경기는 방장만 취소할 수 있어요.';
    end if;
  elsif not public.is_room_admin(s.room_id) then
    raise exception '방장과 부방장만 기록을 지울 수 있어요.';
  end if;

  -- 이 경기가 지갑에 한 일을 전부 되돌린다.
  -- 건 돈('bet'), 지급('payout'), 참여 포인트('scrim') 가릴 것 없이
  -- 아직 안 뒤집은 줄이면 다 뒤집는다. 정산을 한 번 되돌린 뒤여도
  -- 그때 뒤집힌 줄은 reversed_at이 차 있어 두 번 세지 않는다.
  with back as (
    update point_ledger set reversed_at = now()
     where ref_id = p_scrim and reversed_at is null
       and reason in ('bet', 'payout', 'scrim')
    returning user_id, delta
  ),
  ins as (
    insert into point_ledger (user_id, room_id, delta, reason, ref_id, reversed_at)
    select user_id, s.room_id, -delta, 'undo', p_scrim, now() from back
    returning user_id, delta
  )
  update room_wallets w set points = w.points + x.d
    from (select user_id, sum(delta) d from ins group by user_id) x
   where w.room_id = s.room_id and w.user_id = x.user_id;

  -- bets와 bet_pools는 scrims를 참조하며 on delete cascade다
  delete from scrims where id = p_scrim;

  if n_people > 0 then
    perform public.log_room(s.room_id, 'scrim_cancelled', jsonb_build_object(
      'people', n_people, 'refund', n_amount, 'status', s.status));
  end if;
end; $fn$;


revoke execute on function public.award_participation(bigint) from public;
-- 지갑 만들기는 다른 함수들이 안에서만 부른다. 밖에서 부를 일이 없다
revoke execute on function public.ensure_wallet(bigint, text) from public;

grant execute on function
  public.agree_fairplay(),
  public.record_scrim(bigint, text, jsonb, jsonb, text),
  public.open_betting(bigint, text, jsonb, jsonb, int),
  public.place_bets(bigint, jsonb),
  public.lock_betting(bigint),
  public.settle_scrim(bigint, text, int, bigint),
  public.unsettle_scrim(bigint),
  public.delete_scrim(bigint)
to authenticated;


-- ============================================================
-- 마지막: Data API에 스키마를 다시 읽으라고 알린다
-- ============================================================
-- Data API(PostgREST)는 시작할 때 스키마를 한 번 읽어서 캐시해 둔다.
-- 그래서 표를 새로 만들어도 캐시에 없으면
--   Could not find the table 'public.rooms' in the schema cache
-- 라고 나온다. 표는 멀쩡히 있는데 API 쪽이 아직 모르는 것이다.
--
-- 이 스크립트를 고쳐서 다시 돌릴 때마다 이 줄이 마지막에 있어야 한다.
notify pgrst, 'reload schema';
