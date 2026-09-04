import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaPaperPlane, FaSlidersH, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { transferPoints, adjustPoints, fetchLedger, LEDGER_PAGE } from '../../rooms';
import { useDialog } from '../../components/common/Dialog';
import RankList from '../../components/common/RankList';

/* 무엇 때문에 끼꼬가 움직였는지. 배팅/정산은 5단계에서 붙는다 */
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

  /* 방장만. 더하기도 빼기도 같은 칸에서 한다 (음수를 적으면 뺀다) */
  const adjust = async () => {
    if (busy.current) return;
    const value = Number(adjAmount);
    if (!adjTo) {
      toast.error('조정할 사람을 골라주세요.');
      return;
    }
    if (!Number.isInteger(value) || value === 0) {
      toast.error('더하거나 뺄 끼꼬를 숫자로 적어주세요. (빼려면 -1000처럼)');
      return;
    }
    const ok = await confirm({
      title: '끼꼬 조정',
      message: `${nameOf.get(adjTo)} 님의 끼꼬를 ${value > 0 ? '+' : ''}${value.toLocaleString()} 할까요?`,
      detail: '누가 누구의 끼꼬를 얼마나 왜 만졌는지 로그에 남고, 방 사람 모두가 봅니다.',
      confirmText: '조정',
      danger: true,
    });
    if (!ok) return;

    busy.current = true;
    try {
      await adjustPoints(roomId, adjTo, value, adjReason);
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
        <p className="rooms-hint">
          내 잔액 <strong>{(me?.points ?? 0).toLocaleString()}</strong> 끼꼬. 같은 방 멤버에게만
          보낼 수 있어요.
        </p>
        {others.length === 0 ? (
          <p className="rooms-hint">아직 이 방에 다른 사람이 없어요.</p>
        ) : (
          <div className="rooms-form-row" style={{ marginTop: '0.6rem' }}>
            <select
              className="rooms-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="받을 사람"
            >
              <option value="">받을 사람</option>
              {others.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nickname}
                </option>
              ))}
            </select>
            <input
              className="rooms-input"
              type="number"
              min="1"
              value={amount}
              placeholder="끼꼬"
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="ghost-btn" onClick={send}>
              보내기
            </button>
          </div>
        )}
      </section>

      {isOwner && (
        <section className="room-panel">
          <h3>
            <FaSlidersH /> 끼꼬 조정
          </h3>
          <p className="rooms-hint">
            정산이 꼬였거나 벌칙·상을 줄 때 방장이 직접 더하고 뺍니다. 빼려면{' '}
            <b>-1000</b>처럼 적으세요. <b>조정한 내역은 예외 없이 로그 탭에 남습니다.</b>
          </p>
          <div className="rooms-form-row" style={{ marginTop: '0.6rem' }}>
            <select
              className="rooms-input"
              value={adjTo}
              onChange={(e) => setAdjTo(e.target.value)}
              aria-label="조정할 사람"
            >
              <option value="">조정할 사람</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nickname}
                </option>
              ))}
            </select>
            <input
              className="rooms-input"
              type="number"
              value={adjAmount}
              placeholder="+1000 / -1000"
              onChange={(e) => setAdjAmount(e.target.value)}
            />
          </div>
          <div className="rooms-form-row" style={{ marginTop: '0.4rem' }}>
            <input
              className="rooms-input"
              value={adjReason}
              maxLength={20}
              placeholder="사유 (로그에 같이 남습니다)"
              onChange={(e) => setAdjReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adjust()}
            />
            <button className="ghost-btn" onClick={adjust}>
              조정
            </button>
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
