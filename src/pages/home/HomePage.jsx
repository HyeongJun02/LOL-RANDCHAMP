import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaArrowRight, FaUserFriends, FaGoogle, FaClipboardList } from 'react-icons/fa';
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

/* 방 하나에 들어 있는 것들. 갈 곳이 아니라 설명이라 한 줄로 흘린다 */
const ROOM_FEATURES = [
  '팀 짜기',
  '전적·순위',
  '또또',
  '끼꼬 포인트',
  '명예의 전당',
  '숨은 기록',
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
  const featAt = next(2 + SIDE_TOOLS.length);
  const sideAt = next();
  const tailAt = next();

  return (
    <div className="home-page">
      {/* 이 사이트가 뭘 하는 곳인지 한 문장. 아래로 내려야 알 수 있으면
          이미 늦었다 */}
      <section className="hero">
        <span className="home-kicker rise" style={step(0)}>
          롤 · 발로란트
        </span>
        <h1 className="hero-title rise" style={step(1)}>
          내전 기록지
        </h1>
        <p className="hero-subtitle rise" style={step(2)}>
          방 하나에 팀 짜기, 전적, 또또까지.
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
          {user
            ? '입장 코드를 받았다면 방 목록에서 넣으세요.'
            : '로그인은 방을 만들고 들어갈 때만 씁니다. 나머지 도구는 그냥 쓰면 됩니다.'}
        </p>
      </section>

      {/* 설명이 아니라 갈 곳을 세운다. 전에는 '무엇이 되는지' 여섯 줄이
          제일 큰 자리를 먹고, 정작 누를 수 있는 건 아래 작은 카드였다.
          처음 온 사람이 알아야 하는 건 '어디로 가면 되는가'다 */}
      <section className="tool-section">
        <h2 className="section-title rise" style={step(featAt)}>
          어디로 갈까요
        </h2>

        <div className="dest-list">
          <Link to="/rooms" className="dest is-main rise" style={step(featAt + 1)}>
            <span className="dest-icon">
              <FaClipboardList />
            </span>
            <span className="dest-text">
              <strong>
                내전 방<em className="dest-tag">여기가 본체</em>
              </strong>
              <span>방 만들고 코드 나눠주면 기록·순위·또또가 다 여기서</span>
            </span>
            <FaArrowRight className="dest-go" />
          </Link>

          {SIDE_TOOLS.map((t, i) => (
            <Link
              to={t.to}
              key={t.to}
              className={`dest rise accent-${t.accent}`}
              style={step(featAt + 2 + i)}
            >
              <span className="dest-icon">{t.icon}</span>
              <span className="dest-text">
                <strong>{t.name}</strong>
                <span>{t.short || t.desc}</span>
              </span>
              <FaArrowRight className="dest-go" />
            </Link>
          ))}
        </div>

        {/* 방 안에 뭐가 들었는지는 한 줄이면 족하다. 여섯 칸으로 펼치면
            갈 곳 목록보다 커져서 무엇이 중요한지가 뒤집힌다 */}
        <p className="room-feats-line rise" style={step(sideAt)}>
          방 안에 있는 것들 · {ROOM_FEATURES.join(' · ')}
        </p>
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
