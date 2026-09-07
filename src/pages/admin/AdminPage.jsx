import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaChartBar,
  FaChevronLeft,
  FaChevronRight,
  FaDoorOpen,
  FaSyncAlt,
  FaTrash,
  FaUserShield,
  FaUsers,
  FaStethoscope,
} from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import { useMe, feedParts } from '../../rooms';
import {
  useAdminData,
  fetchAllLogs,
  setSiteRole,
  adminDeleteRoom,
  rollSeasonNow,
  ADMIN_LOG_PAGE,
} from '../../admin';
import { useDialog } from '../../components/common/Dialog';
import PageHeader from '../../components/common/PageHeader';
import { SkelRows, SkelBox } from '../../components/common/Skeleton';
import CheckTab from './CheckTab';
import UserDetail from './UserDetail';
import './Admin.css';

const num = (n) => Number(n || 0).toLocaleString();

const when = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
};

const whenFull = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

const TABS = [
  { key: 'overview', label: '개요', icon: <FaChartBar /> },
  { key: 'users', label: '사용자', icon: <FaUsers /> },
  { key: 'rooms', label: '방', icon: <FaDoorOpen /> },
  { key: 'check', label: '점검', icon: <FaStethoscope /> },
  { key: 'logs', label: '로그', icon: <FaUserShield /> },
];

/* 숫자 하나 = 칸 하나. 관리자 화면은 훑는 화면이라 설명보다 밀도가 중요하다 */
const Stat = ({ label, value, sub }) => (
  <div className="adm-stat">
    <b>{value}</b>
    <span>{label}</span>
    {sub && <em>{sub}</em>}
  </div>
);

/* 표 머리를 누르면 그 열로 정렬. 관리자 화면에서 제일 자주 하는 일이다 */
const useSort = (initial) => {
  const [sort, setSort] = useState({ key: initial, desc: true });
  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  const apply = (rows) =>
    [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const cmp = typeof x === 'string' ? x.localeCompare(y, 'ko') : x - y;
      return sort.desc ? -cmp : cmp;
    });
  return { sort, toggle, apply };
};

const Th = ({ col, sort, onSort, children, right }) => (
  <th className={right ? 'num' : ''}>
    <button className={`adm-th ${sort.key === col ? 'on' : ''}`} onClick={() => onSort(col)}>
      {children}
      {sort.key === col && <i>{sort.desc ? '▾' : '▴'}</i>}
    </button>
  </th>
);

/* ---------- 로그 ---------- */

const LogsTab = () => {
  const [items, setItems] = useState([]);
  const [cursors, setCursors] = useState([undefined]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (at, list) => {
    setLoading(true);
    try {
      const rows = (await fetchAllLogs(list[at])) || [];
      setItems(rows);
      setHasNext(rows.length === ADMIN_LOG_PAGE);
    } catch {
      setItems([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, [undefined]);
  }, [load]);

  const next = () => {
    const last = items[items.length - 1];
    if (!last) return;
    const list = [...cursors];
    list[page + 1] = last.id;
    setCursors(list);
    setPage(page + 1);
    load(page + 1, list);
  };

  const prev = () => {
    if (page === 0) return;
    setPage(page - 1);
    load(page - 1, cursors);
  };

  if (loading) return <SkelRows count={10} h={34} />;
  if (items.length === 0) return <p className="rooms-blank">아직 남은 기록이 없어요.</p>;

  return (
    <>
      <ul className="adm-logs">
        {items.map((log) => {
          const { tag, parts } = feedParts(log);
          return (
            <li key={log.id}>
              <span className={`feed-tag tone-${tag.tone}`}>{tag.label}</span>
              <Link className="adm-log-room" to={`/rooms/${log.room_id}`}>
                {log.room_name}
              </Link>
              <span className="feed-when">{whenFull(log.created_at)}</span>
              <span className="feed-text">
                {parts.map((x, i) => (
                  <span key={i} className={`feed-${x.k}`}>
                    {x.v}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="feed-pager">
        <button className="ghost-btn" onClick={prev} disabled={page === 0}>
          <FaChevronLeft /> 이전
        </button>
        <span className="feed-page-no">{page + 1}쪽</span>
        <button className="ghost-btn" onClick={next} disabled={!hasNext}>
          다음 <FaChevronRight />
        </button>
      </div>
    </>
  );
};

/* ---------- 페이지 ---------- */

const AdminPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { me, loading: meLoading } = useMe(user?.id);
  const { confirm } = useDialog();

  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  /* 표에서 이름을 누르면 그 사람만 파고든다 */
  const [peek, setPeek] = useState(null);

  const isAdmin = me?.role === 'admin';
  const { data, loading, error, reload } = useAdminData(isAdmin);

  const userSort = useSort('created_at');
  const roomSort = useSort('created_at');

  const users = useMemo(() => {
    const rows = data?.users || [];
    const key = q.trim().toLowerCase();
    const hit = key
      ? rows.filter(
          (r) =>
            (r.nickname || '').toLowerCase().includes(key) ||
            r.user_id.toLowerCase().includes(key)
        )
      : rows;
    return userSort.apply(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, userSort.sort]);

  const rooms = useMemo(() => {
    const rows = data?.rooms || [];
    const key = q.trim().toLowerCase();
    const hit = key ? rows.filter((r) => r.name.toLowerCase().includes(key)) : rows;
    return roomSort.apply(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, roomSort.sort]);

  const toggleAdmin = async (u) => {
    const next = u.role === 'admin' ? 'user' : 'admin';
    const ok = await confirm({
      title: next === 'admin' ? '관리자 지정' : '관리자 해제',
      message: `${u.nickname || '이름 없음'} 님을 ${next === 'admin' ? '관리자로 지정' : '일반 사용자로'}할까요?`,
      detail:
        next === 'admin'
          ? '전체 사용자와 모든 방의 로그를 볼 수 있게 되고, 방을 지울 수 있습니다.'
          : '관리자 화면에 더 이상 들어오지 못합니다.',
      confirmText: next === 'admin' ? '지정' : '해제',
      danger: next === 'admin',
    });
    if (!ok) return;
    try {
      await setSiteRole(u.user_id, next);
      toast.success('권한을 바꿨어요.');
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const dropRoom = async (r) => {
    const ok = await confirm({
      title: '방 삭제',
      message: `'${r.name}' 방을 지울까요?`,
      detail: `경기 ${num(r.scrims)}판, 또또 ${num(r.bets)}건, 멤버 ${num(r.members)}명이 함께 사라집니다. 되돌릴 수 없어요.`,
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminDeleteRoom(r.id);
      toast.success('방을 지웠어요.');
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const roll = async () => {
    try {
      const month = await rollSeasonNow();
      toast.success(`시즌을 확인했어요. 지금은 ${month} 입니다.`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (authLoading || meLoading) {
    return (
      <div className="page">
        <SkelBox h={90} />
      </div>
    );
  }

  /* 권한이 없으면 무엇이 있는지도 알려주지 않는다 */
  if (!user || !isAdmin) {
    return (
      <div className="page">
        <PageHeader title="관리자" sub="이 페이지에 들어올 권한이 없습니다." />
        <p className="rooms-blank">
          잘못 찾아오셨어요.
          <br />
          <Link className="ghost-btn" to="/" style={{ marginTop: '1rem' }}>
            홈으로
          </Link>
        </p>
      </div>
    );
  }

  const o = data?.overview || {};
  const behind = o.season && o.this_month && o.season < o.this_month;

  return (
    <div className="page adm-page">
      <PageHeader title="관리자" sub="사이트 전체를 한 화면에서 봅니다.">
        <button className="ghost-btn adm-reload" onClick={reload}>
          <FaSyncAlt /> 새로 읽기
        </button>
      </PageHeader>

      <div className="room-tabs no-rise adm-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`room-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="room-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="rooms-blank">{error}</p>}

      {loading ? (
        <SkelRows count={6} h={54} />
      ) : (
        <>
          {tab === 'overview' && (
            <div className="room-settings">
              <section className="room-panel">
                <h3>사용자</h3>
                <div className="adm-stats">
                  <Stat label="가입" value={num(o.users)} sub={`최근 7일 +${num(o.users_7d)}`} />
                  <Stat label="닉네임 지정" value={num(o.named)} />
                  <Stat label="방 참여" value={num(o.memberships)} />
                  <Stat label="참가자 등록" value={num(o.players)} />
                </div>
              </section>

              <section className="room-panel">
                <h3>경기와 또또</h3>
                <div className="adm-stats">
                  <Stat label="방" value={num(o.rooms)} />
                  <Stat label="끝난 경기" value={num(o.scrims)} sub={`최근 7일 ${num(o.scrims_7d)}판`} />
                  <Stat label="진행 중" value={num(o.live)} />
                  <Stat label="또또 건수" value={num(o.bets)} />
                  <Stat label="총 판돈" value={num(o.wagered)} sub="끼꼬" />
                  <Stat
                    label="지급"
                    value={num(o.paid)}
                    sub={`차액 ${num((o.wagered || 0) - (o.paid || 0))} 소각`}
                  />
                </div>
              </section>

              <section className="room-panel">
                <h3>시즌</h3>
                <div className="adm-stats">
                  <Stat label="현재 시즌" value={o.season || '-'} />
                  <Stat label="이번 달" value={o.this_month || '-'} />
                  <Stat label="지갑" value={num(o.wallets)} />
                  <Stat label="유통 중인 끼꼬" value={num(o.points)} />
                </div>
                <p className="rooms-hint">
                  마지막 초기화 {whenFull(o.rolled_at)}.{' '}
                  {behind
                    ? '달이 넘어갔는데 아직 초기화가 안 됐습니다. 아래 버튼으로 밀어주세요.'
                    : '초기화는 누군가 로그인할 때 자동으로 확인합니다.'}
                </p>
                <button
                  className={`ghost-btn adm-action ${behind ? 'urge' : ''}`}
                  onClick={roll}
                >
                  <FaSyncAlt /> 시즌 확인·초기화
                </button>
              </section>
            </div>
          )}

          {tab === 'users' && (
            <>
              <input
                className="rooms-input adm-search"
                value={q}
                placeholder="닉네임 또는 계정 ID"
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="adm-tablewrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <Th col="nickname" sort={userSort.sort} onSort={userSort.toggle}>
                        닉네임
                      </Th>
                      <Th col="created_at" sort={userSort.sort} onSort={userSort.toggle}>
                        가입
                      </Th>
                      <Th col="rooms" sort={userSort.sort} onSort={userSort.toggle} right>
                        방
                      </Th>
                      <Th col="points" sort={userSort.sort} onSort={userSort.toggle} right>
                        끼꼬
                      </Th>
                      <Th col="bets" sort={userSort.sort} onSort={userSort.toggle} right>
                        또또
                      </Th>
                      <Th col="wagered" sort={userSort.sort} onSort={userSort.toggle} right>
                        판돈
                      </Th>
                      <Th col="net" sort={userSort.sort} onSort={userSort.toggle} right>
                        손익
                      </Th>
                      <Th col="last_active" sort={userSort.sort} onSort={userSort.toggle}>
                        최근
                      </Th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} className={u.role === 'admin' ? 'is-admin' : ''}>
                        <td>
                          <button
                            className="adm-name adm-peek"
                            onClick={() => setPeek(u)}
                            title="자세히 보기"
                          >
                            {u.nickname || '이름 없음'}
                          </button>
                          {u.role === 'admin' && <span className="adm-badge">관리자</span>}
                          {u.user_id === user.id && <em className="adm-me">나</em>}
                        </td>
                        <td className="dim">{when(u.created_at)}</td>
                        <td className="num">{num(u.rooms)}</td>
                        <td className="num">{num(u.points)}</td>
                        <td className="num">{num(u.bets)}</td>
                        <td className="num">{num(u.wagered)}</td>
                        <td className={`num ${u.net > 0 ? 'plus' : u.net < 0 ? 'minus' : 'dim'}`}>
                          {u.net > 0 ? '+' : ''}
                          {num(u.net)}
                        </td>
                        <td className="dim">{when(u.last_active)}</td>
                        <td className="right">
                          {u.user_id !== user.id && (
                            <button className="adm-btn" onClick={() => toggleAdmin(u)}>
                              {u.role === 'admin' ? '해제' : '관리자'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="rooms-hint">
                {users.length}명 표시. 첫 관리자는 DB에서 직접 지정해야 합니다 —
                <code> update profiles set role = &#39;admin&#39; where user_id = &#39;...&#39;</code>
              </p>
            </>
          )}

          {tab === 'rooms' && (
            <>
              <input
                className="rooms-input adm-search"
                value={q}
                placeholder="방 이름"
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="adm-tablewrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <Th col="name" sort={roomSort.sort} onSort={roomSort.toggle}>
                        방
                      </Th>
                      <Th col="owner_name" sort={roomSort.sort} onSort={roomSort.toggle}>
                        방장
                      </Th>
                      <Th col="members" sort={roomSort.sort} onSort={roomSort.toggle} right>
                        멤버
                      </Th>
                      <Th col="scrims" sort={roomSort.sort} onSort={roomSort.toggle} right>
                        경기
                      </Th>
                      <Th col="bets" sort={roomSort.sort} onSort={roomSort.toggle} right>
                        또또
                      </Th>
                      <Th col="wagered" sort={roomSort.sort} onSort={roomSort.toggle} right>
                        판돈
                      </Th>
                      <Th col="points" sort={roomSort.sort} onSort={roomSort.toggle} right>
                        끼꼬
                      </Th>
                      <Th col="last_played" sort={roomSort.sort} onSort={roomSort.toggle}>
                        최근
                      </Th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link className="adm-name" to={`/rooms/${r.id}`}>
                            <span className="adm-emblem">{r.emblem}</span>
                            {r.name}
                          </Link>
                        </td>
                        <td className="dim">{r.owner_name}</td>
                        <td className="num">{num(r.members)}</td>
                        <td className="num">{num(r.scrims)}</td>
                        <td className="num">{num(r.bets)}</td>
                        <td className="num">{num(r.wagered)}</td>
                        <td className="num">{num(r.points)}</td>
                        <td className="dim">{when(r.last_played)}</td>
                        <td className="right">
                          <button className="adm-btn danger" onClick={() => dropRoom(r)}>
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="rooms-hint">{rooms.length}개 표시.</p>
            </>
          )}

          {tab === 'check' && <CheckTab onChanged={reload} />}

          {tab === 'logs' && <LogsTab />}
        </>
      )}

      {peek && (
        <UserDetail
          userId={peek.user_id}
          name={peek.nickname}
          onClose={() => setPeek(null)}
        />
      )}
    </div>
  );
};

export default AdminPage;
