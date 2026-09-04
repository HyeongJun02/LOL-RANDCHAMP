import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaLock, FaCheck, FaUndo } from 'react-icons/fa';
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
  unsettleScrim,
  fetchBetting,
} from '../../rooms';
import { useDialog } from '../../components/common/Dialog';
import BetTimer from './BetTimer';

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
}) => {
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const memberName = new Map(members.map((m) => [m.user_id, m.nickname]));
  const me = members.find((m) => m.user_id === myId);
  const { confirm } = useDialog();

  /* 또또를 건 경기만. 결과가 나온 것들은 기록으로 남겨 계속 본다 */
  const history = scrims
    .filter((s) => s.status === 'settled' && s.bet_count > 0)
    .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    .slice(0, 5);

  const shown = [activeScrim, ...history].filter(Boolean);
  const ids = shown.map((s) => s.id);
  const idKey = ids.join(',');

  const [pools, setPools] = useState([]);
  const [bets, setBets] = useState([]);
  const [cart, setCart] = useState({});
  const busy = useRef(false);

  const load = useCallback(async () => {
    const list = idKey ? idKey.split(',').map(Number) : [];
    const got = await fetchBetting(list).catch(() => ({ pools: [], bets: [] }));
    setPools(got.pools);
    setBets(got.bets);
  }, [idKey]);

  useEffect(() => {
    load();
  }, [load, version]);

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

  const poolOf = (scrimId, market, selection) =>
    pools.find((p) => p.scrim_id === scrimId && p.market === market && p.selection === selection);

  const myBets = (scrimId) => bets.filter((b) => b.scrim_id === scrimId && b.user_id === myId);

  /* ---------- 배팅 담기 ---------- */

  const pick = (market, selection) =>
    setCart((prev) => {
      const next = { ...prev };
      if (next[market]?.selection === selection) delete next[market];
      else next[market] = { selection, amount: prev[market]?.amount ?? '' };
      return next;
    });

  const setAmount = (market, amount) =>
    setCart((prev) => ({ ...prev, [market]: { ...prev[market], amount } }));

  const cartRows = Object.entries(cart);
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

  const [winner, setWinner] = useState('');
  const [kills, setKills] = useState('');
  const [fb, setFb] = useState('');

  const settle = (scrim) =>
    guard(async () => {
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

  const Team = ({ ids: teamIds, label, hot }) => (
    <div className={`bet-team ${hot ? 'bet-team-win' : ''}`}>
      <strong>{label}</strong>
      <span>{teamIds.map((id) => nameOf.get(id) || '?').join(', ')}</span>
    </div>
  );

  /* 이 선택지에 건 사람들. 정산이 끝났으면 각자 얼마를 벌고 잃었는지까지.
     "누가 어디에 걸었나"를 눈으로 보는 게 또또의 절반이다 */
  const bettorsOn = (scrim, market, selection) =>
    bets.filter((b) => b.scrim_id === scrim.id && b.market === market && b.selection === selection);

  const Option = ({ scrim, market, selection, label }) => {
    const p = poolOf(scrim.id, market, selection);
    const mine = myBets(scrim.id).find((b) => b.market === market);
    const taken = Boolean(mine);
    const picked = cart[market]?.selection === selection;
    const open = scrim.status === 'betting';
    const settled = scrim.status === 'settled';

    const answer = winningSelection(scrim, market);
    const won = settled && answer === selection;
    const lost = settled && answer != null && answer !== selection;
    const isMine = mine?.selection === selection;
    const on = bettorsOn(scrim, market, selection);

    return (
      <div className={`bet-opt-wrap ${settled ? 'is-settled' : ''}`}>
        <button
          type="button"
          className={`bet-opt ${picked ? 'picked' : ''} ${isMine ? 'mine' : ''} ${
            won ? 'won' : ''
          } ${lost ? 'lost' : ''}`}
          disabled={!open || taken}
          onClick={() => pick(market, selection)}
        >
          <span className="bet-opt-label">
            {label}
            {isMine && <em className="bet-mine-tag">내 배팅</em>}
            {won && <em className="bet-win-tag">적중</em>}
          </span>
          {/* 마감 뒤에는 내가 고른 것만이 아니라 전부 보여준다.
              다른 쪽이 얼마였는지 모르면 내 배당이 좋은 건지도 모른다 */}
          {p?.odds != null && <em className="bet-odds">{Number(p.odds).toFixed(2)}배</em>}
        </button>

        {settled && on.length > 0 && (
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
          </ul>
        )}
      </div>
    );
  };

  const Markets = ({ scrim }) => {
    const roster = [...(scrim.team_a || []), ...(scrim.team_b || [])];
    const fixedFb = (roster.length * 0.85).toFixed(2);
    return (
      <>
        <div className="bet-market">
          <h4>{marketLabel('winner')}</h4>
          <div className="bet-opts">
            <Option scrim={scrim} market="winner" selection="A" label="1팀 승리" />
            <Option scrim={scrim} market="winner" selection="B" label="2팀 승리" />
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
            티어가 낮을수록 배당이 조금 높습니다 (한 티어당 2%). 마감 때 사람별 배당이
            공개됩니다.
          </p>
          <div className="bet-opts bet-opts-grid">
            {roster.map((id) => (
              <Option
                key={id}
                scrim={scrim}
                market="first_blood"
                selection={String(id)}
                label={nameOf.get(id) || '?'}
              />
            ))}
          </div>
          <p className="rooms-hint">한 번에 {num(capOf('first_blood'))} 끼꼬까지.</p>
        </div>

        {[killLineOfScrim(scrim)].map((line) => {
          const market = killMarket(line);
          return (
            <div className="bet-market" key={market}>
              <h4>
                총 킬 <strong className="bet-line">{line}</strong>
                <em>고정 1.98배</em>
              </h4>
              <div className="bet-opts">
                <Option
                  scrim={scrim}
                  market={market}
                  selection="over"
                  label={`오버 · ${line} 초과`}
                />
                <Option
                  scrim={scrim}
                  market={market}
                  selection="under"
                  label={`언더 · ${line} 미만`}
                />
              </div>
              <p className="rooms-hint">둘 중 하나만 고를 수 있어요.</p>
            </div>
          );
        })}
      </>
    );
  };

  const MyBets = ({ scrim }) => {
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
                  {b.market === 'first_blood'
                    ? nameOf.get(Number(b.selection)) || '?'
                    : b.selection === 'A'
                      ? '1팀'
                      : b.selection === 'B'
                        ? '2팀'
                        : b.selection === 'over'
                          ? '오버'
                          : '언더'}
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
            </li>
          ))}
        </ul>
      </div>
    );
  };

  /* 선택지별로 흩어져 있는 걸 사람 단위로 다시 모은다.
     '내가 이번 판에 결국 얼마 잃었나'는 그렇게 봐야 나온다 */
  const PlayerTotals = ({ scrim }) => {
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
          {list.map((r) => (
            <li key={r.userId} className={r.net > 0 ? 'is-plus' : r.net < 0 ? 'is-minus' : ''}>
              <span className="bet-total-name">{memberName.get(r.userId) || '알 수 없음'}</span>
              <span className="bet-total-detail">
                {r.count}건 · {num(r.staked)} 걸어 {num(r.payout)} 회수
              </span>
              <span className={`kkiko-delta ${r.net >= 0 ? 'plus' : 'minus'}`}>
                {r.net > 0 ? `+${num(r.net)}` : num(r.net)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="room-settings">
      {!activeScrim ? (
        <p className="rooms-blank">
          지금 열린 또또가 없어요.
          <br />
          기록 탭에서 팀을 채우고 &lsquo;또또 열기&rsquo;를 누르면 여기에 올라옵니다.
        </p>
      ) : (
        <section className="room-panel">
          <h3>
            {activeScrim.mode === 'aram' ? '칼바람' : '일반'} 내전
            <span className={`bet-status s-${activeScrim.status}`}>
              {activeScrim.status === 'betting' ? '배팅 중' : '배팅 마감 · 경기 진행 중'}
            </span>
          </h3>

          <div className="bet-teams">
            <Team ids={activeScrim.team_a || []} label="1팀" />
            <Team ids={activeScrim.team_b || []} label="2팀" />
          </div>

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

          {activeScrim.status === 'betting' && activeScrim.betting_closes_at && (
            <BetTimer
              closesAt={activeScrim.betting_closes_at}
              openedAt={activeScrim.played_at}
              onExpire={() => autoLock(activeScrim.id)}
            />
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

          {(activeScrim.status !== 'betting' || me?.agreed) && <Markets scrim={activeScrim} />}

          <MyBets scrim={activeScrim} />

          {activeScrim.status === 'betting' && cartRows.length > 0 && (
            <div className="bet-cart">
              <h4>담은 배팅 {cartRows.length}건</h4>
              {cartRows.map(([market, v]) => (
                <div className="rooms-form-row" key={market}>
                  <span className="rooms-name">{marketLabel(market)}</span>
                  <input
                    className="rooms-input"
                    type="number"
                    min="1"
                    max={capOf(market) || undefined}
                    value={v.amount}
                    placeholder="끼꼬"
                    onChange={(e) => setAmount(market, e.target.value)}
                  />
                </div>
              ))}
              <div className={`bet-cart-foot ${overBalance ? 'is-over' : ''}`}>
                <span>
                  총 <strong>{num(cartTotal)}</strong> 끼꼬 · 잔액 {num(me?.points)}
                </span>
                <button
                  className="ghost-btn"
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
                담은 것들은 각각 따로 걸립니다. 배당을 곱하는 조합이 아닙니다.
              </p>
            </div>
          )}

          {canEdit && activeScrim.status === 'betting' && (
            <button className="ghost-btn bet-action" onClick={() => lock(activeScrim)}>
              <FaLock /> 게임 시작 (배팅 마감)
            </button>
          )}

          {canEdit && activeScrim.status === 'locked' && (
            <div className="bet-result">
              <h4>경기 결과 넣기</h4>
              <div className="seg-tabs">
                <button
                  className={`seg-tab ${winner === 'A' ? 'active' : ''}`}
                  onClick={() => setWinner('A')}
                >
                  1팀 승리
                </button>
                <button
                  className={`seg-tab ${winner === 'B' ? 'active' : ''}`}
                  onClick={() => setWinner('B')}
                >
                  2팀 승리
                </button>
              </div>
              <div className="rooms-form-row">
                <input
                  className="rooms-input"
                  type="number"
                  min="0"
                  value={kills}
                  placeholder="총 킬 수"
                  onChange={(e) => setKills(e.target.value)}
                />
                <select
                  className="rooms-input"
                  value={fb}
                  onChange={(e) => setFb(e.target.value)}
                  aria-label="퍼스트 블러드"
                >
                  <option value="">퍼스트 블러드</option>
                  {[...(activeScrim.team_a || []), ...(activeScrim.team_b || [])].map((id) => (
                    <option key={id} value={id}>
                      {nameOf.get(id) || '?'}
                    </option>
                  ))}
                </select>
                <button className="ghost-btn" onClick={() => settle(activeScrim)}>
                  정산
                </button>
              </div>
              <p className="rooms-hint">
                비워둔 항목은 그 마켓 전체를 환불합니다. 적중한 쪽에 아무도 안 걸었을 때도
                환불입니다.
              </p>
            </div>
          )}
        </section>
      )}

      {history.map((s) => (
        <section className="room-panel" key={s.id}>
          <h3>
            {s.winner === 'A' ? '1팀' : '2팀'} 승리
            <span className="bet-status s-settled">
              {new Date(s.played_at).toLocaleDateString('ko-KR')}
            </span>
          </h3>
          <div className="bet-teams">
            <Team ids={s.team_a || []} label="1팀" hot={s.winner === 'A'} />
            <Team ids={s.team_b || []} label="2팀" hot={s.winner === 'B'} />
          </div>
          <p className="rooms-hint">
            총 킬 {s.total_kills ?? '-'} · 퍼블{' '}
            {s.first_blood_player_id ? nameOf.get(s.first_blood_player_id) || '?' : '-'} · 또또{' '}
            {num(s.bet_total)} 끼꼬
            {s.undo_count > 0 && ` · 정산 ${s.undo_count}번 되돌림`}
          </p>
          {/* 배팅할 때와 같은 화면을 그대로 다시 보여준다. 적중한 칸은 초록,
              각 칸 아래에 누가 걸어서 얼마를 벌고 잃었는지 붙는다 */}
          <Markets scrim={s} />
          <PlayerTotals scrim={s} />
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
