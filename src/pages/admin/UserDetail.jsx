import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUserDetail } from '../../server/admin';
import { marketLabel } from '../../server/rooms';
import Modal from '../../components/common/Modal';
import { SkelRows } from '../../components/common/Skeleton';

const num = (n) => Number(n || 0).toLocaleString();

const when = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

const REASON = {
  transfer_in: '받음',
  transfer_out: '보냄',
  scrim: '내전 참여',
  bet: '배팅',
  payout: '적중',
  refund: '환불',
  adjust: '방장 조정',
  undo: '되돌림',
};

/* 배팅 한 줄이 무엇에 건 것인지. 선택지는 마켓마다 뜻이 다르다 */
const pickLabel = (b) => {
  if (b.market === 'winner') return b.selection === 'A' ? '1팀' : '2팀';
  if (b.market === 'first_blood') return '지목';
  return b.selection === 'over' ? '오버' : '언더';
};

/* "내 끼꼬 왜 줄었어요?" 에 답하는 화면.
   합계로는 알 수 없고 줄을 봐야 한다 */
const UserDetail = ({ userId, name, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchUserDetail(userId).then(
      (d) => alive && setData(d),
      (e) => alive && setError(e.message)
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <Modal title={name || '이름 없음'} desc={userId} onClose={onClose}>
      {error && <p className="rooms-blank">{error}</p>}

      {!data && !error && <SkelRows count={5} h={38} />}

      {data && (
        <div className="adm-detail">
          <section>
            <h4>
              방<span className="panel-count">{data.rooms.length}</span>
            </h4>
            {data.rooms.length === 0 ? (
              <p className="rooms-hint">들어간 방이 없습니다.</p>
            ) : (
              <ul className="adm-checklist">
                {data.rooms.map((r) => (
                  <li key={r.id}>
                    <Link className="adm-name" to={`/rooms/${r.id}`} onClick={onClose}>
                      <span className="adm-emblem">{r.emblem}</span>
                      {r.name}
                    </Link>
                    <span className={`rooms-role role-${r.role}`}>
                      {r.role === 'owner' ? '방장' : r.role === 'admin' ? '부방장' : '멤버'}
                    </span>
                    {r.is_ghost && <span className="dim">유령</span>}
                    <span className="adm-amount">{num(r.points)} 끼꼬</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4>
              끼꼬 내역<span className="panel-count">최근 {data.ledger.length}</span>
            </h4>
            {data.ledger.length === 0 ? (
              <p className="rooms-hint">움직인 내역이 없습니다.</p>
            ) : (
              <ul className="kkiko-ledger">
                {data.ledger.map((l) => (
                  <li key={l.id} className={l.reversed_at ? 'is-reversed' : ''}>
                    <span className="kkiko-when">{when(l.created_at)}</span>
                    <span className="rooms-name">
                      {REASON[l.reason] || l.reason}
                      {l.counterpart_name && <em> · {l.counterpart_name}</em>}
                      {l.room_name && <em> · {l.room_name}</em>}
                    </span>
                    <span className={`kkiko-delta ${l.delta >= 0 ? 'plus' : 'minus'}`}>
                      {l.delta >= 0 ? '+' : ''}
                      {num(l.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="rooms-hint">
              흐리게 표시된 줄은 되돌려진 것입니다. 취소분이 따로 한 줄 더 있어 합계는 맞습니다.
            </p>
          </section>

          <section>
            <h4>
              또또<span className="panel-count">최근 {data.bets.length}</span>
            </h4>
            {data.bets.length === 0 ? (
              <p className="rooms-hint">건 적이 없습니다.</p>
            ) : (
              <ul className="kkiko-ledger">
                {data.bets.map((b) => (
                  <li key={b.id}>
                    <span className="kkiko-when">{when(b.created_at)}</span>
                    <span className="rooms-name">
                      {marketLabel(b.market)}
                      <em> · {pickLabel(b)}</em>
                      {b.room_name && <em> · {b.room_name}</em>}
                    </span>
                    <span className="dim">{num(b.amount)}</span>
                    {b.payout === null ? (
                      <span className="dim">진행 중</span>
                    ) : (
                      <span className={`kkiko-delta ${b.payout > 0 ? 'plus' : 'minus'}`}>
                        {b.payout > 0 ? `+${num(b.payout - b.amount)}` : `-${num(b.amount)}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
};

export default UserDetail;
