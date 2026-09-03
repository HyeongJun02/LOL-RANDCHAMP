import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaPaperPlane } from 'react-icons/fa';
import { transferPoints, fetchLedger } from '../../rooms';

const MEDALS = ['🥇', '🥈', '🥉'];

/* 무엇 때문에 끼꼬가 움직였는지. 배팅/정산은 5단계에서 붙는다 */
const REASON = {
  transfer_in: '받음',
  transfer_out: '보냄',
  scrim: '내전 참여',
  bet: '배팅',
  payout: '적중',
  refund: '환불',
};

const when = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

/* 방의 '끼꼬' 탭. 순위는 방 안에서만 본다 - 전역 순위는 없다.
   members는 useRoom이 프로필을 붙여준 목록이다 */
const KkikoTab = ({ roomId, members, myId, onChanged }) => {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [ledger, setLedger] = useState([]);
  const busy = useRef(false);

  const nameOf = new Map(members.map((m) => [m.user_id, m.nickname]));
  const me = members.find((m) => m.user_id === myId);
  const ranked = [...members].sort((a, b) => b.points - a.points);
  const others = members.filter((m) => m.user_id !== myId);

  const loadLedger = useCallback(() => {
    fetchLedger()
      .then(setLedger)
      .catch(() => setLedger([]));
  }, []);

  useEffect(loadLedger, [loadLedger]);

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
    if (!window.confirm(`${nameOf.get(to)} 님에게 ${value.toLocaleString()} 끼꼬를 보낼까요?`))
      return;

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

  return (
    <div className="room-settings">
      <section className="room-panel">
        <h3>
          끼꼬 순위<span className="panel-count">{members.length}명</span>
        </h3>
        <ul className="room-members">
          {ranked.map((m, i) => (
            <li key={m.user_id}>
              <span className="kkiko-rank">{MEDALS[i] || i + 1}</span>
              <span className="rooms-name">
                {m.nickname}
                {m.user_id === myId && <em> (나)</em>}
              </span>
              <span className="room-member-points">{m.points.toLocaleString()} 끼꼬</span>
            </li>
          ))}
        </ul>
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

      <section className="room-panel">
        <h3>
          내 끼꼬 내역<span className="panel-count">{ledger.length}건</span>
        </h3>
        {ledger.length === 0 ? (
          <p className="rooms-hint">아직 움직인 내역이 없어요.</p>
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
      </section>
    </div>
  );
};

export default KkikoTab;
