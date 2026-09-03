-- 롤랜챔 스키마
-- Neon 콘솔 > SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 됩니다.
--
-- 주의: 이 스크립트는 app_state.matches 컬럼을 지웁니다.
--       개인 계정에 쌓여 있던 내전 기록이 사라집니다(명세서 B 결정).
--       내전 기록은 이제 '방' 안에만 있습니다.

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

create table if not exists public.room_members (
  room_id   bigint not null references public.rooms(id) on delete cascade,
  user_id   text   not null,
  role      text   not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user on public.room_members (user_id);

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
  select rm.room_id, cur, rm.user_id, coalesce(nullif(p.nickname, ''), '이름없음'), p.points
    from room_members rm
    join profiles p on p.user_id = rm.user_id
  on conflict (room_id, month, user_id) do nothing;

  update profiles set points = 10000, points_month = m;
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
alter table public.room_members  enable row level security;
alter table public.room_players  enable row level security;
alter table public.scrims        enable row level security;
alter table public.hall_of_fame  enable row level security;

-- 입장 코드는 컬럼 단위로 뺀다. 멤버 전원이 코드를 볼 수 있으면
-- 재발급이 아무 의미가 없다. 방장·부방장은 get_join_code()로 본다.
grant select (id, name, owner_id, version, created_at) on public.rooms to authenticated;
grant update (name) on public.rooms to authenticated;
grant select on public.room_members to authenticated;
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
    if n >= 5 then raise exception '방은 최대 5개까지 만들 수 있어요.'; end if;
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
  delete from room_members where room_id = p_room and user_id = p_user;
end; $fn$;


create or replace function public.leave_room(p_room bigint)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  -- 방장이 나가면 방에 주인이 없어진다. 넘기고 나가거나, 방을 지워야 한다.
  if public.is_room_owner(p_room) then
    raise exception '방장은 나갈 수 없어요. 방을 넘기거나 삭제해 주세요.';
  end if;
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
-- 잔액(profiles.points)과 내역(point_ledger)을 둘 다 둔다.
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

  -- 잔액 확인과 차감을 한 문장으로 한다. 따로 하면 두 요청이 같은 잔액을
  -- 보고 둘 다 통과해서, 가진 것보다 많이 보낼 수 있다.
  update profiles set points = points - p_amount
   where user_id = me and points >= p_amount;
  if not found then
    raise exception '끼꼬가 모자라요.';
  end if;

  update profiles set points = points + p_amount where user_id = p_to;

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
  public.leave_room(bigint),
  public.delete_room(bigint),
  public.transfer_points(bigint, text, int),
  public.is_room_member(bigint),
  public.is_room_admin(bigint),
  public.is_room_owner(bigint)
to authenticated;
