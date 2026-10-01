import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaLock,
  FaCheck,
  FaUndo,
  FaChevronRight,
  FaTrash,
  FaDice,
  FaTimes,
  FaArrowUp,
  FaArrowDown,
  FaLink,
} from 'react-icons/fa';
import {
  killLineOfScrim,
  killMarket,
  winningSelection,
  marketLabel,
  capOf,
  agreeFairplay,
  placeBets,
  lockBetting,
  settleScrim,
  settleCasual,
  openCasualBet,
  placeParlay,
  unsettleScrim,
  removeScrim,
  fetchBetting,
  fetchFbOdds,
  firstBloodRates,
} from '../../server/rooms';
import { useDialog } from '../../components/common/Dialog';
import Empty from '../../components/common/Empty';
import BetTimer from './BetTimer';
import CasualOpenModal from './CasualOpenModal';
import LaneTag from './LaneTag';
import {
  PARITY,
  SIDES,
  DRAGONS,
  CASUAL_MODES,
  hasDragon,
  hasLanes,
  dragonIcon,
  dragonLabel,
  firstBloodOdds,
  dragonOdds,
  killTrio,
  isKillTrio,
  fbRows,
  enemyPick,
  enemyLaneOf,
  parlayCap,
  parlayOdds,
  casualOutcome,
  FB_ROW_ORDER,
} from '../../rules/casual';
import { timeAgo } from '../../lib/timeAgo';
import { BET_BUMPS, FIRST_BLOOD_RATE, KILLS_ODDS, PARLAY_MAX_WIN } from '../../rules/tuning';
import { useGameKey } from '../../lib/GameContext';

const num = (n) => Number(n || 0).toLocaleString();

/* 방의 '또또' 탭.

   배팅 중에는 참여 인원과 총액만 보인다. 선택지별 분포와 배당은
   마감 때 열린다 (RLS가 bet_pools를 그때까지 막는다). 실시간으로 보이면
   마감 직전에 유리한 쪽으로 몰리는 눈치싸움이 되고, 늦게 거는 사람이
   항상 유리해진다. */
const BetTab = ({
  scrims,
  activeScrim,
  players,
  members,
  myId,
  canEdit,
  isOwner,
  version,
  onChanged,
  /* 한 판만 보여줄 때. 내전 기록 탭에서 판돈을 누르면 이 화면을 그대로
     팝업에 띄운다 - 결과를 두 벌로 그리면 둘이 조금씩 달라진다 */
  single = null,
  /* 일반 게임 또또를 열 때만 쓴다 */
  roomId,
}) => {
  const gameKey = useGameKey();
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const memberName = new Map(members.map((m) => [m.user_id, m.nickname]));
  const tierOf = (id) => players.find((p) => p.id === Number(id))?.tier;
  const me = members.find((m) => m.user_id === myId);
  const { confirm } = useDialog();

  /* 또또를 건 경기만. 결과가 나온 것들은 기록으로 남겨 계속 본다 */
  const history = single
    ? [single]
    : scrims
        .filter((s) => s.status === 'settled' && s.bet_count > 0)
        .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
        .slice(0, 5);

  const shown = [single ? null : activeScrim, ...history].filter(Boolean);
  const ids = shown.map((s) => s.id);
  const idKey = ids.join(',');

  const [pools, setPools] = useState([]);
  const [bets, setBets] = useState([]);
  /* 진행 중인 판에 이미 건 사람들. 이름만 온다 (RLS가 남의 배팅 줄은 막는다) */
  const [bettors, setBettors] = useState([]);
  const [cart, setCart] = useState({});
  /* 진행 중인 판의 퍼블 배당. 고정 배당이라 마감 전에도 보여준다 */
  const [fbOdds, setFbOdds] = useState(new Map());
  const busy = useRef(false);

  const liveId = activeScrim?.id || null;

  const load = useCallback(async () => {
    const list = idKey ? idKey.split(',').map(Number) : [];
    const got = await fetchBetting(list, liveId).catch(() => ({
      pools: [],
      bets: [],
      bettors: [],
    }));
    setPools(got.pools);
    setBets(got.bets);
    setBettors(got.bettors);
  }, [idKey, liveId]);

  useEffect(() => {
    load();
  }, [load, version]);

  /* 경기가 열려 있는 동안 퍼블 배당은 안 변한다 (지난 판과 명단으로만
     정해진다). version이 아니라 경기 id로만 다시 받는다 - 누가 걸 때마다
     부르면 배팅 한 번에 요청이 하나씩 더 붙는다 */
  useEffect(() => {
    let alive = true;
    /* 일반 게임은 라인으로 배당이 정해진다. 내전 배당(티어·지난 기록)을
       부르면 엉뚱한 숫자가 뜬다 */
    if (!liveId || activeScrim?.kind === 'casual') {
      setFbOdds(new Map());
      return undefined;
    }
    fetchFbOdds(liveId).then((m) => {
      if (alive) setFbOdds(m);
    });
    return () => {
      alive = false;
    };
  }, [liveId, activeScrim?.kind]);

  const guard = async (fn) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    } finally {
      busy.current = false;
    }
  };

  /* 사람마다 퍼블을 얼마나 따는지. 지난 판 기록으로만 센다 */
  const fbRate = firstBloodRates(scrims);

  const poolOf = (scrimId, market, selection) =>
    pools.find((p) => p.scrim_id === scrimId && p.market === market && p.selection === selection);

  const myBets = (scrimId) => bets.filter((b) => b.scrim_id === scrimId && b.user_id === myId);

  /* ---------- 배팅 담기 ---------- */

  /* 같이 못 거는 항목들. 일반 게임의 첫 킬은 '어느 팀'과 '누구' 중 하나,
     킬 언더오버는 우리 팀·총·상대 팀 중 하나. 하나를 담으면 같은 무리의
     다른 항목은 장바구니에서 빠진다 (이미 건 쪽이 있으면 아예 못 누른다 -
     서버도 막는다) */
  const groupOf = (scrim, market) => {
    if (scrim?.kind !== 'casual') return null;
    if (market === 'fb_side' || market === 'first_blood') return 'fb';
    if (isKillTrio(market)) return 'kills';
    return null;
  };

  const pick = (market, selection) =>
    setCart((prev) => {
      const next = { ...prev };
      if (next[market]?.selection === selection) delete next[market];
      else {
        next[market] = { selection, amount: prev[market]?.amount ?? '' };
        const g = groupOf(activeScrim, market);
        if (g) {
          Object.keys(next).forEach((k) => {
            if (k !== market && groupOf(activeScrim, k) === g) delete next[k];
          });
        }
      }
      return next;
    });

  const setAmount = (market, amount) =>
    setCart((prev) => ({ ...prev, [market]: { ...prev[market], amount } }));

  /* 폰으로 숫자 키보드 올려서 0을 네 번 치는 게 은근히 번거롭다.
     자주 거는 금액은 눌러서 더한다. 마켓 상한은 여기서 잘라준다 */
  const BUMPS = BET_BUMPS;

  const bump = (market, delta) =>
    setCart((prev) => {
      const cap = capOf(market);
      const next = (Number(prev[market]?.amount) || 0) + delta;
      return {
        ...prev,
        [market]: { ...prev[market], amount: String(cap ? Math.min(next, cap) : next) },
      };
    });

  const cartRows = Object.entries(cart);

  /* ---------- 배팅 묶기 ---------- */

  /* 담은 것들을 한 장으로. 배당을 곱한다. 거는 끼꼬는 하나만 적는다 */
  const [parlay, setParlay] = useState(false);
  const [parlayAmt, setParlayAmt] = useState('');

  /* 묶을 때 박히는 배당. 서버(base_odds)와 같은 규칙이다 - 두 갈래 항목은
     기준값, 첫 킬·첫 용은 고정값. 승리팀은 마감 때까지 모르니 못 묶는다 */
  const legOdds = (scrim, market, selection) => {
    if (!scrim || market === 'winner') return null;
    if (market === 'dragon') return dragonOdds();
    if (market === 'first_blood') {
      if (scrim.kind === 'casual') {
        const enemy = enemyLaneOf(selection);
        return firstBloodOdds(
          enemy || scrim.lanes?.[selection],
          scrim.mode,
          enemy ? null : tierOf(Number(selection))
        );
      }
      const n = (scrim.team_a?.length || 0) + (scrim.team_b?.length || 0);
      return fbOdds.get(Number(selection)) ?? Math.round(n * FIRST_BLOOD_RATE * 100) / 100;
    }
    return KILLS_ODDS;
  };

  const legs = cartRows.map(([market, v]) => ({
    market,
    selection: v.selection,
    odds: legOdds(activeScrim, market, v.selection),
  }));
  const hasWinnerLeg = legs.some((l) => l.market === 'winner');
  const combo = hasWinnerLeg ? null : parlayOdds(legs.map((l) => l.odds));
  /* 버는 끼꼬가 상한을 넘지 않게 거꾸로 구한 값과 잔액 중 작은 쪽 */
  const comboCap = combo ? Math.min(parlayCap(combo), me?.points ?? 0) : 0;
  const myParlay = activeScrim
    ? bets.find((b) => b.scrim_id === activeScrim.id && b.user_id === myId && b.market === 'parlay')
    : null;
  const parlayNum = Number(parlayAmt) || 0;
  const parlayWin = combo && parlayNum > 0 ? Math.floor(parlayNum * combo) - parlayNum : 0;
  /* 금액을 먼저 적고 나서 담은 걸 바꾸면 배당이 커져 상한을 넘는다.
     단추만 잠그면 왜 안 되는지 모른다. 이유를 따로 말한다 */
  const parlayBroke = parlayNum > (me?.points ?? 0);
  const parlayTooMuch = !parlayBroke && parlayWin > PARLAY_MAX_WIN;

  /* 낱개로 걸 때 보여줄 배당. 첫 킬·첫 용은 고정이라 그대로, 두 갈래 항목은
     몰리면 움직이니 '약', 승리팀은 걸린 돈으로 나눠 갖는 거라 마감 전엔 모른다 */
  const singleOdds = (scrim, market, selection) => {
    const odds = legOdds(scrim, market, selection);
    if (odds == null) return null;
    return {
      odds,
      /* 일반 게임은 전부 고정이다. 내전은 두 갈래 항목이 몰린 만큼 움직인다 */
      fixed: scrim.kind === 'casual' || market === 'first_blood' || market === 'dragon',
    };
  };

  const bumpParlay = (n) => setParlayAmt(String(Math.min(parlayNum + n, comboCap)));

  /* 묶음의 다리 하나가 어떻게 됐나. 하나만 틀려도 0이라 어디서 틀렸는지가
     제일 궁금하다 */
  const legOutcome = (scrim, l) => {
    if (!scrim || scrim.status !== 'settled') return null;
    if (scrim.kind === 'casual') return casualOutcome(scrim, l.market, l.selection);
    const ans = winningSelection(scrim, l.market);
    if (ans == null) return 'void';
    return ans === l.selection ? 'win' : 'lose';
  };

  const renderLegs = (scrim, b) => (
    <span className="parlay-legs">
      {(b.legs || []).map((l) => {
        const o = legOutcome(scrim, l);
        return (
          <span key={l.market} className={`parlay-leg ${o ? `is-${o}` : ''}`}>
            {o === 'win' && <FaCheck />}
            {o === 'lose' && <FaTimes />}
            {marketLabel(l.market)} {selectionLabel(l.market, l.selection)}
            <i>{Number(l.odds).toFixed(2)}</i>
            {o === 'void' && <em>환불</em>}
          </span>
        );
      })}
    </span>
  );

  const cartTotal = cartRows.reduce((sum, [, v]) => sum + (Number(v.amount) || 0), 0);
  const overBalance = cartTotal > (me?.points ?? 0);

  const submit = (scrim) =>
    guard(async () => {
      if (cartRows.length === 0) {
        toast.error('담은 배팅이 없어요.');
        return;
      }
      const payload = [];
      for (const [market, v] of cartRows) {
        const amount = Number(v.amount);
        if (!Number.isInteger(amount) || amount <= 0) {
          toast.error(`${marketLabel(market)}에 걸 끼꼬를 적어주세요.`);
          return;
        }
        const cap = capOf(market);
        if (cap && amount > cap) {
          toast.error(`${marketLabel(market)}은 ${num(cap)} 끼꼬까지 걸 수 있어요.`);
          return;
        }
        payload.push({ market, selection: v.selection, amount });
      }
      if (cartTotal > (me?.points ?? 0)) {
        toast.error('끼꼬가 모자라요.');
        return;
      }
      await placeBets(scrim.id, payload);
      setCart({});
      toast.success('배팅했어요. 배당은 마감 때 공개됩니다.');
      onChanged();
      load();
    });

  const submitParlay = (scrim) =>
    guard(async () => {
      if (legs.length < 2) {
        toast.error('두 개 이상 담아야 묶을 수 있어요.');
        return;
      }
      if (hasWinnerLeg) {
        toast.error('승리팀은 묶을 수 없어요. 배당이 마감 때 정해집니다.');
        return;
      }
      const amount = Number(parlayAmt);
      if (!Number.isInteger(amount) || amount <= 0) {
        toast.error('걸 끼꼬를 적어주세요.');
        return;
      }
      if (amount > comboCap) {
        toast.error(`이 묶음은 ${num(comboCap)} 끼꼬까지 걸 수 있어요.`);
        return;
      }
      /* 배당은 서버가 다시 매겨 돌려준다. 화면이 보낸 값을 믿으면 콘솔에서
         고쳐 보낼 수 있다 */
      const odds = await placeParlay(scrim.id, legs, amount);
      setCart({});
      setParlayAmt('');
      setParlay(false);
      toast.success(`${Number(odds).toFixed(2)}배로 묶어서 걸었어요.`);
      onChanged();
      load();
    });

  const consent = () =>
    guard(async () => {
      await agreeFairplay();
      toast.success('동의했어요. 이제 배팅할 수 있습니다.');
      onChanged();
    });

  /* ---------- 방장 ---------- */

  const lock = (scrim) =>
    guard(async () => {
      const ok = await confirm({
        title: '배팅 마감',
        message: '지금 배팅을 마감할까요?',
        detail: '마감하면 아무도 더 걸 수 없고, 선택지별 배당이 공개됩니다.',
        confirmText: '마감',
      });
      if (!ok) return;
      await lockBetting(scrim.id);
      toast.success('배팅을 마감했어요.');
      onChanged();
      load();
    });

  /* 시간이 다 되면 화면을 보고 있는 사람이 대신 마감을 남긴다.
     방장만 닫을 수 있게 두면 방장이 딴 데 보고 있을 때 아무도 배당을
     못 보는 상태로 멈춘다. 서버가 시간을 다시 확인하니 아무나 불러도 안전하다.
     여러 명이 동시에 불러도 두 번째부터는 '이미 마감' 오류라 조용히 넘긴다 */
  const autoLock = useCallback(
    async (scrimId) => {
      try {
        await lockBetting(scrimId);
      } catch {
        /* 남이 먼저 닫았거나 아직 서버 시계로는 안 됐다. 폴링이 곧 따라온다 */
      }
      onChanged();
      load();
    },
    [onChanged, load]
  );

  /* 마감이 다가올수록 0 → 1. BetTimer가 1초 단위로 올려준다.
     이 값 하나로 카드 테두리·빛줄·그림자 색이 한꺼번에 옮겨간다 */
  const [heat, setHeat] = useState(0);
  useEffect(() => {
    setHeat(0);
  }, [liveId]);

  /* 펼침 상태를 PlayerTotals 안에 두면 폴링 한 번에 접힌다.
     이 컴포넌트들은 렌더마다 새로 만들어져 정체성이 유지되지 않는다 */
  const [openRows, setOpenRows] = useState({});
  const toggleRow = (key) => setOpenRows((o) => ({ ...o, [key]: !o[key] }));

  const [winner, setWinner] = useState('');
  const [kills, setKills] = useState('');
  const [fb, setFb] = useState('');
  /* 일반 게임만. 첫 킬을 우리가 땄나 상대가 땄나, 첫 용은 무엇이었나 */
  const [fbSide, setFbSide] = useState('');
  const [dragon, setDragon] = useState('');
  /* 일반 게임은 킬을 팀별로 받는다. 상대가 첫 킬을 땄으면 어느 라인인지 */
  const [ourK, setOurK] = useState('');
  const [oppK, setOppK] = useState('');
  const [fbLane, setFbLane] = useState('');
  const [openCasual, setOpenCasual] = useState(false);

  const settle = (scrim) =>
    guard(async () => {
      if (scrim.kind === 'casual') {
        const asKills = (v) => (v === '' ? null : Number(v));
        const ours = asKills(ourK);
        const opp = asKills(oppK);
        if ([ours, opp].some((k) => k !== null && (!Number.isInteger(k) || k < 0))) {
          toast.error('킬 수를 숫자로 적어주세요.');
          return;
        }
        /* 우리가 땄다면서 아무도 안 고르면 '누구' 마켓이 영원히 안 정해진다.
           서버도 막지만, 눌러보기 전에 알려준다 */
        if (fbSide === 'us' && fb === '') {
          toast.error('우리 팀이 땄으면 누가 땄는지도 골라주세요.');
          return;
        }
        await settleCasual(scrim.id, {
          ourKills: ours,
          oppKills: opp,
          fbSide: fbSide || null,
          firstBloodPlayerId: fbSide === 'us' && fb !== '' ? Number(fb) : null,
          fbLane: fbSide === 'them' && fbLane ? fbLane : null,
          dragon: dragon || null,
        });
        setOurK('');
        setOppK('');
        setFb('');
        setFbSide('');
        setFbLane('');
        setDragon('');
        toast.success('정산했어요.');
        onChanged();
        load();
        return;
      }
      if (winner !== 'A' && winner !== 'B') {
        toast.error('이긴 팀을 골라주세요.');
        return;
      }
      const k = kills === '' ? null : Number(kills);
      if (k !== null && (!Number.isInteger(k) || k < 0)) {
        toast.error('총 킬 수를 숫자로 적어주세요.');
        return;
      }
      await settleScrim(scrim.id, winner, k, fb === '' ? null : Number(fb));
      setWinner('');
      setKills('');
      setFb('');
      toast.success('정산했어요.');
      onChanged();
      load();
    });

  /* 팀을 잘못 짰거나 게임이 엎어졌을 때. 예전에는 나갈 길이 아예 없어서
     가짜 결과를 넣어 정산해야만 다음 판으로 넘어갈 수 있었다 */
  const cancel = (scrim) =>
    guard(async () => {
      const ok = await confirm({
        title: '또또 취소',
        message: '이 판을 없던 걸로 할까요?',
        detail: `걸린 ${num(scrim.bet_total)} 끼꼬가 전부 돌아가고 경기 기록도 지워집니다. 되돌릴 수 없어요.`,
        confirmText: '취소하기',
        danger: true,
      });
      if (!ok) return;
      await removeScrim(scrim.id);
      toast.success('또또를 취소하고 끼꼬를 돌려줬어요.');
      onChanged();
      load();
    });

  const undo = (scrim) =>
    guard(async () => {
      const ok = await confirm({
        title: '정산 되돌리기',
        message: '정산을 되돌릴까요?',
        detail: '지급이 전부 취소되고, 되돌린 사실이 로그에 남습니다.',
        confirmText: '되돌리기',
        danger: true,
      });
      if (!ok) return;
      await unsettleScrim(scrim.id);
      toast.success('되돌렸어요. 결과를 다시 넣어주세요.');
      onChanged();
      load();
    });

  /* ---------- 그리기 ---------- */

  /* 마켓마다 선택지 표기가 다르다. 내 배팅·정산 펼치기 두 곳이 같은 말을
     써야 헷갈리지 않아서 한 군데서만 만든다 */
  const selectionLabel = (market, selection) => {
    if (market === 'first_blood') {
      const enemy = enemyLaneOf(selection);
      return enemy ? <LaneTag lane={enemy} prefix="상대 " /> : nameOf.get(Number(selection)) || '?';
    }
    if (market === 'kills_parity') return PARITY.find((x) => x.key === selection)?.label;
    if (market === 'fb_side') return SIDES.find((x) => x.key === selection)?.label;
    if (market === 'dragon') return dragonLabel(selection);
    if (selection === 'A') return '1팀';
    if (selection === 'B') return '2팀';
    if (selection === 'over') return '오버';
    if (selection === 'under') return '언더';
    return selection;
  };

  /* 아래 것들은 컴포넌트가 아니라 '그리는 함수'다.
     렌더 안에서 컴포넌트를 정의하면 렌더마다 타입이 달라져서, 상태가
     조금만 바뀌어도 React가 이 아래를 통째로 다시 마운트한다. DOM이 갈리면
     스크롤 위치가 날아간다 (정산 펼치기를 누르면 맨 위로 튀던 이유).
     함수로 부르면 결과 JSX가 이 컴포넌트의 트리에 그대로 붙어 그런 일이 없다 */
  const renderTeam = ({ ids: teamIds, label, hot }) => (
    <div className={`bet-team ${hot ? 'bet-team-win' : ''}`}>
      <strong>{label}</strong>
      <span>{teamIds.map((id) => nameOf.get(id) || '?').join(', ')}</span>
    </div>
  );

  /* 일반 게임의 '우리 팀'. 상대는 모르니 한 줄뿐이고, 라인을 같이 적는다 */
  const renderCasualTeam = (scrim) => (
    <div className="bet-teams">
      <div className="bet-team">
        <strong>우리 팀</strong>
        <span className="casual-team-names">
          {(scrim.team_a || []).map((id) => {
            const lane = hasLanes(scrim.mode) && scrim.lanes?.[id];
            return (
              <span key={id} className="casual-team-name">
                {lane && <LaneTag lane={lane} className="is-icon-only" />}
                {nameOf.get(id) || '?'}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );

  const modeName = (scrim) => CASUAL_MODES.find((m) => m.key === scrim.mode)?.label || '';

  /* 이 선택지에 건 사람들. 정산이 끝났으면 각자 얼마를 벌고 잃었는지까지.
     "누가 어디에 걸었나"를 눈으로 보는 게 또또의 절반이다 */
  const bettorsOn = (scrim, market, selection) =>
    bets.filter((b) => b.scrim_id === scrim.id && b.market === market && b.selection === selection);

  /* 묶음에 이 선택지를 넣은 사람들. 묶음은 이 칸 하나로 번 게 아니라서
     금액 없이 '묶음'으로만 적는다 */
  const parlayOn = (scrim, market, selection) =>
    bets.filter(
      (b) =>
        b.scrim_id === scrim.id &&
        b.market === 'parlay' &&
        (b.legs || []).some((l) => l.market === market && l.selection === selection)
    );

  const renderOption = ({ scrim, market, selection, label, key, fixed, icon, tone = '' }) => {
    const p = poolOf(scrim.id, market, selection);
    const mine = myBets(scrim.id).find((b) => b.market === market);
    /* 같은 무리의 다른 항목에 이미 걸었으면 이쪽은 잠근다 */
    const g = groupOf(scrim, market);
    const rivalTaken =
      Boolean(g) && myBets(scrim.id).some((b) => b.market !== market && groupOf(scrim, b.market) === g);
    const taken = Boolean(mine) || rivalTaken;
    const picked = cart[market]?.selection === selection;
    const open = scrim.status === 'betting';
    const settled = scrim.status === 'settled';

    /* 마감 전에는 bet_pools가 RLS로 막혀 있어 p가 없다. 퍼블만은 고정
       배당이라 미리 받아둔 값을 보여준다 */
    const odds =
      p?.odds != null
        ? Number(p.odds)
        : fixed != null
          ? fixed
          : market === 'first_blood' && scrim.id === liveId
            ? fbOdds.get(Number(selection))
            : null;

    /* 일반 게임은 정답 하나로 말할 수 없는 경우가 있다 (상대가 땄는데 라인을
       모를 때 - 상대 라인에 건 것만 환불). 결과를 선택지마다 따로 본다 */
    const outcome =
      scrim.kind === 'casual' ? casualOutcome(scrim, market, selection) : null;
    const answer = scrim.kind === 'casual' ? null : winningSelection(scrim, market);
    const won = settled && (scrim.kind === 'casual' ? outcome === 'win' : answer === selection);
    const lost =
      settled &&
      (scrim.kind === 'casual' ? outcome === 'lose' : answer != null && answer !== selection);
    const onParlay = parlayOn(scrim, market, selection);
    /* 내 묶음에 들어 있는 칸도 '내 것'이다 */
    const isMine =
      mine?.selection === selection || onParlay.some((b) => b.user_id === myId);
    const on = bettorsOn(scrim, market, selection);
    const fbShown =
      market === 'first_blood' && scrim.kind !== 'casual'
        ? fbRate.get(Number(selection)) || null
        : null;

    return (
      <div className={`bet-opt-wrap ${settled ? 'is-settled' : ''}`} key={key}>
        <button
          type="button"
          className={`bet-opt ${tone} ${picked ? 'picked' : ''} ${isMine ? 'mine' : ''} ${
            won ? 'won' : ''
          } ${lost ? 'lost' : ''}`}
          disabled={!open || taken}
          onClick={() => pick(market, selection)}
        >
          <span className="bet-opt-label">
            {/* 이름이 길면 칸을 밀어내는 대신 잘린다. 퍼블 칸은 폭이 좁아서
                안 잘라두면 확률과 배당이 칸 밖으로 넘친다 */}
            {icon && <img className="bet-opt-icon" src={icon} alt="" />}
            <span className="bet-opt-text">{label}</span>
            {/* 라벨은 '내가 어떻게 됐나'만 말한다. 정답 자체는 초록 칸이
                이미 말해주고 있어서 안 건 칸에까지 적중을 붙일 이유가 없다 */}
            {isMine && won && <em className="bet-win-tag">적중</em>}
            {isMine && lost && <em className="bet-lost-tag">낙첨</em>}
            {isMine && !won && !lost && <em className="bet-mine-tag">내 배팅</em>}
          </span>
          {/* 숫자는 한 덩어리로 묶는다. 퍼블 칸에서는 이 덩어리가 통째로
              이름 아래 줄로 내려가고, 나머지 마켓에서는 오른쪽에 붙는다 */}
          {(fbShown || odds != null) && (
            <span className="bet-opt-meta">
              {/* 이름만 보고 고르면 찍기다. 지난 판에서 얼마나 땄는지를 붙인다.
                  실제 횟수를 title에만 숨겨뒀더니, 한 판도 못 딴 사람에게
                  38%라고 적힌 꼴이 되어 버그로 읽혔다. 분모를 같이 적는다 */}
              {fbShown && (
                <em
                  className="bet-fb-rate"
                  title={`지난 ${fbShown.games}판 중 ${fbShown.got}번. 판이 적으면 아무나 딸 확률 쪽으로 당겨서 봅니다`}
                >
                  {Math.round(fbShown.rate * 100)}%
                  <b>
                    {fbShown.got}/{fbShown.games}
                  </b>
                </em>
              )}
              {/* 마감 뒤에는 내가 고른 것만이 아니라 전부 보여준다.
                  다른 쪽이 얼마였는지 모르면 내 배당이 좋은 건지도 모른다 */}
              {odds != null && <em className="bet-odds">{odds.toFixed(2)}배</em>}
            </span>
          )}
        </button>

        {settled && on.length + onParlay.length > 0 && (
          <ul className="bet-opt-bettors">
            {on.map((b) => (
              <li key={b.id}>
                <span className="bet-bettor">{memberName.get(b.user_id) || '알 수 없음'}</span>
                <span className="bet-bettor-amt">{num(b.amount)}</span>
                <span className={`kkiko-delta ${b.payout > 0 ? 'plus' : 'minus'}`}>
                  {b.payout > 0 ? `+${num(b.payout - b.amount)}` : `-${num(b.amount)}`}
                </span>
              </li>
            ))}
            {onParlay.map((b) => (
              <li key={`p${b.id}`}>
                <span className="bet-bettor">{memberName.get(b.user_id) || '알 수 없음'}</span>
                <span className="bet-bettor-parlay">묶음</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const killsOf = (scrim, market) => {
    if (market.startsWith('ourkills_')) return scrim.our_kills ?? null;
    if (market.startsWith('oppkills_')) return scrim.opp_kills ?? null;
    return scrim.total_kills ?? null;
  };

  /* 언더오버 한 칸. 위에서부터 오버 · 기준선 · 언더.
     '오버 · 29.5 초과' 같은 글자를 버튼마다 붙이면 기준선이 두 번 나오고,
     눈은 숫자보다 화살표를 먼저 본다 */
  const renderKillColumn = (scrim, { key, label, line }) => (
    <div className="kill-col" key={key}>
      {renderOption({
        scrim,
        market: key,
        selection: 'over',
        tone: 'is-over',
        /* 일반 게임은 고정 배당이라 마감 전에도 그대로 보여준다 */
        fixed: scrim.kind === 'casual' ? KILLS_ODDS : undefined,
        label: (
          <>
            <FaArrowUp /> 오버
          </>
        ),
      })}
      <div className="kill-col-line">
        <em>{label}</em>
        <strong>{line}</strong>
        {/* 끝난 판이면 실제로 몇 킬이었는지. 기준선만 있으면 오버였는지
            언더였는지를 칸 색으로만 짐작해야 한다 */}
        {scrim.status === 'settled' && killsOf(scrim, key) != null && (
          <b className="kill-col-result">{killsOf(scrim, key)}킬</b>
        )}
      </div>
      {renderOption({
        scrim,
        market: key,
        selection: 'under',
        tone: 'is-under',
        fixed: scrim.kind === 'casual' ? KILLS_ODDS : undefined,
        label: (
          <>
            <FaArrowDown /> 언더
          </>
        ),
      })}
    </div>
  );

  /* 일반 게임 또또. 내전과 마켓이 다르다 - 승리팀이 없고(우리 다섯이 한
     팀이다) 팀별 킬·짝홀·어느 팀·첫 용이 있다 */
  const renderCasualMarkets = (scrim) => {
    const total = Number(scrim.kill_line);
    const lanes = scrim.lanes || {};
    const ours = scrim.team_a || [];
    const laned = hasLanes(scrim.mode);

    /* 첫 킬 - 우리 쪽 사람 한 칸 */
    const ourCell = (id) =>
      renderOption({
        key: `u${id}`,
        scrim,
        market: 'first_blood',
        selection: String(id),
        label: (
          <>
            {nameOf.get(id) || '?'}
            {laned &&
              (lanes[id] ? (
                <LaneTag lane={lanes[id]} className="fb-lane" />
              ) : (
                <i className="fb-lane is-undecided">미정</i>
              ))}
          </>
        ),
        /* 라인·티어로 정해지는 고정 배당이라 마감 전에도 보여준다 */
        fixed: firstBloodOdds(lanes[id], scrim.mode, tierOf(id)),
      });

    return (
      <>
        <div className="bet-market">
          <h4>
            킬 언더/오버
            <em>셋 중 하나만 · {KILLS_ODDS}배 고정</em>
          </h4>
          <div className="kill-trio">{killTrio(total).map((k) => renderKillColumn(scrim, k))}</div>
          <p className="rooms-hint">
            우리 팀 오버와 총 킬 오버는 거의 같이 움직여서 하나만 고릅니다. 일반 게임은
            배당이 고정이라 걸 때 보이는 배당이 그대로 받는 배당입니다.
          </p>
        </div>

        <div className="bet-market">
          <h4>
            {marketLabel('kills_parity')}
            <em>총 킬 기준 · {KILLS_ODDS}배 고정</em>
          </h4>
          <div className="bet-opts is-compact">
            {PARITY.map((x) =>
              renderOption({
                key: x.key,
                scrim,
                market: 'kills_parity',
                selection: x.key,
                label: x.label,
                fixed: KILLS_ODDS,
              })
            )}
          </div>
        </div>

        {/* 왼쪽은 우리, 오른쪽은 상대. 맨 윗줄은 '어느 팀', 그 아래는 라인끼리
            마주 본다. 팀이나 사람 중 하나만 담긴다 */}
        <div className="bet-market">
          <h4>
            첫 킬
            <em>팀이나 사람 중 하나만</em>
          </h4>
          <div className="fb-table">
            {SIDES.map((x) =>
              renderOption({
                key: x.key,
                scrim,
                market: 'fb_side',
                selection: x.key,
                label: x.label,
                tone: 'is-side',
                fixed: KILLS_ODDS,
              })
            )}
            {laned
              ? fbRows(ours, lanes, scrim.mode).map((row) => (
                  <React.Fragment key={row.lane}>
                    {row.id != null ? ourCell(row.id) : <span className="fb-empty" />}
                    {renderOption({
                      key: `e${row.lane}`,
                      scrim,
                      market: 'first_blood',
                      selection: enemyPick(row.lane),
                      label: <LaneTag lane={row.lane} prefix="상대 " />,
                      fixed: firstBloodOdds(row.lane, scrim.mode),
                    })}
                  </React.Fragment>
                ))
              : ours.map((id) => (
                  /* 칼바람은 라인이 없어서 상대를 고를 수가 없다. 우리 쪽만 */
                  <React.Fragment key={id}>
                    {ourCell(id)}
                    <span className="fb-empty" />
                  </React.Fragment>
                ))}
          </div>
          <p className="rooms-hint">
            '우리 팀'은 우리 중 누가 따든 맞습니다. 사람을 고르면 배당이 훨씬 크지만,
            다른 사람이 따면 낙첨입니다. 한 번에 {num(capOf('first_blood'))} 끼꼬까지.
          </p>
        </div>

        {hasDragon(scrim.mode) && (
          <div className="bet-market">
            <h4>
              {marketLabel('dragon')}
              <em>{dragonOdds()}배</em>
            </h4>
            <div className="bet-opts bet-opts-grid casual-dragons">
              {DRAGONS.map((d) =>
                renderOption({
                  key: d.key,
                  scrim,
                  market: 'dragon',
                  selection: d.key,
                  label: d.label,
                  icon: dragonIcon(d.key),
                  fixed: dragonOdds(),
                })
              )}
            </div>
            <p className="rooms-hint">
              어느 팀이 잡든 처음 나온 용의 종류만 맞히면 됩니다. 한 번에{' '}
              {num(capOf('dragon'))} 끼꼬까지.
            </p>
          </div>
        )}
      </>
    );
  };

  const renderMarkets = (scrim) => {
    if (scrim.kind === 'casual') return renderCasualMarkets(scrim);
    const roster = [...(scrim.team_a || []), ...(scrim.team_b || [])];
    const fixedFb = (roster.length * FIRST_BLOOD_RATE).toFixed(2);
    return (
      <>
        <div className="bet-market">
          <h4>{marketLabel('winner')}</h4>
          <div className="bet-opts">
            {renderOption({ scrim, market: 'winner', selection: 'A', label: '1팀 승리' })}
            {renderOption({ scrim, market: 'winner', selection: 'B', label: '2팀 승리' })}
          </div>
          <p className="rooms-hint">
            걸린 끼꼬를 적중한 쪽끼리 나눠 갖습니다. 많이 걸린 쪽일수록 배당이 낮습니다.
          </p>
        </div>

        <div className="bet-market">
          <h4>
            {marketLabel('first_blood')}
            <em>기본 {fixedFb}배</em>
          </h4>
          <p className="rooms-hint">
            티어가 낮을수록, 지금까지 첫 킬을 적게 땄을수록 배당이 조금 높습니다. 고정
            배당이라 마감 전에도 그대로입니다. 이름 옆 확률은 <b>딴 횟수/판수</b>를
            판수가 적을수록 '아무나 딸 확률' 쪽으로 당긴 값입니다 — 한 판 한 번을
            100%로 쓰면 그 사람에게 돈이 몰려요.
          </p>
          <div className="bet-opts bet-opts-grid">
            {roster.map((id) =>
              renderOption({
                key: id,
                scrim,
                market: 'first_blood',
                selection: String(id),
                label: nameOf.get(id) || '?',
              })
            )}
          </div>
          <p className="rooms-hint">한 번에 {num(capOf('first_blood'))} 끼꼬까지.</p>
        </div>

        {[killLineOfScrim(scrim, gameKey)].map((line) => {
          const market = killMarket(line);
          return (
            <div className="bet-market" key={market}>
              <h4>
                총 킬 언더/오버
                <em>기준 {KILLS_ODDS}배</em>
              </h4>
              <div className="kill-trio is-single">
                {renderKillColumn(scrim, { key: market, label: '총 킬', line })}
              </div>
              <p className="rooms-hint">
                둘 중 하나만 고를 수 있어요. 한쪽에 몰리면 그쪽 배당이 내려가고 반대쪽이
                올라갑니다 — 확정된 배당은 마감 때 나옵니다.
              </p>
            </div>
          );
        })}
      </>
    );
  };

  const renderMyBets = (scrim) => {
    const mine = myBets(scrim.id);
    if (mine.length === 0) return null;
    return (
      <div className="bet-market">
        <h4>내 배팅</h4>
        <ul className="bet-list">
          {mine.map((b) => (
            <li key={b.id}>
              <span className="rooms-name">
                {marketLabel(b.market)}
                <em>
                  {' · '}
                  {b.market === 'parlay'
                    ? `${(b.legs || []).length}개`
                    : selectionLabel(b.market, b.selection)}
                </em>
              </span>
              <span className="kkiko-when">{num(b.amount)} 끼꼬</span>
              {b.odds != null && <em className="bet-odds">{Number(b.odds).toFixed(2)}배</em>}
              {/* 아직 결과 전이면 '맞으면 얼마 버는지'를 보여준다.
                  배당만 적혀 있으면 매번 머리로 곱해야 한다 */}
              {b.payout == null && b.odds != null && (
                <span className="bet-if-win">적중 시 +{num(Math.floor(b.amount * b.odds) - b.amount)}</span>
              )}
              {b.payout != null && (
                <span className={`kkiko-delta ${b.payout > 0 ? 'plus' : 'minus'}`}>
                  {b.payout > 0 ? `+${num(b.payout - b.amount)}` : `-${num(b.amount)}`}
                </span>
              )}
              {b.market === 'parlay' && renderLegs(scrim, b)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  /* 선택지별로 흩어져 있는 걸 사람 단위로 다시 모은다.
     '내가 이번 판에 결국 얼마 잃었나'는 그렇게 봐야 나온다 */
  const renderTotals = (scrim) => {
    const rows = bets.filter((b) => b.scrim_id === scrim.id);
    if (rows.length === 0) return null;

    const byUser = new Map();
    rows.forEach((b) => {
      const cur = byUser.get(b.user_id) || { staked: 0, payout: 0, count: 0 };
      cur.staked += b.amount;
      cur.payout += b.payout || 0;
      cur.count += 1;
      byUser.set(b.user_id, cur);
    });

    const list = [...byUser.entries()]
      .map(([userId, v]) => ({ userId, ...v, net: v.payout - v.staked }))
      .sort((a, b) => b.net - a.net);

    return (
      <div className="bet-market">
        <h4>이번 판 정산</h4>
        <ul className="bet-totals">
          {list.map((r) => {
            const key = `${scrim.id}:${r.userId}`;
            const open = Boolean(openRows[key]);
            return (
              <li key={r.userId} className={r.net > 0 ? 'is-plus' : r.net < 0 ? 'is-minus' : ''}>
                {/* 줄 전체가 펼침 버튼이다. 따로 아이콘 칸을 두면
                    그만큼 이름 자리가 줄어든다 */}
                <button
                  type="button"
                  className={`bet-total-row ${open ? 'is-open' : ''}`}
                  onClick={() => toggleRow(key)}
                  aria-expanded={open}
                >
                  <FaChevronRight className="bet-total-caret" />
                  <span className="bet-total-name">{memberName.get(r.userId) || '알 수 없음'}</span>
                  {/* '걸어/회수'라고 쓰면 한 줄이 길어져 이름이 밀린다.
                      건 돈 → 받은 돈 두 숫자만 화살표로 잇는 게 한눈에 읽힌다 */}
                  <span className="bet-total-detail">
                    {num(r.staked)}
                    <i className="bet-total-arrow">→</i>
                    {num(r.payout)}
                    {r.count > 1 && <em>{r.count}건</em>}
                  </span>
                  <span className={`kkiko-delta ${r.net >= 0 ? 'plus' : 'minus'}`}>
                    {r.net > 0 ? `+${num(r.net)}` : num(r.net)}
                  </span>
                </button>

                {open && (
                  <ul className="bet-total-lines">
                    {rows
                      .filter((b) => b.user_id === r.userId)
                      .map((b) => {
                        const hit = (b.payout || 0) > 0;
                        return (
                          <li key={b.id} className={hit ? 'is-plus' : 'is-minus'}>
                            <span className="bet-line-what">
                              {marketLabel(b.market)}
                              <em>
                                {b.market === 'parlay'
                                  ? `${(b.legs || []).length}개`
                                  : selectionLabel(b.market, b.selection)}
                              </em>
                              {b.market === 'parlay' && renderLegs(scrim, b)}
                            </span>
                            <span className="bet-line-amt">
                              {num(b.amount)}
                              {b.odds != null && <i>×{Number(b.odds).toFixed(2)}</i>}
                            </span>
                            <span className={`kkiko-delta ${hit ? 'plus' : 'minus'}`}>
                              {hit ? `+${num(b.payout - b.amount)}` : `-${num(b.amount)}`}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="room-settings">
      {single ? null : !activeScrim ? (
        <section className="room-panel">
          <Empty
            icon={<FaDice />}
            title="지금 열린 또또가 없어요"
            desc="내전은 게임 시작 탭에서 팀을 채우고 '또또 열기'를 누르면 여기에 올라옵니다."
          />
          {/* 내전이 아닌 날에도 걸 수 있다. 우리끼리 일반·칼바람 큐를 돌릴 때.
              롤 방만 - 발로란트는 용도 라인도 없다 */}
          {canEdit && gameKey === 'lol' && (
            <div className="casual-open-row">
              <button className="ghost-btn" onClick={() => setOpenCasual(true)}>
                <FaDice /> 일반 게임 또또 열기
              </button>
              <span className="rooms-hint">
                우리끼리 일반·칼바람 큐를 돌릴 때. 전적에는 안 남고 끼꼬만 오갑니다.
              </span>
            </div>
          )}
        </section>
      ) : (
        /* 진행 중인 판은 빛나게 둔다. 지난 기록과 같은 카드로 그려두면
           스크롤하다가 '지금 걸 수 있는 판'을 그냥 지나친다 */
        <section
          className={`room-panel bet-live ${
            activeScrim.status === 'betting' ? 'is-betting' : 'is-locked'
          }`}
          style={
            heat > 0
              ? { '--live': `color-mix(in srgb, #f97362 ${Math.round(heat * 100)}%, #4ade80)` }
              : undefined
          }
        >
          <h3>
            {activeScrim.kind === 'casual' ? (
              <>
                일반 게임
                <span className="casual-badge">{modeName(activeScrim)}</span>
              </>
            ) : (
              '내전'
            )}
            {/* 상태와 남은 시간은 한 덩어리다. 타이머를 아래에 크게 두면
                정작 걸어야 할 선택지가 화면 밖으로 밀린다 */}
            <span className="bet-head-live">
              <span className={`bet-status is-live s-${activeScrim.status}`}>
                {activeScrim.status === 'betting' ? '배팅 중' : '배팅 마감 · 경기 진행 중'}
              </span>
              {activeScrim.status === 'betting' && activeScrim.betting_closes_at && (
                <BetTimer
                  closesAt={activeScrim.betting_closes_at}
                  openedAt={activeScrim.played_at}
                  onExpire={() => autoLock(activeScrim.id)}
                  onHeat={setHeat}
                />
              )}
            </span>
          </h3>

          {activeScrim.kind === 'casual' ? (
            renderCasualTeam(activeScrim)
          ) : (
            <div className="bet-teams">
              {renderTeam({ ids: activeScrim.team_a || [], label: '1팀' })}
              {renderTeam({ ids: activeScrim.team_b || [], label: '2팀' })}
            </div>
          )}

          {/* 방장이 '다 걸었나?'만 보고 마감할 수 있어야 한다.
              누가 어디에 걸었는지는 마감 전까지 여전히 안 보인다 */}
          <div className="bet-progress">
            <span className="bet-done-count">
              <strong>{activeScrim.bet_count}</strong>명 배팅 완료
            </span>
            <span className="bet-progress-total">총 {num(activeScrim.bet_total)} 끼꼬</span>
            <span className="bet-progress-note">
              {activeScrim.status === 'betting'
                ? '배당은 마감 때 공개됩니다'
                : '배당이 확정됐습니다'}
            </span>
          </div>

          {/* 숫자만 보면 '누가 아직 안 걸었지?'를 입으로 물어야 한다.
              무엇에 걸었는지는 여전히 마감 뒤에만 보인다 */}
          {bettors.length > 0 && (
            <div className="bet-done-who">
              {bettors.map((id) => (
                <span className="bet-done-name" key={id}>
                  {memberName.get(id) || '알 수 없음'}
                </span>
              ))}
            </div>
          )}

          {activeScrim.status === 'betting' && !me?.agreed && (
            <div className="bet-consent">
              <p>
                배팅에 신경쓰지 않고 경기를 진행하겠습니다. 이기려고만 하겠습니다.
              </p>
              <button className="ghost-btn" onClick={consent}>
                <FaCheck /> 동의하고 배팅하기
              </button>
            </div>
          )}

          {(activeScrim.status !== 'betting' || me?.agreed) && renderMarkets(activeScrim)}

          {renderMyBets(activeScrim)}

          {activeScrim.status === 'betting' && cartRows.length > 0 && (
            <div className={`bet-cart ${parlay ? 'is-parlay' : ''}`}>
              <h4>
                담은 배팅<span className="bet-cart-n">{cartRows.length}</span>
                {/* 한 판에 묶음은 하나뿐이다. 이미 걸었으면 끈 채로 잠근다 */}
                <button
                  type="button"
                  className={`parlay-toggle ${parlay ? 'is-on' : ''}`}
                  onClick={() => setParlay(!parlay)}
                  disabled={Boolean(myParlay)}
                  aria-pressed={parlay}
                  title={myParlay ? '이 판에는 이미 묶음을 걸었어요' : '배당을 곱해서 한 장으로 겁니다'}
                >
                  <FaLink /> 배팅 묶기
                  <span className="parlay-switch" aria-hidden="true" />
                </button>
              </h4>

              {parlay ? (
                <>
                  <ul className="bet-cart-list">
                    {legs.map((l) => (
                      <li className="bet-cart-item is-leg" key={l.market}>
                        <span className="bet-cart-what">
                          <b>{marketLabel(l.market)}</b>
                          <em>{selectionLabel(l.market, l.selection)}</em>
                        </span>
                        <em className={`bet-odds ${l.odds ? '' : 'is-bad'}`}>
                          {l.odds ? `${l.odds.toFixed(2)}배` : '못 묶음'}
                        </em>
                        <button
                          className="icon-btn bet-cart-drop"
                          onClick={() => pick(l.market, l.selection)}
                          aria-label={`${marketLabel(l.market)} 빼기`}
                          title="빼기"
                        >
                          <FaTimes />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* 곱한 배당과, 그 배당에서 거꾸로 구한 상한 */}
                  <div className="parlay-sum">
                    <span>
                      묶음 배당 <strong>{combo ? `${combo.toFixed(2)}배` : '-'}</strong>
                    </span>
                    {combo && <em>최대 {num(comboCap)} 끼꼬</em>}
                  </div>
                  {hasWinnerLeg && (
                    <p className="bet-over-msg">
                      승리팀은 묶을 수 없어요. 배당이 마감 때 정해져서 곱할 수가 없습니다.
                    </p>
                  )}
                  {!hasWinnerLeg && legs.length < 2 && (
                    <p className="rooms-hint">두 개 이상 담아야 묶을 수 있어요.</p>
                  )}

                  <div className="bet-cart-item is-parlay-amt">
                    <span className="bet-cart-amt">
                      <input
                        className="bet-amount"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={comboCap || undefined}
                        value={parlayAmt}
                        placeholder="0"
                        aria-label="묶음에 걸 끼꼬"
                        onChange={(e) => setParlayAmt(e.target.value)}
                        disabled={!combo}
                      />
                      <i>끼꼬</i>
                    </span>
                    <div className="bet-chips">
                      {BUMPS.map((n) => (
                        <button
                          key={n}
                          className="bet-chip"
                          onClick={() => bumpParlay(n)}
                          disabled={!combo}
                        >
                          +{n}
                        </button>
                      ))}
                      <button
                        className="bet-chip"
                        onClick={() => setParlayAmt(String(comboCap))}
                        disabled={!combo || comboCap <= 0}
                      >
                        최대
                      </button>
                      <button
                        className="bet-chip is-clear"
                        onClick={() => setParlayAmt('')}
                        disabled={!parlayAmt}
                      >
                        초기화
                      </button>
                    </div>
                  </div>

                  <div
                    className={`bet-cart-foot ${parlayBroke || parlayTooMuch ? 'is-over' : ''}`}
                  >
                    <span className={`bet-cart-total ${parlayTooMuch ? 'is-too-much' : ''}`}>
                      <i>적중 시</i>
                      <strong>{parlayWin > 0 ? `+${num(parlayWin)}` : '-'}</strong>
                    </span>
                    <span className="bet-cart-left">
                      {num(me?.points)}
                      <b>→</b>
                      {num((me?.points ?? 0) - parlayNum)}
                    </span>
                    <button
                      className="primary-btn"
                      onClick={() => submitParlay(activeScrim)}
                      disabled={!combo || parlayNum <= 0 || parlayNum > comboCap}
                    >
                      묶어서 걸기
                    </button>
                  </div>
                  {parlayTooMuch && (
                    <p className="bet-over-msg">
                      적중 시 버는 끼꼬는 최대 {num(PARLAY_MAX_WIN)}을 넘을 수 없어요. 이 묶음은{' '}
                      {num(comboCap)} 끼꼬까지 걸 수 있습니다 — 금액을 초기화하고 다시 정해주세요.
                    </p>
                  )}
                  {parlayBroke && (
                    <p className="bet-over-msg">
                      잔액보다 {num(parlayNum - (me?.points ?? 0))} 끼꼬 더 걸었어요.
                    </p>
                  )}
                  <p className="rooms-hint">
                    전부 맞아야 받습니다. 하나라도 틀리면 전부 잃어요. 결과를 안 넣은 항목은 그
                    항목만 빼고 계산합니다. 배당은 거는 순간 박힙니다
                    {activeScrim.kind !== 'casual' &&
                      ` — 언더오버처럼 몰리면 움직이는 항목도 묶음에서는 기준값(${KILLS_ODDS}배)으로 곱합니다`}
                    . 묶음에 건 끼꼬는 낱개 배당에 섞이지 않아서, 묶음이 반대쪽 배당을 띄우지
                    않습니다.
                  </p>
                </>
              ) : (
                <>
                  <ul className="bet-cart-list">
                    {cartRows.map(([market, v]) => {
                      const cap = capOf(market);
                      const so = singleOdds(activeScrim, market, v.selection);
                      const amt = Number(v.amount) || 0;
                      return (
                        <li className="bet-cart-item" key={market}>
                          {/* 무엇에 걸었는지가 먼저. 마켓 이름만 적혀 있으면
                              위로 올라가 다시 확인해야 한다 */}
                          <span className="bet-cart-what">
                            <b>{marketLabel(market)}</b>
                            <em>{selectionLabel(market, v.selection)}</em>
                            <i className={`bet-cart-rate ${so?.fixed ? 'is-fixed' : ''}`}>
                              {so ? `${so.fixed ? '' : '약 '}${so.odds.toFixed(2)}배` : '마감 때'}
                            </i>
                          </span>

                          <span className="bet-cart-amt">
                            <input
                              className="bet-amount"
                              type="number"
                              inputMode="numeric"
                              min="1"
                              max={cap || undefined}
                              value={v.amount}
                              placeholder="0"
                              aria-label={`${marketLabel(market)}에 걸 끼꼬`}
                              onChange={(e) => setAmount(market, e.target.value)}
                            />
                            <i>끼꼬</i>
                          </span>

                          {/* 빼려면 위로 올라가 같은 칸을 다시 눌러야 했다 */}
                          <button
                            className="icon-btn bet-cart-drop"
                            onClick={() => pick(market, v.selection)}
                            aria-label={`${marketLabel(market)} 빼기`}
                            title="빼기"
                          >
                            <FaTimes />
                          </button>

                          <div className="bet-chips">
                            {/* 좁은 화면에서 초기화까지 한 줄에 들어가야 해서
                                천 단위 쉼표는 뺀다 (+1,000 → +1000) */}
                            {BUMPS.map((n) => (
                              <button key={n} className="bet-chip" onClick={() => bump(market, n)}>
                                +{n}
                              </button>
                            ))}
                            <button
                              className="bet-chip is-clear"
                              onClick={() => setAmount(market, '')}
                              disabled={!v.amount}
                            >
                              초기화
                            </button>
                            {cap && <em className="bet-cap">최대 {num(cap)}</em>}
                            {/* 배당만 적혀 있으면 매번 머리로 곱해야 한다 */}
                            {so && amt > 0 && (
                              <em className="bet-if">
                                적중 시 {so.fixed ? '' : '약 '}+
                                {num(Math.floor(amt * so.odds) - amt)}
                              </em>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className={`bet-cart-foot ${overBalance ? 'is-over' : ''}`}>
                    <span className="bet-cart-total">
                      <i>합계</i>
                      <strong>{num(cartTotal)}</strong>
                    </span>
                    {/* '잔액 12,000'만 적혀 있으면 걸고 나서 얼마가 남는지를
                        매번 머리로 뺀다 */}
                    <span className="bet-cart-left">
                      {num(me?.points)}
                      <b>→</b>
                      {num((me?.points ?? 0) - cartTotal)}
                    </span>
                    <button
                      className="primary-btn"
                      onClick={() => submit(activeScrim)}
                      disabled={overBalance}
                    >
                      배팅 완료
                    </button>
                  </div>
                  {/* '배팅 완료'를 눌러야 모자란 걸 알려주면 늦다 */}
                  {overBalance && (
                    <p className="bet-over-msg">
                      잔액보다 {num(cartTotal - (me?.points ?? 0))} 끼꼬 더 걸었어요.
                    </p>
                  )}
                  <p className="rooms-hint">
                    담은 것들은 각각 따로 걸립니다. '약'이 붙은 배당은 몰린 만큼 움직여서 마감 때
                    확정되고, 첫 킬·첫 용은 그대로입니다. 배당을 곱하려면 <b>배팅 묶기</b>를 켜세요.
                  </p>
                </>
              )}
            </div>
          )}

          {canEdit && activeScrim.status === 'betting' && (
            <button className="primary-btn bet-action" onClick={() => lock(activeScrim)}>
              <FaLock /> 게임 시작 (배팅 마감)
            </button>
          )}

          {/* 방장만. 실수로 누르면 끝이라 확인창을 반드시 거친다 */}
          {isOwner && (
            <button className="ghost-btn bet-cancel" onClick={() => cancel(activeScrim)}>
              <FaTrash /> 이 판 취소하기
            </button>
          )}

          {/* 결과 넣기. 항목마다 이름표를 왼쪽에 두고 한 줄씩 - 전에는 칸들이
              한 줄에 엉겨 있어서 무엇을 넣는 칸인지 읽기 어려웠다 */}
          {canEdit && activeScrim.status === 'locked' && (
            <div className="bet-result">
              <h4>경기 결과 넣기</h4>

              {activeScrim.kind === 'casual' ? (
                <>
                  <div className="result-field">
                    <span className="result-label">킬</span>
                    <div className="result-score">
                      <label>
                        <em>우리 팀</em>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={ourK}
                          placeholder="-"
                          aria-label="우리 팀 킬"
                          onChange={(e) => setOurK(e.target.value)}
                        />
                      </label>
                      <i>:</i>
                      <label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={oppK}
                          placeholder="-"
                          aria-label="상대 팀 킬"
                          onChange={(e) => setOppK(e.target.value)}
                        />
                        <em>상대 팀</em>
                      </label>
                      {ourK !== '' && oppK !== '' && (
                        <b className="result-total">총 {Number(ourK) + Number(oppK)}킬</b>
                      )}
                    </div>
                  </div>

                  <div className="result-field">
                    <span className="result-label">첫 킬</span>
                    <div className="result-pick">
                      <div className="seg-tabs">
                        {SIDES.map((x) => (
                          <button
                            key={x.key}
                            className={`seg-tab ${fbSide === x.key ? 'active' : ''}`}
                            onClick={() => {
                              setFbSide(fbSide === x.key ? '' : x.key);
                              setFb('');
                              setFbLane('');
                            }}
                          >
                            {x.label}
                          </button>
                        ))}
                      </div>
                      {fbSide === 'us' && (
                        <div className="result-chips">
                          {(activeScrim.team_a || []).map((id) => (
                            <button
                              key={id}
                              className={`result-chip ${String(fb) === String(id) ? 'is-on' : ''}`}
                              onClick={() => setFb(String(id))}
                            >
                              {nameOf.get(id) || '?'}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* 상대 라인은 몰라도 된다. 비우면 상대 라인에 건 것만 돌려준다 */}
                      {fbSide === 'them' && hasLanes(activeScrim.mode) && (
                        <div className="result-chips">
                          {FB_ROW_ORDER.map((lane) => (
                            <button
                              key={lane}
                              className={`result-chip ${fbLane === lane ? 'is-on' : ''}`}
                              onClick={() => setFbLane(fbLane === lane ? '' : lane)}
                            >
                              <LaneTag lane={lane} prefix="상대 " />
                            </button>
                          ))}
                          <span className="result-hint">모르면 비워두기</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {hasDragon(activeScrim.mode) && (
                    <div className="result-field">
                      <span className="result-label">첫 용</span>
                      <div className="casual-dragon-pick">
                        {DRAGONS.map((d) => (
                          <button
                            key={d.key}
                            className={`casual-dragon ${dragon === d.key ? 'is-on' : ''}`}
                            onClick={() => setDragon(dragon === d.key ? '' : d.key)}
                            title={d.label}
                          >
                            <img src={dragonIcon(d.key)} alt="" />
                            <span>{d.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="result-field">
                    <span className="result-label">이긴 팀</span>
                    <div className="seg-tabs">
                      {['A', 'B'].map((w) => (
                        <button
                          key={w}
                          className={`seg-tab ${winner === w ? 'active' : ''}`}
                          onClick={() => setWinner(w)}
                        >
                          {w === 'A' ? '1팀 승리' : '2팀 승리'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="result-field">
                    <span className="result-label">총 킬</span>
                    <div className="result-score">
                      <label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={kills}
                          placeholder="-"
                          aria-label="총 킬 수"
                          onChange={(e) => setKills(e.target.value)}
                        />
                        <em>킬</em>
                      </label>
                    </div>
                  </div>
                  <div className="result-field">
                    <span className="result-label">첫 킬</span>
                    <div className="result-chips">
                      {[...(activeScrim.team_a || []), ...(activeScrim.team_b || [])].map((id) => (
                        <button
                          key={id}
                          className={`result-chip ${String(fb) === String(id) ? 'is-on' : ''}`}
                          onClick={() => setFb(String(fb) === String(id) ? '' : String(id))}
                        >
                          {nameOf.get(id) || '?'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <button className="primary-btn result-submit" onClick={() => settle(activeScrim)}>
                정산하기
              </button>
              <p className="rooms-hint">
                비워둔 항목은 그 마켓 전체를 환불합니다.
                {activeScrim.kind === 'casual'
                  ? ' 첫 킬을 딴 쪽이 아닌 사람에 건 배팅은 환불이 아니라 낙첨입니다.'
                  : ' 적중한 쪽에 아무도 안 걸었을 때도 환불입니다.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 여기서부터는 끝난 판. 카드가 똑같이 생겨서 아래로 이어지면
          어디까지가 한 판인지 안 보인다. 선을 긋고 판마다 이름표를 단다 */}
      {openCasual && (
        <CasualOpenModal
          players={players.filter((p) => !p.deleted_at)}
          recent={
            [...scrims]
              .filter((s) => s.kind === 'casual')
              .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))[0] || null
          }
          onClose={() => setOpenCasual(false)}
          onOpen={(opts) =>
            guard(async () => {
              await openCasualBet({ roomId, ...opts });
              setOpenCasual(false);
              toast.success(
                opts.closeSeconds
                  ? `또또를 열었어요. ${Math.round(opts.closeSeconds / 60) || 1}분 뒤 자동으로 마감됩니다.`
                  : '또또를 열었어요. 마감은 직접 눌러야 합니다.'
              );
              onChanged();
            })
          }
        />
      )}

      {history.length > 0 && (
        <div className="bet-past-sep">
          <span>지난 또또 {history.length}판</span>
        </div>
      )}

      {history.map((s, i) => (
        <section className="room-panel bet-past" key={s.id}>
          <div className="bet-past-label">
            <span className="bet-past-no">{i === 0 ? '직전 경기' : `${i + 1}판 전`}</span>
            <span className="bet-past-when">
              {timeAgo(new Date(s.played_at).getTime())} ·{' '}
              {new Date(s.played_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
          {s.kind === 'casual' ? (
            <>
              <h3>
                일반 게임
                <span className="casual-badge">{modeName(s)}</span>
                <span className="bet-status s-settled">정산 완료</span>
              </h3>
              {renderCasualTeam(s)}
              <p className="rooms-hint">
                킬 {s.our_kills ?? '-'} : {s.opp_kills ?? '-'}
                {s.total_kills != null && ` (총 ${s.total_kills})`} · 첫 킬{' '}
                {s.fb_side === 'them'
                  ? s.fb_enemy_lane
                    ? <LaneTag lane={s.fb_enemy_lane} prefix="상대 " />
                    : '상대 팀'
                  : s.first_blood_player_id
                    ? nameOf.get(s.first_blood_player_id) || '?'
                    : '-'}
                {hasDragon(s.mode) && ` · 첫 용 ${s.first_dragon ? dragonLabel(s.first_dragon) : '-'}`}
                {' · '}또또 {num(s.bet_total)} 끼꼬
                {s.undo_count > 0 && ` · 정산 ${s.undo_count}번 되돌림`}
              </p>
            </>
          ) : (
            <>
              <h3>
                {s.winner === 'A' ? '1팀' : '2팀'} 승리
                <span className="bet-status s-settled">정산 완료</span>
              </h3>
              <div className="bet-teams">
                {renderTeam({ ids: s.team_a || [], label: '1팀', hot: s.winner === 'A' })}
                {renderTeam({ ids: s.team_b || [], label: '2팀', hot: s.winner === 'B' })}
              </div>
              <p className="rooms-hint">
                총 킬 {s.total_kills ?? '-'} · 첫 킬{' '}
                {s.first_blood_player_id ? nameOf.get(s.first_blood_player_id) || '?' : '-'} ·
                또또 {num(s.bet_total)} 끼꼬
                {s.undo_count > 0 && ` · 정산 ${s.undo_count}번 되돌림`}
              </p>
            </>
          )}
          {/* 배팅할 때와 같은 화면을 그대로 다시 보여준다. 적중한 칸은 초록,
              각 칸 아래에 누가 걸어서 얼마를 벌고 잃었는지 붙는다 */}
          {renderMarkets(s)}
          {renderTotals(s)}
          {isOwner && (
            <button className="ghost-btn bet-action" onClick={() => undo(s)}>
              <FaUndo /> 정산 되돌리기
            </button>
          )}
        </section>
      ))}
    </div>
  );
};

export default BetTab;
