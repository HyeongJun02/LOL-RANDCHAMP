import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaPaperPlane, FaSlidersH, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { transferPoints, adjustPoints, fetchLedger, LEDGER_PAGE } from '../../rooms';
import { useDialog } from '../../components/common/Dialog';
import RankList from '../../components/common/RankList';

/* 무엇 때문에 끼꼬가 움직였는지. 배팅/정산은 5단계에서 붙는다 */
/* 자주 쓰는 금액. 폰에서 0을 네 번 치는 게 은근히 번거롭다 */
const num = (n) => Number(n || 0).toLocaleString();

/* 자주 쓰는 금액. 폰에서 0을 네 번 치는 게 은근히 번거롭다 */
const QUICK = [100, 500, 1000];

const REASON = {
  transfer_in: '받음',
  transfer_out: '보냄',
  scrim: '내전 참여',
  bet: '배팅',
  payout: '적중',
  refund: '환불',
  adjust: '방장 조정',
};

const when = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

/* 방의 '끼꼬' 탭. 순위는 방 안에서만 본다 - 전역 순위는 없다.
   members는 useRoom이 프로필을 붙여준 목록이다 */
const KkikoTab = ({ roomId, members, myId, isOwner, onChanged }) => {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [ledger, setLedger] = useState([]);
  /* 로그 탭과 같은 방식. cursors[i] = i쪽을 받을 때 쓴 beforeId */
  const [cursors, setCursors] = useState([undefined]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [adjTo, setAdjTo] = useState('');
  const [adjSign, setAdjSign] = useState(1);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const busy = useRef(false);

  const nameOf = new Map(members.map((m) => [m.user_id, m.nickname]));
  const { confirm } = useDialog();
  const me = members.find((m) => m.user_id === myId);
  const ranked = [...members].sort((a, b) => b.points - a.points);
  const top = ranked[0]?.points || 0;
  const others = members.filter((m) => m.user_id !== myId);

  const loadPage = useCallback(async (at, list) => {
    try {
      const rows = (await fetchLedger(list[at])) || [];
      setLedger(rows);
      setHasNext(rows.length === LEDGER_PAGE);
    } catch {
      setLedger([]);
      setHasNext(false);
    }
  }, []);

  /* 뭔가 오갔으면 첫 쪽부터 다시 본다. 방금 한 일이 맨 위에 있어야 한다 */
  const loadLedger = useCallback(() => {
    setPage(0);
    setCursors([undefined]);
    loadPage(0, [undefined]);
  }, [loadPage]);

  useEffect(loadLedger, [loadLedger]);

  const nextPage = () => {
    const last = ledger[ledger.length - 1];
    if (!last) return;
    const list = [...cursors];
    list[page + 1] = last.id;
    setCursors(list);
    setPage(page + 1);
    loadPage(page + 1, list);
  };

  const prevPage = () => {
    if (page === 0) return;
    setPage(page - 1);
    loadPage(page - 1, cursors);
  };

  /* 무엇이 무엇인지 미리 보여준다. 고르고 적는 칸만 나란히 있으면
     '누구에게 얼마를' 이 확인창을 띄워야만 보인다 */
  const sendTarget = members.find((m) => m.user_id === to);
  const sendValue = Math.floor(Number(amount)) || 0;
  const myPoints = me?.points ?? 0;
  const sendLeft = myPoints - sendValue;
  const sendReady = Boolean(sendTarget) && sendValue > 0 && sendLeft >= 0;

  const send = async () => {
    if (busy.current) return;
    const value = Number(amount);
    if (!to) {
      toast.error('받을 사람을 골라주세요.');
      return;
    }
    if (!Number.isInteger(value) || value <= 0) {
      toast.error('보낼 끼꼬를 1 이상의 숫자로 적어주세요.');
      return;
    }
    const ok = await confirm({
      title: '끼꼬 보내기',
      message: `${nameOf.get(to)} 님에게 ${value.toLocaleString()} 끼꼬를 보낼까요?`,
      detail: '보낸 끼꼬는 되돌릴 수 없어요.',
      confirmText: '보내기',
    });
    if (!ok) return;

    busy.current = true;
    try {
      await transferPoints(roomId, to, value);
      setAmount('');
      toast.success('보냈어요.');
      loadLedger();
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      busy.current = false;
    }
  };

  /* 방장만. 부호를 손으로 치게 하면(-1000) 빼먹고 반대로 준다.
     방향은 버튼으로 고르고, 칸에는 숫자만 넣는다 */
  const adjTarget = members.find((m) => m.user_id === adjTo);
  const adjValue = Math.floor(Number(adjAmount)) || 0;
  const adjDelta = adjValue * adjSign;
  const adjAfter = adjTarget ? Math.max(0, adjTarget.points + adjDelta) : null;
  const adjReady = Boolean(adjTarget) && adjValue > 0;

  const adjust = async () => {
    if (busy.current) return;
    if (!adjTarget) {
      toast.error('조정할 사람을 골라주세요.');
      return;
    }
    if (adjValue <= 0) {
      toast.error('조정할 끼꼬를 1 이상의 숫자로 적어주세요.');
      return;
    }
    const ok = await confirm({
      title: '끼꼬 조정',
      message: `${adjTarget.nickname} 님의 끼꼬를 ${adjTarget.points.toLocaleString()} → ${adjAfter.toLocaleString()} 로 바꿀까요?`,
      detail: '누가 누구의 끼꼬를 얼마나 왜 만졌는지 로그에 남고, 방 사람 모두가 봅니다.',
      confirmText: adjSign > 0 ? '올리기' : '내리기',
      danger: true,
    });
    if (!ok) return;

    busy.current = true;
    try {
      await adjustPoints(roomId, adjTo, adjDelta, adjReason);
      setAdjAmount('');
      setAdjReason('');
      toast.success('조정했어요. 로그에 남았습니다.');
      loadLedger();
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="room-settings">
      <section className="room-panel">
        <h3>
          끼꼬 순위<span className="panel-count">{members.length}명</span>
        </h3>
        <RankList
          empty="아직 아무도 없어요."
          rows={ranked.map((m) => ({
            key: m.user_id,
            name: m.nickname,
            me: m.user_id === myId,
            value: (
              <>
                {m.points.toLocaleString()}
                <i className="rank-unit">끼꼬</i>
              </>
            ),
            /* 막대는 1위 대비. 얼마나 벌어졌는지가 한눈에 보인다 */
            ratio: top > 0 ? m.points / top : 0,
          }))}
        />
        <p className="rooms-hint">매월 1일 모두 10,000 끼꼬로 돌아갑니다. 지난 달 성적은 전당에 남습니다.</p>
      </section>

      <section className="room-panel">
        <h3>
          <FaPaperPlane /> 끼꼬 보내기
        </h3>
        {others.length === 0 ? (
          <p className="rooms-hint">아직 이 방에 다른 사람이 없어요.</p>
        ) : (
          <div className="kf">
            <label className="kf-row">
              <span className="kf-label">받는 사람</span>
              <select className="rooms-input" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">고르기</option>
                {others.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.nickname}
                  </option>
                ))}
              </select>
            </label>

            <label className="kf-row">
              <span className="kf-label">보낼 끼꼬</span>
              <input
                className="rooms-input"
                type="number"
                min="1"
                value={amount}
                placeholder="0"
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
            </label>

            <div className="bet-chips kf-chips">
              {QUICK.map((n) => (
                <button
                  key={n}
                  className="bet-chip"
                  onClick={() => setAmount(String(Math.min(myPoints, sendValue + n)))}
                >
                  +{n}
                </button>
              ))}
              <button className="bet-chip" onClick={() => setAmount(String(myPoints))}>
                전액
              </button>
              <button
                className="bet-chip is-clear"
                onClick={() => setAmount('')}
                disabled={!amount}
              >
                지우기
              </button>
            </div>

            {/* 누르기 전에 무슨 일이 일어나는지 한 줄로 */}
            <div className={`kf-preview ${sendLeft < 0 ? 'is-over' : ''}`}>
              {sendReady ? (
                <p>
                  <b>{sendTarget.nickname}</b> 님에게 <b>{num(sendValue)}</b> 끼꼬 · 보내고 나면 내
                  잔액 <b>{num(sendLeft)}</b>
                </p>
              ) : sendLeft < 0 ? (
                <p>잔액보다 {num(-sendLeft)} 끼꼬 더 보내려 하고 있어요.</p>
              ) : (
                <p>받는 사람과 금액을 고르면 여기에 요약이 뜹니다. (내 잔액 {num(myPoints)})</p>
              )}
              <button className="ghost-btn" onClick={send} disabled={!sendReady}>
                보내기
              </button>
            </div>
          </div>
        )}
      </section>

      {isOwner && (
        <section className="room-panel">
          <h3>
            <FaSlidersH /> 끼꼬 조정
          </h3>
          <p className="rooms-hint">
            정산이 꼬였거나 벌칙·상을 줄 때 방장이 직접 올리고 내립니다.{' '}
            <b>조정한 내역은 예외 없이 로그 탭에 남습니다.</b>
          </p>

          <div className="kf">
            <label className="kf-row">
              <span className="kf-label">대상</span>
              <select
                className="rooms-input"
                value={adjTo}
                onChange={(e) => setAdjTo(e.target.value)}
              >
                <option value="">고르기</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.nickname} ({num(m.points)})
                  </option>
                ))}
              </select>
            </label>

            <div className="kf-row">
              <span className="kf-label">방향</span>
              {/* 부호를 손으로 치게 하면(-1000) 빼먹고 반대로 준다 */}
              <div className="seg-tabs kf-sign">
                <button
                  className={`seg-tab ${adjSign > 0 ? 'active' : ''}`}
                  onClick={() => setAdjSign(1)}
                >
                  올리기
                </button>
                <button
                  className={`seg-tab ${adjSign < 0 ? 'active' : ''}`}
                  onClick={() => setAdjSign(-1)}
                >
                  내리기
                </button>
              </div>
            </div>

            <label className="kf-row">
              <span className="kf-label">얼마나</span>
              <input
                className="rooms-input"
                type="number"
                min="1"
                value={adjAmount}
                placeholder="0"
                onChange={(e) => setAdjAmount(e.target.value)}
              />
            </label>

            <div className="bet-chips kf-chips">
              {QUICK.map((n) => (
                <button
                  key={n}
                  className="bet-chip"
                  onClick={() => setAdjAmount(String(adjValue + n))}
                >
                  +{n}
                </button>
              ))}
              <button
                className="bet-chip is-clear"
                onClick={() => setAdjAmount('')}
                disabled={!adjAmount}
              >
                지우기
              </button>
            </div>

            <label className="kf-row">
              <span className="kf-label">사유</span>
              <input
                className="rooms-input"
                value={adjReason}
                maxLength={20}
                placeholder="로그에 같이 남습니다"
                onChange={(e) => setAdjReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adjust()}
              />
            </label>

            {/* 조정은 '결과 잔액'이 제일 중요하다. 얼마가 되는지를 보여준다 */}
            <div className="kf-preview">
              {adjReady ? (
                <p>
                  <b>{adjTarget.nickname}</b> {num(adjTarget.points)}
                  <i className="kf-arrow">→</i>
                  <b className={adjSign > 0 ? 'is-plus' : 'is-minus'}>{num(adjAfter)}</b>
                  <em>
                    ({adjSign > 0 ? '+' : '-'}
                    {num(adjValue)})
                  </em>
                </p>
              ) : (
                <p>대상과 금액을 고르면 바뀌는 잔액이 여기에 뜹니다.</p>
              )}
              <button className="ghost-btn" onClick={adjust} disabled={!adjReady}>
                {adjSign > 0 ? '올리기' : '내리기'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="room-panel">
        <h3>
          내 끼꼬 내역
          {page > 0 && <span className="panel-count">{page + 1}쪽</span>}
        </h3>
        {ledger.length === 0 ? (
          <p className="rooms-hint">
            {page === 0 ? '아직 움직인 내역이 없어요.' : '더 볼 내역이 없어요.'}
          </p>
        ) : (
          <ul className="kkiko-ledger">
            {ledger.map((l) => (
              <li key={l.id}>
                <span className="kkiko-when">{when(l.created_at)}</span>
                <span className="rooms-name">
                  {REASON[l.reason] || l.reason}
                  {l.counterpart_user_id && (
                    <em> · {nameOf.get(l.counterpart_user_id) || '알 수 없음'}</em>
                  )}
                </span>
                <span className={`kkiko-delta ${l.delta >= 0 ? 'plus' : 'minus'}`}>
                  {l.delta >= 0 ? '+' : ''}
                  {l.delta.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(page > 0 || hasNext) && (
          <div className="feed-pager">
            <button className="ghost-btn" onClick={prevPage} disabled={page === 0}>
              <FaChevronLeft /> 이전
            </button>
            <span className="feed-page-no">{page + 1}쪽</span>
            <button className="ghost-btn" onClick={nextPage} disabled={!hasNext}>
              다음 <FaChevronRight />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default KkikoTab;
