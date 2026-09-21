import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaBan, FaCheckCircle, FaExclamationTriangle, FaSyncAlt } from 'react-icons/fa';
import { fetchStuckScrims, adminCancelScrim, fetchWalletAudit } from '../../server/admin';
import { useDialog } from '../../components/common/Dialog';
import { SkelRows } from '../../components/common/Skeleton';

const num = (n) => Number(n || 0).toLocaleString();

const ago = (iso) => {
  if (!iso) return '-';
  const h = Math.floor((Date.now() - new Date(iso)) / 3600000);
  if (h < 1) return '방금';
  if (h < 24) return `${h}시간째`;
  return `${Math.floor(h / 24)}일째`;
};

/* 관리자 '점검' 탭.

   평소에는 아무것도 없어야 정상인 화면이다. 뭔가 떠 있으면 손볼 게 있다는 뜻. */
const CheckTab = ({ onChanged }) => {
  const { confirm } = useDialog();
  const [stuck, setStuck] = useState(null);
  const [audit, setAudit] = useState(null);
  const [auditing, setAuditing] = useState(false);

  const loadStuck = useCallback(async () => {
    try {
      setStuck((await fetchStuckScrims()) || []);
    } catch (e) {
      toast.error(e.message);
      setStuck([]);
    }
  }, []);

  useEffect(() => {
    loadStuck();
  }, [loadStuck]);

  /* 전 지갑을 훑는 일이라 화면에 들어올 때마다 돌리지 않는다.
     누를 때만 돈다 */
  const runAudit = async () => {
    setAuditing(true);
    try {
      setAudit((await fetchWalletAudit()) || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAuditing(false);
    }
  };

  const cancel = async (s) => {
    const ok = await confirm({
      title: '또또 강제 취소',
      message: `'${s.room_name}' 방의 멈춘 판을 없던 걸로 할까요?`,
      detail: `${num(s.bet_count)}명이 건 ${num(s.bet_total)} 끼꼬가 전부 돌아갑니다. 경기 기록도 지워지고, 방 로그에 관리자가 취소했다고 남습니다.`,
      confirmText: '취소하기',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminCancelScrim(s.id);
      toast.success('취소하고 끼꼬를 돌려줬어요.');
      loadStuck();
      onChanged();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="room-settings">
      <section className="room-panel">
        <h3>
          <FaExclamationTriangle /> 멈춘 또또
          {stuck && <span className="panel-count">{stuck.length}건</span>}
        </h3>
        <p className="rooms-hint">
          결과가 아직 안 들어온 판입니다. 방장이 안 돌아오면 걸린 끼꼬가 계속 묶여 있습니다.
          관리자는 환불만 할 수 있고, 결과를 대신 넣지는 않습니다 — 그 게임을 안 봤으니까요.
        </p>

        {stuck === null ? (
          <SkelRows count={2} h={44} />
        ) : stuck.length === 0 ? (
          <p className="adm-ok">
            <FaCheckCircle /> 멈춘 판이 없습니다.
          </p>
        ) : (
          <ul className="adm-checklist">
            {stuck.map((s) => (
              <li key={s.id}>
                <span className={`bet-status s-${s.status}`}>
                  {s.status === 'betting' ? '배팅 중' : '마감됨'}
                </span>
                <Link className="adm-name" to={`/rooms/${s.room_id}`}>
                  {s.room_name}
                </Link>
                <span className="dim">방장 {s.owner_name}</span>
                <span className="dim">{ago(s.played_at)}</span>
                <span className="adm-amount">
                  {num(s.bet_count)}명 · {num(s.bet_total)} 끼꼬
                </span>
                <button className="adm-btn danger" onClick={() => cancel(s)}>
                  <FaBan /> 강제 취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="room-panel">
        <h3>
          <FaSyncAlt /> 끼꼬 정합성
          {audit && <span className="panel-count">{audit.length}건</span>}
        </h3>
        <p className="rooms-hint">
          지갑에 든 끼꼬가 원장의 합과 같아야 합니다. 어긋났다면 정산 어딘가에서 끼꼬가
          사라졌거나 새로 생긴 것입니다. 기준은 마지막 시즌 초기화 시각입니다.
        </p>

        <button className="ghost-btn adm-action" onClick={runAudit} disabled={auditing}>
          <FaSyncAlt /> {auditing ? '대조하는 중…' : '전체 대조'}
        </button>

        {audit !== null &&
          (audit.length === 0 ? (
            <p className="adm-ok">
              <FaCheckCircle /> 모든 지갑이 원장과 맞습니다.
            </p>
          ) : (
            <>
              <p className="adm-bad">
                <FaExclamationTriangle /> {audit.length}개 지갑이 어긋났습니다. 아래 방의 최근
                정산을 확인해 주세요.
              </p>
              <div className="adm-tablewrap" style={{ marginTop: '0.6rem' }}>
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>
                        <span className="adm-th">방</span>
                      </th>
                      <th>
                        <span className="adm-th">사용자</span>
                      </th>
                      <th className="num">
                        <span className="adm-th">지갑</span>
                      </th>
                      <th className="num">
                        <span className="adm-th">원장 기준</span>
                      </th>
                      <th className="num">
                        <span className="adm-th">차이</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((r) => (
                      <tr key={`${r.room_id}-${r.user_id}`}>
                        <td>
                          <Link className="adm-name" to={`/rooms/${r.room_id}`}>
                            {r.room_name}
                          </Link>
                        </td>
                        <td>{r.nickname}</td>
                        <td className="num">{num(r.actual)}</td>
                        <td className="num dim">{num(r.expected)}</td>
                        <td className={`num ${r.diff > 0 ? 'plus' : 'minus'}`}>
                          {r.diff > 0 ? '+' : ''}
                          {num(r.diff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ))}
      </section>
    </div>
  );
};

export default CheckTab;
