import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaArrowRight,
  FaUserFriends,
  FaUsers,
  FaChartLine,
  FaDice,
  FaCoins,
  FaCrown,
  FaSearch,
  FaGoogle,
} from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import { SOON_TOOLS, SIDE_TOOLS } from '../../rules/tools';
import { openRosterModal } from '../../lib/rosterModal';
import { usePageMeta, PAGE_META } from '../../lib/seo';
import './HomePage.css';

/* 랜딩 페이지.

   전에는 도구 다섯 개를 나란히 세워두고 '도구 모음'이라고 했는데,
   이제 이 사이트에 오는 이유는 하나다 - 친구들이랑 한 내전을 남기는 것.
   방을 만드는 일 하나를 크게 세우고, 나머지는 그 아래로 내린다.

   글은 짧게. 랜딩이라고 설명을 늘어놓으면 아무도 안 읽는다.
   항목 이름 옆에 한 조각씩만 붙인다.

   --i 순서대로 올라온다. 섹션이 늘어도 이어지도록 번호를 계산해 넘긴다 */
const step = (i) => ({ '--i': i });

/* 방 하나에 들어 있는 것들. 도구 목록이 아니라 '방을 만들면 뭐가 되는지'다.
   그래서 tools.jsx가 아니라 여기 있다 - 링크가 아니라 설명이다 */
const ROOM_FEATURES = [
  { icon: <FaUsers />, title: '팀 짜기', desc: '티어로 평점 맞춰 가르기' },
  { icon: <FaChartLine />, title: '전적·순위', desc: '이긴 팀만 고르면 점수가 쌓임' },
  { icon: <FaDice />, title: '또또', desc: '승리팀·퍼블·총 킬에 걸기' },
  { icon: <FaCoins />, title: '끼꼬', desc: '방마다 따로 도는 포인트' },
  { icon: <FaCrown />, title: '명예의 전당', desc: '매달 1등 박제' },
  { icon: <FaSearch />, title: '숨은 기록', desc: '궁합·천적·연승 저격' },
];

const HomePage = () => {
  usePageMeta(PAGE_META.home);
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  /* busy는 렌더 클로저 값이라 같은 틱에 들어온 두 번째 클릭을 못 막는다.
     구글 창이 두 번 열리던 일이 실제로 있었다 */
  const going = useRef(false);

  const signIn = async () => {
    if (going.current) return;
    going.current = true;
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error(e.message);
      going.current = false;
      setBusy(false);
    }
    /* 성공하면 보통 구글로 넘어가 버리므로 되돌리지 않는다 */
  };

  /* 히어로 5칸 + 섹션 제목·카드들. 숫자를 손으로 세면 카드를 하나
     더할 때마다 어긋난다 */
  let at = 5;
  const next = (n = 1) => {
    const start = at;
    at += n;
    return start;
  };
  const featAt = next(1 + ROOM_FEATURES.length);
  const sideAt = next(1 + SIDE_TOOLS.length);
  const tailAt = next();

  return (
    <div className="home-page">
      {/* 이 사이트가 뭘 하는 곳인지 한 문장. 아래로 내려야 알 수 있으면
          이미 늦었다 */}
      <section className="hero">
        {/* 이름이 본문에 한 번은 나와야 한다. 홈을 고치면서 h1이
            '롤랜챔'에서 바뀌고 이름은 푸터에만 남았는데, 검색에서
            이름으로 찾아오는 사이트라 그러면 곤란하다 */}
        <span className="home-kicker rise" style={step(0)}>
          롤랜챔
        </span>
        <h1 className="hero-title rise" style={step(1)}>
          내전 기록지
        </h1>
        <p className="hero-subtitle rise" style={step(2)}>
          롤 · 발로란트 내전을 방 하나에. 팀 짜기, 전적, 또또까지.
        </p>

        {/* 로그인 안 한 사람을 방 목록으로 보내면 '로그인이 필요해요'만
            보고 되돌아온다. 여기서 바로 붙잡는다 */}
        <div className="hero-cta rise" style={step(3)}>
          {user || !configured ? (
            <Link to="/rooms" className="cta-main">
              {user ? '내 방으로' : '내전 방 시작하기'}
              <FaArrowRight />
            </Link>
          ) : (
            <button className="cta-main" onClick={signIn} disabled={busy || loading}>
              <FaGoogle />
              {busy ? '구글로 이동 중…' : 'Google로 시작하기'}
            </button>
          )}
          <button className="cta-sub" onClick={openRosterModal}>
            <FaUserFriends /> 내 팀원 명단
          </button>
        </div>

        <p className="hero-note rise" style={step(4)}>
          {user ? '입장 코드를 받았다면 방 목록에서 넣으세요.' : '나머지 도구는 로그인 없이 씁니다.'}
        </p>
      </section>

      {/* 도구를 나열하는 대신, 방 하나에 뭐가 들어 있는지를 보여준다 */}
      <section className="tool-section">
        <h2 className="section-title rise" style={step(featAt)}>
          방 안에 있는 것들
        </h2>
        <div className="room-feats">
          {ROOM_FEATURES.map((f, i) => (
            <div className="feat rise" key={f.title} style={step(featAt + 1 + i)}>
              <span className="feat-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 내전이랑 상관없이 혼자 써도 되는 것들. 작게 둔다 */}
      <section className="tool-section">
        <h2 className="section-title rise" style={step(sideAt)}>
          곁들이 도구
        </h2>
        <div className="side-tools">
          {SIDE_TOOLS.map((t, i) => (
            <Link
              to={t.to}
              key={t.to}
              className={`side-tool rise accent-${t.accent}`}
              style={step(sideAt + 1 + i)}
            >
              <span className="side-icon">{t.icon}</span>
              <span className="side-text">
                <strong>{t.name}</strong>
                <em>{t.short || t.desc}</em>
              </span>
              <FaArrowRight className="side-go" />
            </Link>
          ))}
        </div>
      </section>

      {/* 아직 없는 걸 카드로 세워두면 자리만 먹는다. 한 줄이면 족하다 */}
      <p className="soon-line rise" style={step(tailAt)}>
        준비 중 · {SOON_TOOLS.map((t) => t.name).join(' · ')}
      </p>

      <footer className="footer rise" style={step(tailAt)}>
        © {new Date().getFullYear()} 롤랜챔 · Made by @HyeongJun02
      </footer>
    </div>
  );
};

export default HomePage;
