import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useRoster } from '../../server/roster';
import { FaThLarge, FaListUl, FaMinus, FaPlus } from 'react-icons/fa';
import PlayerCard from './components/PlayerCard';
import PlayerRow from './components/PlayerRow';
import PageHeader from '../../components/common/PageHeader';
import RosterLoader from '../../components/common/RosterLoader';
import RoleIcon from '../../components/common/RoleIcon';
import RosterLoadButton from '../../components/common/RosterLoadButton';
import { randomQuote } from '../../rules/lines';
import { GAMES, DEFAULT_GAME, getGame, getRole, roleNamesOf } from '../../rules/games';
import { GameProvider } from '../../lib/GameContext';
import { usePageMeta, PAGE_META } from '../../lib/seo';
import { saveLastLines } from '../../lib/lastLines';
import styles from './RandomLine.module.css';

const SUBTITLES = [
  '가기 싫은 자리는 미리 밴 때려두자. 억울함 방지 차원에서.',
  '여기서 정해지면 무를 수 없습니다. 신중하게 밴하세요.',
  '누구 탓이니 뭐니 다 필요없고 일단 뽑고 봅시다.',
];

/* 좁은 화면에서는 카드 5장이 세로로 한없이 늘어져서 목록이 낫다.
   jsdom에는 matchMedia가 없으므로 방어한다 */
const prefersCompact = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 780px)').matches;

const makeEmptyPlayers = () =>
  Array.from({ length: 5 }, () => ({ name: '', disabled: [] }));

export default function RandomLinePage() {
  /* 롤은 라인 다섯을 하나씩 나눠 갖고, 발로란트는 역할군이 넷이라
     다섯 명이면 하나가 겹친다. 그래서 게임부터 고른다 */
  const [gameKey, setGameKey] = useState(DEFAULT_GAME);
  const game = getGame(gameKey);
  const ROLES = roleNamesOf(gameKey);

  const [players, setPlayers] = useState(makeEmptyPlayers());
  const [assigned, setAssigned] = useState(Array(5).fill(null));
  const [quotes, setQuotes] = useState(Array(5).fill(''));
  const [triggers, setTriggers] = useState(Array(5).fill(0));
  const [resetTriggers, setResetTriggers] = useState(Array(5).fill(0));
  const [celebrate, setCelebrate] = useState(false);
  const [compact, setCompact] = useState(prefersCompact);
  const [showLoader, setShowLoader] = useState(false);
  /* 겹쳐도 되는 게임에서 '둘까지 받는 역할'. 롤은 쓰지 않는다 */
  /* 역할마다 몇 명까지 받을지. 롤은 다 1이라 안 쓴다 */
  const [caps, setCaps] = useState(() => ({ ...(getGame(DEFAULT_GAME).defaultCaps || {}) }));
  const roster = useRoster(gameKey);
  usePageMeta(PAGE_META.randomLine);
  const [subtitle] = useState(
    () => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]
  );

  const onNameChange = (i, newName) => {
    const cp = [...players];
    cp[i].name = newName;
    setPlayers(cp);
  };

  /* 저장된 팀원을 고르면 못 가는 라인까지 같이 채운다 */
  const onPickMember = (i, member) => {
    setPlayers((prev) =>
      prev.map((p, j) =>
        j === i ? { ...p, name: member.name, disabled: [...(member.lines || [])] } : p
      )
    );
  };

  /* 팝업에서 고른 대로 맞춘다. 체크가 풀린 사람은 자리를 비운다. 자리는 5개 고정 */
  const syncMembers = (members) => {
    const wanted = new Set(members.map((m) => m.name.trim()));
    const rosterNames = new Set(roster.map((m) => m.name.trim()));

    const cleared = players.map((p) => {
      const name = p.name.trim();
      const dropped = name !== '' && rosterNames.has(name) && !wanted.has(name);
      return dropped ? { ...p, name: '', disabled: [] } : p;
    });

    const already = new Set(cleared.map((p) => p.name.trim()));
    const queue = members.filter((m) => !already.has(m.name.trim()));

    const next = cleared.map((p) =>
      p.name.trim() === '' && queue.length > 0
        ? { ...p, name: queue[0].name, disabled: [...(queue.shift().lines || [])] }
        : p
    );

    setPlayers(next);
    if (queue.length > 0) {
      toast.error(`자리가 모자라 ${queue.length}명은 넣지 못했습니다.`);
    }
  };

  /* 이 사람 배정만 되돌린다. 이름과 밴은 그대로 */
  const resetOne = (i) => {
    setAssigned((prev) => prev.map((v, j) => (j === i ? null : v)));
    setQuotes((prev) => prev.map((v, j) => (j === i ? '' : v)));
    setResetTriggers((prev) => prev.map((v, j) => (j === i ? v + 1 : v)));
    setCelebrate(false);
  };

  const onToggleLine = (i, line) => {
    const cp = [...players];
    const arr = cp[i].disabled;
    cp[i].disabled = arr.includes(line)
      ? arr.filter((l) => l !== line)
      : [...arr, line];
    setPlayers(cp);
  };

  /* 역할 하나가 받을 수 있는 사람 수.
     롤은 한 자리에 한 명이고, 발로란트는 체크한 역할만 둘까지 받는다 */
  const capOf = (role) => (game.uniqueRoles ? 1 : (caps[role] ?? 0));

  /* 0이면 그 역할은 아무도 안 맡는다. 인원보다 크게 둘 이유는 없다 */
  const setCap = (role, n) =>
    setCaps((prev) => ({ ...prev, [role]: Math.max(0, Math.min(players.length, n)) }));

  const seats = ROLES.reduce((sum, l) => sum + capOf(l), 0);

  const checkCelebrate = (arr) => {
    if (arr.every(Boolean)) {
      /* 방의 일반 게임 또또가 이어받는다 (롤만 - 라인이 다섯이라 그대로 맞는다) */
      if (gameKey === 'lol') {
        saveLastLines(players.map((p, i) => ({ name: p.name.trim(), lane: arr[i] })));
      }
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3200);
    }
  };

  const assignOne = (i) => {
    const used = assigned.filter((_, idx) => idx !== i);
    const open = ROLES.filter((l) => !players[i].disabled.includes(l));

    /* 아직 정원이 안 찬 역할을 먼저 준다. 롤은 정원이 다 1이라
       '남이 가져간 라인은 뺀다'와 같은 말이 된다 */
    const countOf = (l) => used.filter((x) => x === l).length;
    const fresh = open.filter((l) => countOf(l) < capOf(l));
    const allow = game.uniqueRoles ? fresh : fresh.length ? fresh : open;

    if (!allow.length) {
      toast.error(`갈 수 있는 ${game.roleLabel}이 없습니다. 밴을 풀어주세요.`);
      return;
    }
    const pick = allow[Math.floor(Math.random() * allow.length)];
    const asg = [...assigned];
    asg[i] = pick;
    setAssigned(asg);

    const qt = [...quotes];
    qt[i] = randomQuote(pick);
    setQuotes(qt);

    const tg = [...triggers];
    tg[i] += 1;
    setTriggers(tg);

    checkCelebrate(asg);
  };

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const assignAll = () => {
    const allowed = players.map((p) => ROLES.filter((l) => !p.disabled.includes(l)));

    for (let i = 0; i < allowed.length; i++) {
      if (allowed[i].length === 0) {
        toast.error(`${i + 1}번 플레이어가 갈 수 있는 ${game.roleLabel}이 없습니다.`);
        return;
      }
    }

    /* 자리가 사람보다 적으면 애초에 못 채운다. 배정을 돌려보고
       '안 된다'고 하는 것보다, 무엇을 고쳐야 하는지 먼저 말해준다 */
    if (seats < players.length) {
      toast.error(
        `자리가 ${seats}개뿐이라 ${players.length}명을 못 넣어요. 역할 정원을 늘려주세요.`
      );
      return;
    }

    const order = Array.from({ length: players.length }, (_, i) => i).sort(
      (a, b) => allowed[a].length - allowed[b].length
    );

    const choices = allowed.map((list) => shuffle([...list]));
    const result = Array(players.length).fill(null);
    /* 쓴 횟수를 센다. 정원이 1이면 예전의 Set과 똑같이 굴러간다 */
    const used = new Map();

    const dfs = (k) => {
      if (k === order.length) return true;
      const i = order[k];
      for (const line of choices[i]) {
        const n = used.get(line) || 0;
        if (n >= capOf(line)) continue;
        result[i] = line;
        used.set(line, n + 1);
        if (dfs(k + 1)) return true;
        used.set(line, n);
        result[i] = null;
      }
      return false;
    };

    if (!dfs(0)) {
      toast.error(`이 밴 조합으로는 다섯 명을 모두 배정할 수 없습니다.`);
      return;
    }

    setAssigned(result);
    setQuotes(result.map((line) => randomQuote(line)));
    setTriggers((trigs) => trigs.map((v) => v + 1));
    checkCelebrate(result);
  };

  /* 게임을 바꾸면 밴 목록이 그대로 남아 있어도 의미가 없다.
     '탑 밴'을 발로란트로 들고 갈 수는 없으니 배정과 밴을 함께 비운다 */
  const pickGame = (next) => {
    if (next === gameKey) return;
    setGameKey(next);
    setCaps({ ...(getGame(next).defaultCaps || {}) });
    setPlayers((prev) => prev.map((p) => ({ ...p, disabled: [] })));
    setAssigned(Array(5).fill(null));
    setQuotes(Array(5).fill(''));
    setResetTriggers((r) => r.map((x) => x + 1));
    setCelebrate(false);
  };

  /* 이름과 밴은 그대로 두고 배정 결과만 되돌린다 */
  const resetAll = () => {
    setAssigned(Array(5).fill(null));
    setQuotes(Array(5).fill(''));
    setTriggers(Array(5).fill(0));
    setResetTriggers((r) => r.map((x) => x + 1));
    setCelebrate(false);
  };

  return (
    <GameProvider game={gameKey}>
    <div className={`page ${styles.container}`}>
      <PageHeader title={`${game.roleLabel} 랜덤 분배`} sub={subtitle}>
        <div className={styles.headActions}>
          <div className="seg-tabs">
            {GAMES.map((g) => (
              <button
                key={g.key}
                className={`seg-tab ${gameKey === g.key ? 'active' : ''}`}
                onClick={() => pickGame(g.key)}
              >
                <img className="game-logo is-tiny" src={g.logo} alt="" />
                {g.label}
              </button>
            ))}
          </div>

          <RosterLoadButton onClick={() => setShowLoader(true)} />

          <div className={styles.viewToggle} role="group" aria-label="보기 방식">
            <button
              className={compact ? '' : styles.viewActive}
              aria-pressed={!compact}
              onClick={() => setCompact(false)}
            >
              <FaThLarge /> 카드
            </button>
            <button
              className={compact ? styles.viewActive : ''}
              aria-pressed={compact}
              onClick={() => setCompact(true)}
            >
              <FaListUl /> 한눈에
            </button>
          </div>
        </div>
      </PageHeader>

      {/* 역할이 사람보다 적은 게임에서만. 롤은 다섯 자리 다섯 명이라
          고를 게 없다 */}
      {!game.uniqueRoles && (
        <div className={styles.caps}>
          <div className={styles.capsHead}>
            <span className={styles.capsLabel}>역할 정원</span>
            {/* 자리가 몇 개인지가 먼저 보여야 무엇을 고쳐야 할지 안다 */}
            <span
              className={`${styles.capsCount} ${
                seats < players.length ? styles.capsShort : ''
              }`}
            >
              자리 {seats} / {players.length}명
            </span>
          </div>

          <div className={styles.capsList}>
            {ROLES.map((name) => {
              const role = getRole(gameKey, name);
              const n = capOf(name);
              return (
                <div
                  key={name}
                  className={`${styles.cap} ${n === 0 ? styles.capOff : ''}`}
                  style={n > 0 ? { '--role': role?.color } : undefined}
                >
                  <RoleIcon role={role} style={n > 0 ? { color: role?.color } : undefined} />
                  <span className={styles.capName}>{name}</span>
                  <div className={styles.capStep}>
                    <button
                      type="button"
                      onClick={() => setCap(name, n - 1)}
                      disabled={n <= 0}
                      aria-label={`${name} 정원 줄이기`}
                    >
                      <FaMinus />
                    </button>
                    <b>{n}</b>
                    <button
                      type="button"
                      onClick={() => setCap(name, n + 1)}
                      disabled={n >= players.length}
                      aria-label={`${name} 정원 늘리기`}
                    >
                      <FaPlus />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className={styles.capsHint}>
            0으로 두면 그 역할은 아무도 안 맡습니다. 자리가 인원보다 적으면 못 돌립니다.
          </p>
        </div>
      )}

      <div className={compact ? styles.rowWrapper : styles.cardWrapper}>
        {players.map((p, i) => {
          const shared = {
            game: gameKey,
            index: i,
            name: p.name,
            takenNames: players.filter((_, j) => j !== i).map((x) => x.name),
            disabledLines: p.disabled,
            assignedLine: assigned[i],
            quote: quotes[i],
            onNameChange,
            onPickMember,
            onToggleLine,
            onAssign: assignOne,
            onResetOne: resetOne,
          };
          return compact ? (
            <PlayerRow key={i} {...shared} />
          ) : (
            <PlayerCard
              key={i}
              {...shared}
              spinTrigger={triggers[i]}
              resetTrigger={resetTriggers[i]}
            />
          );
        })}
      </div>

      <div className={styles.buttonGroup}>
        <button className={styles.resetAll} onClick={resetAll}>
          전체 초기화
        </button>
        <button className={styles.assignAll} onClick={assignAll}>
          한 방에 정하기
        </button>
      </div>

      {showLoader && (
        <RosterLoader
          present={players.map((p) => p.name)}
          limit={
            players.length -
            players.filter(
              (p) =>
                p.name.trim() !== '' &&
                !roster.some((m) => m.name.trim() === p.name.trim())
            ).length
          }
          onConfirm={syncMembers}
          onClose={() => setShowLoader(false)}
        />
      )}

      {celebrate && (
        <div className={styles.confettiLayer} aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className={styles.confetti}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.6}s`,
                animationDuration: `${2 + Math.random() * 1.5}s`,
              }}
            >
              {['🎉', '⚔️', '🔥', '✨', '🍀'][i % 5]}
            </span>
          ))}
        </div>
      )}
    </div>
    </GameProvider>
  );
}
