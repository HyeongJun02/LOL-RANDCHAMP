import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaLock, FaCheck, FaUndo } from 'react-icons/fa';
import {
  KILL_LINES,
  killMarket,
  marketLabel,
  capOf,
  agreeFairplay,
  placeBets,
  lockBetting,
  settleScrim,
  unsettleScrim,
  fetchBetting,
} from '../../rooms';

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
      if (!window.confirm('배팅을 마감할까요? 마감하면 아무도 더 걸 수 없고 배당이 공개됩니다.'))
        return;
      await lockBetting(scrim.id);
      toast.success('배팅을 마감했어요.');
      onChanged();
      load();
    });

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
      if (!window.confirm('정산을 되돌릴까요? 지급이 전부 취소되고, 되돌린 사실이 피드에 남습니다.'))
        return;
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

  const Option = ({ scrim, market, selection, label }) => {
    const p = poolOf(scrim.id, market, selection);
    const mine = myBets(scrim.id).find((b) => b.market === market);
    const taken = Boolean(mine);
    const picked = cart[market]?.selection === selection;
    const open = scrim.status === 'betting';

    return (
      <button
        type="button"
        className={`bet-opt ${picked ? 'picked' : ''} ${
          mine?.selection === selection ? 'mine' : ''
        }`}
        disabled={!open || taken}
        onClick={() => pick(market, selection)}
      >
        <span className="bet-opt-label">{label}</span>
        {p?.odds != null && <em className="bet-odds">{Number(p.odds).toFixed(2)}배</em>}
      </button>
    );
  };

  const Markets = ({ scrim }) => {
    const roster = [...(scrim.team_a || []), ...(scrim.team_b || [])];
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
            <em>고정 {(roster.length * 0.85).toFixed(2)}배</em>
          </h4>
          <div className="bet-opts">
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

        {KILL_LINES.map((line) => {
          const market = killMarket(line);
          return (
            <div className="bet-market" key={market}>
              <h4>
                {marketLabel(market)}
                <em>고정 1.98배</em>
              </h4>
              <div className="bet-opts">
                <Option scrim={scrim} market={market} selection="over" label={`오버 (${line} 초과)`} />
                <Option
                  scrim={scrim}
                  market={market}
                  selection="under"
                  label={`언더 (${line} 미만)`}
                />
              </div>
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
              {b.payout != null && (
                <span className={`kkiko-delta ${b.payout > 0 ? 'plus' : 'minus'}`}>
                  {b.payout > 0 ? `+${num(b.payout)}` : `-${num(b.amount)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const Results = ({ scrim }) => {
    const rows = bets.filter((b) => b.scrim_id === scrim.id);
    if (rows.length === 0) return null;
    return (
      <ul className="bet-list">
        {rows.map((b) => (
          <li key={b.id}>
            <span className="rooms-name">{memberName.get(b.user_id) || '알 수 없음'}</span>
            <span className="kkiko-when">
              {marketLabel(b.market)} · {num(b.amount)}
            </span>
            <span className={`kkiko-delta ${b.payout > 0 ? 'plus' : 'minus'}`}>
              {b.payout > 0 ? `+${num(b.payout - b.amount)}` : `-${num(b.amount)}`}
            </span>
          </li>
        ))}
      </ul>
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

          <p className="rooms-hint">
            {activeScrim.bet_count}명 참여 · 총 {num(activeScrim.bet_total)} 끼꼬
            {activeScrim.status === 'betting'
              ? ' · 배당은 마감 때 공개됩니다'
              : ' · 배당이 확정됐습니다'}
          </p>

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
              <div className="bet-cart-foot">
                <span>
                  총 <strong>{num(cartTotal)}</strong> 끼꼬 · 잔액 {num(me?.points)}
                </span>
                <button className="ghost-btn" onClick={() => submit(activeScrim)}>
                  배팅 완료
                </button>
              </div>
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
          <Results scrim={s} />
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
