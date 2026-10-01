-- 자정을 넘겨 끝난 판 때문에 달 장부가 어긋난 것을 되돌린다.
--
-- 무슨 일이 있었나:
--   9월 30일 밤에 또또를 열고 10000을 걸었다 (9월 지갑에서 빠짐)
--   10월 1일 0시를 넘겨 정산했다 → 그 사이에 누가 로그인해서 계절이 넘어갔다
--   9월은 '건 만큼 손해'로 박제되고, 번 끼꼬는 초기화된 10월 지갑에 들어갔다
--   한 판이 두 달에 걸쳐 쪼개진 셈이다
--
-- 이 스크립트는 그 돈을 원래 달로 돌려놓는다. 번 끼꼬를 그 달의 박제
-- (hall_of_fame)에 더하고, 다음 달 지갑에서 같은 만큼 뺀다.
--
-- 앞으로는 이런 일이 안 생긴다. setup.sql의 roll_season이 진행 중인 판이
-- 있으면 계절을 넘기지 않는다.
--
-- ------------------------------------------------------------------
-- 한 번만 돌리면 된다. 두 번 돌려도 같은 결과다 - 고친 줄마다
-- 'month_fix' 기록을 남겨서 다음 번에는 건너뛴다.
-- 방을 따로 고르지 않는다. 어긋난 방이 하나든 열이든 같은 셈이다.
-- ------------------------------------------------------------------

-- 1단계. 무엇이 고쳐질지 먼저 본다. (이것만 돌려보고 확인한 뒤 2단계로)
with hit as (
  select l.id, l.user_id, l.room_id, l.delta, l.reason, l.ref_id,
         to_char(s.played_at  at time zone 'Asia/Seoul', 'YYYY-MM') as game_month,
         to_char(l.created_at at time zone 'Asia/Seoul', 'YYYY-MM') as paid_month
    from point_ledger l
    join scrims s on s.id = l.ref_id
   where l.reason in ('payout', 'scrim')
     -- 경기가 열린 달보다 돈이 늦게 들어온 줄만
     and to_char(s.played_at  at time zone 'Asia/Seoul', 'YYYY-MM')
       < to_char(l.created_at at time zone 'Asia/Seoul', 'YYYY-MM')
     and not exists (
       select 1 from point_ledger f
        where f.reason = 'month_fix' and f.ref_id = l.ref_id and f.user_id = l.user_id
     )
)
select r.name as room, coalesce(nullif(p.nickname, ''), '이름없음') as who,
       h.game_month, h.paid_month, h.reason, h.delta
  from hit h
  join rooms r on r.id = h.room_id
  left join profiles p on p.user_id = h.user_id
 order by r.name, who, h.game_month;


-- 2단계. 되돌린다. 세 가지가 한 트랜잭션에서 같이 움직인다.
begin;

create temporary table month_fix on commit drop as
with hit as (
  select l.user_id, l.room_id, l.delta, l.ref_id,
         to_char(s.played_at at time zone 'Asia/Seoul', 'YYYY-MM') as game_month
    from point_ledger l
    join scrims s on s.id = l.ref_id
   where l.reason in ('payout', 'scrim')
     and to_char(s.played_at  at time zone 'Asia/Seoul', 'YYYY-MM')
       < to_char(l.created_at at time zone 'Asia/Seoul', 'YYYY-MM')
     and not exists (
       select 1 from point_ledger f
        where f.reason = 'month_fix' and f.ref_id = l.ref_id and f.user_id = l.user_id
     )
)
select room_id, user_id, game_month, ref_id, sum(delta)::int as amt
  from hit
 group by room_id, user_id, game_month, ref_id;

-- (1) 그 달 박제에 더한다. 줄이 없으면 만든다 - 그 달에 지갑이 없던
--     사람이라도 번 돈은 그 달 것이다
insert into hall_of_fame (room_id, month, user_id, display_name, kkiko_points)
select f.room_id, f.game_month, f.user_id,
       coalesce(nullif(p.nickname, ''), '이름없음'), sum(f.amt)::int
  from month_fix f
  left join profiles p on p.user_id = f.user_id
 group by f.room_id, f.game_month, f.user_id, p.nickname
on conflict (room_id, month, user_id)
  do update set kkiko_points = hall_of_fame.kkiko_points + excluded.kkiko_points;

-- (2) 다음 달 지갑에서 뺀다. 그 달에 번 돈이 이번 달 지갑에 얹혀 있었다
update room_wallets w
   set points = w.points - x.amt
  from (select room_id, user_id, sum(amt)::int as amt from month_fix
         group by room_id, user_id) x
 where w.room_id = x.room_id and w.user_id = x.user_id;

-- (3) 뺀 만큼 내역에 남긴다. 안 남기면 지갑과 내역의 합이 어긋나서
--     어드민의 '지갑과 내역이 안 맞는 방' 검사에 걸린다
insert into point_ledger (user_id, room_id, delta, reason, ref_id)
select user_id, room_id, -amt, 'month_fix', ref_id from month_fix;

commit;


-- 3단계. 확인. 두 줄 다 비어 있어야 한다.
--   (가) 아직 어긋난 줄이 남았는가
with hit as (
  select l.id
    from point_ledger l
    join scrims s on s.id = l.ref_id
   where l.reason in ('payout', 'scrim')
     and to_char(s.played_at  at time zone 'Asia/Seoul', 'YYYY-MM')
       < to_char(l.created_at at time zone 'Asia/Seoul', 'YYYY-MM')
     and not exists (
       select 1 from point_ledger f
        where f.reason = 'month_fix' and f.ref_id = l.ref_id and f.user_id = l.user_id
     )
)
select count(*) as "아직 어긋난 줄" from hit;

--   (나) 지갑과 내역의 합이 맞는가.
--       어드민 화면의 검사와 같은 셈이다 - 계절이 넘어간 뒤의 내역만 센다
--       (지갑은 그때 10000으로 초기화됐으니까)
select r.name as room, coalesce(nullif(p.nickname, ''), '이름없음') as who,
       w.points as "지갑", 10000 + coalesce(l.total, 0) as "내역"
  from room_wallets w
  join rooms r on r.id = w.room_id
  left join profiles p on p.user_id = w.user_id
  left join (
    select room_id as rid, user_id as uid, sum(delta) as total
      from point_ledger
     where created_at > (select rolled_at from app_season where id = 1)
     group by 1, 2
  ) l on l.rid = w.room_id and l.uid = w.user_id
 where w.points <> 10000 + coalesce(l.total, 0);
