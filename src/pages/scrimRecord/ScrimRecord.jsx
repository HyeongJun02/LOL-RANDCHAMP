import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaArrowRight,
  FaTimes,
  FaTrophy,
  FaDice,
  FaUsers,
  FaRedo,
  FaExternalLinkAlt,
  FaGamepad,
  FaExchangeAlt,
  FaPlus,
  FaChevronRight,
} from 'react-icons/fa';
import { loadLastSplit } from '../../lib/lastSplit';
import Modal from '../../components/common/Modal';
import Empty from '../../components/common/Empty';
import TeamBalance from '../teamBalance/TeamBalance';
import BetOpenModal from '../rooms/BetOpenModal';
import BetTimer from '../rooms/BetTimer';
import { useDialog } from '../../components/common/Dialog';
import { timeAgo } from '../../lib/timeAgo';
import {
  defaultModeOf,
  getMode,
  hasModeChoice,
  getTier,
  tierName,
  ratingOf,
} from '../../rules/games';
import { statsFor, statOf } from '../../rules/matches';
import { useGame, useGameKey } from '../../lib/GameContext';
import './ScrimRecord.css';

/* 최근 몇 판을 이겼나. 이름 → [오래된 순 true/false].
   '8승 4패'는 통산이라 오늘 폼을 말해주지 않는다. 점 다섯 개가
   '요즘 잘 나가는 애'를 한눈에 보여준다 */
/* 대기가 길어지면 '누가 아직 안 들어갔지'를 눈으로 훑게 된다.
   자주 오는 사람이 위로 오는 게 기본 - 내전은 대개 같은 얼굴들이다 */
const SORTS = [
  { key: 'games', label: '많이 뛴 순' },
  { key: 'tier', label: '티어 순' },
  { key: 'name', label: '이름 순' },
];

const FORM_LEN = 5;
const formsOf = (matches) => {
  const out = new Map();
  [...matches]
    .sort((a, b) => b.playedAt - a.playedAt)
    .forEach((m) => {
      const put = (name, win) => {
        const cur = out.get(name) || [];
        if (cur.length < FORM_LEN) {
          cur.push(win);
          out.set(name, cur);
        }
      };
      m.teamA.forEach((n) => put(n, m.winner === 'A'));
      m.teamB.forEach((n) => put(n, m.winner === 'B'));
    });
  /* 모으기는 최신부터(최근 다섯 판만 집으려고), 그리기는 오래된 것부터.
     시간은 왼쪽에서 오른쪽으로 흐른다 - 오른쪽 끝이 방금 한 판이다 */
  out.forEach((list) => list.reverse());
  return out;
};

/* 사람 하나 = 카드 하나. 끌어다 팀에 넣는다.
   손가락으로는 끌 수가 없어서(모바일 브라우저는 HTML5 드래그를 안 준다)
   누르면 사람이 적은 팀으로 들어가고, 팀 안에서는 ⇄로 건너간다.

   카드가 높아지면 열 명이 화면을 다 먹는다. 두 줄로 묶는다 -
   위는 이름과 티어, 아래는 칭호·전적·최근 폼. */
const PlayerCard = ({ name, game, player, title, stat, form, onTap, onMove, onRemove, onDrag }) => {
  const tier = player ? getTier(game, player.tier) : null;
  return (
    <div
      className={`sr-card ${onTap ? 'is-tappable' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', name);
        e.dataTransfer.effectAllowed = 'move';
        onDrag(name);
      }}
      onDragEnd={() => onDrag(null)}
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      title={onTap ? `${name} — 눌러서 넣기 (끌어다 놓아도 됩니다)` : name}
    >
      <span className="sr-card-body">
        <span className="sr-card-top">
          <b className="sr-card-name">{name}</b>
          {tier && (
            <span className="tier-badge" style={{ '--tier': tier.color }}>
              {tierName(game, player)}
            </span>
          )}
        </span>

        <span className="sr-card-info">
          {title && (
            <em className={`sr-card-title tone-${title.tone}`}>
              {title.icon} {title.label}
            </em>
          )}
          {stat ? (
            <span className="sr-card-rec">
              {stat.wins}승 {stat.losses}패
            </span>
          ) : (
            <span className="sr-card-rec is-new">첫 판</span>
          )}
          {form && form.length > 0 && (
            <span className="sr-form" title={`최근 ${form.length}판 (오른쪽이 방금 판 판)`}>
              {form.map((win, i) => (
                <i
                  key={i}
                  className={win ? 'is-w' : 'is-l'}
                  /* 오른쪽으로 갈수록 또렷하게. 다섯 점이 다 같은 진하기면
                     어느 쪽이 최근인지 알 수가 없다 */
                  style={{ opacity: 0.35 + (0.65 * (i + 1)) / form.length }}
                />
              ))}
            </span>
          )}
        </span>
      </span>

      {(onMove || onRemove) && (
        <span className="sr-card-acts">
          {onMove && (
            <button
              className="sr-card-act"
              onClick={(e) => {
                e.stopPropagation();
                onMove();
              }}
              aria-label={`${name} 다른 팀으로`}
              title="다른 팀으로"
            >
              <FaExchangeAlt />
            </button>
          )}
          {onRemove && (
            <button
              className="sr-card-act"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={`${name} 빼기`}
              title="대기로 빼기"
            >
              <FaTimes />
            </button>
          )}
        </span>
      )}
    </div>
  );
};

/* 방의 '게임 시작' 탭.
   matches: rooms.js가 이름을 붙여 넘겨준 경기 목록
   players: 방 참가자 명단 (티어 배지와 카드에 쓴다)
   titles:  이름 → 칭호. 방이 한 번 계산해서 나눠준다
   activeScrim: 지금 열려 있는 또또. 권한이 없는 사람에게는 이 탭에서
                볼 게 이것뿐이다
   canEdit: 경기 기록 권한이 있는 사람만 true */
const ScrimRecord = ({
  matches = [],
  players = [],
  titles,
  activeScrim = null,
  canEdit = false,
  onAdd,
  onOpenBetting,
  onGoBet,
}) => {
  const game = useGame();
  const gameKey = useGameKey();
  const [mode, setMode] = useState(() => defaultModeOf(gameKey));
  const modeInfo = getMode(gameKey, mode);
  /* 빈 칸('')을 섞어두지 않는다. 자리는 화면이 그리는 것이고,
     여기 담긴 건 '지금 이 팀인 사람'뿐이다 */
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  /* 명단에 없는데 직접 적어 넣은 이름. 팀에서 빼도 대기에 남아 있어야 한다 */
  const [extras, setExtras] = useState([]);
  const [typed, setTyped] = useState('');
  const [sort, setSort] = useState('games');
  /* 지금 끌고 있는 카드와, 그 카드가 올라온 자리 */
  const dragging = useRef(null);
  const [over, setOver] = useState(null);
  /* 더블클릭으로 같은 경기가 두 번 들어가는 걸 막는다.
     상태로 잡으면 렌더 클로저의 옛 값을 읽어서 두 번 통과한다 */
  const saving = useRef(false);
  const { confirm } = useDialog();
  const [showBalancer, setShowBalancer] = useState(false);
  const [showBetOpen, setShowBetOpen] = useState(false);

  const history = useMemo(
    () => [...matches].sort((a, b) => b.playedAt - a.playedAt),
    [matches]
  );
  const stats = useMemo(() => statsFor(matches), [matches]);
  const forms = useMemo(() => formsOf(matches), [matches]);
  const infoOf = (name) => players.find((p) => p.name === name) || null;

  /* 아직 어느 팀도 아닌 사람들 */
  const inTeams = new Set([...teamA, ...teamB]);
  const pool = [...players.map((p) => p.name), ...extras]
    .filter((n, i, all) => all.indexOf(n) === i && !inTeams.has(n))
    .sort((a, b) => {
      if (sort === 'name') return a.localeCompare(b, 'ko');
      const tie = a.localeCompare(b, 'ko');
      if (sort === 'tier') {
        const r = (n) => {
          const p = players.find((x) => x.name === n);
          return p ? ratingOf(gameKey, p) : -1;
        };
        return r(b) - r(a) || tie;
      }
      return (statOf(stats, b)?.games || 0) - (statOf(stats, a)?.games || 0) || tie;
    });

  /* 한 사람은 한 자리에만. 넣기 전에 양쪽에서 빼고 넣는다 -
     안 그러면 끌어다 옮길 때 양 팀에 동시에 있게 된다 */
  const place = (name, side) => {
    if (!name) return;
    setTeamA((prev) => {
      const rest = prev.filter((n) => n !== name);
      return side === 'A' ? [...rest, name] : rest;
    });
    setTeamB((prev) => {
      const rest = prev.filter((n) => n !== name);
      return side === 'B' ? [...rest, name] : rest;
    });
    /* 명단에 없는 이름은 빼는 순간 사라져버린다. 대기에 남겨둔다 */
    if (!side && !players.some((p) => p.name === name)) {
      setExtras((prev) => (prev.includes(name) ? prev : [...prev, name]));
    }
  };

  /* 손가락으로는 못 끈다. 누르면 사람이 적은 쪽으로 */
  const tapIn = (name) => place(name, teamA.length <= teamB.length ? 'A' : 'B');

  const dropOn = (side) => (e) => {
    e.preventDefault();
    const name = e.dataTransfer.getData('text/plain') || dragging.current;
    place(name, side);
    dragging.current = null;
    setOver(null);
  };
  const dragOver = (side) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (over !== side) setOver(side);
  };

  const addTyped = () => {
    const name = typed.trim();
    if (!name) return;
    if (inTeams.has(name)) {
      toast.error(`'${name}' 님은 이미 팀에 있어요.`);
      return;
    }
    if (!players.some((p) => p.name === name)) {
      setExtras((prev) => (prev.includes(name) ? prev : [...prev, name]));
    }
    tapIn(name);
    setTyped('');
  };

  /* 팝업에서 '이 팀으로 진행'을 누르면 그대로 옮겨 담는다.
     예전에는 팀 짜기 페이지에 다녀와서 '가져오기'를 눌러야 했다 */
  const applyTeams = (a, b) => {
    const clean = (list) => (list || []).map((n) => n.trim()).filter(Boolean);
    const next = { a: clean(a), b: clean(b) };
    setTeamA(next.a);
    setTeamB(next.b);
    const unknown = [...next.a, ...next.b].filter((n) => !players.some((p) => p.name === n));
    if (unknown.length) setExtras((prev) => [...new Set([...prev, ...unknown])]);
    setShowBalancer(false);
  };

  /* 다른 기기/탭에서 짜둔 게 있으면 팝업을 열 때 이어서 보여준다 */
  const lastSplit = loadLastSplit();

  /* 직전 경기에 뛴 사람들. 내전은 같은 인원으로 연달아 하는 게 보통이라
     매번 열 명을 다시 골라 넣는 게 제일 번거롭다 */
  const lastGame = history[0];

  /* 팝업에도 같은 걸 쥐여준다. 티어는 방 참가자 명단에서 찾아 붙인다 */
  const recentPeople = (lastGame ? [...lastGame.teamA, ...lastGame.teamB] : [])
    .filter((n) => n && n.trim())
    .map((n) => infoOf(n) || { name: n });

  const fillFromLastGame = () => {
    if (!lastGame) return;
    applyTeams(lastGame.teamA, lastGame.teamB);
    toast.success('직전 경기 인원을 가져왔어요.');
  };

  /* 탭을 열었는데 비어 있고 직전 경기가 있으면 한 번만 자동으로 채운다.
     사람이 이미 뭔가 넣어둔 상태를 덮어쓰지 않도록 '비어 있을 때'만 본다 */
  const autoFilled = useRef(false);
  useEffect(() => {
    if (autoFilled.current || !canEdit || !lastGame) return;
    if (teamA.length || teamB.length) return;
    autoFilled.current = true;
    setTeamA(lastGame.teamA.filter(Boolean));
    setTeamB(lastGame.teamB.filter(Boolean));
  }, [canEdit, lastGame, teamA, teamB]);

  const clearTeams = () => {
    setTeamA([]);
    setTeamB([]);
  };

  /* 명단에 없는 이름을 적으면 서버가 조용히 새 참가자로 등록한다.
     그래서 poop으로 40판 뛴 사람이 한 번 푸푸로 적히면 전적이 두 줄로
     갈린다. 나중에 이름만 고쳐도 안 붙는다 - 지난 경기는 옛 줄의 id를
     들고 있기 때문이다 (합치려면 설정에서 따로 합쳐야 한다).
     기계는 poop과 푸푸가 같은 사람인지 알 수 없다. 대신 한 번 물어본다.
     명단을 같이 보여주면 '아 내가 쓰던 이름이 저건데'를 그 자리에서 안다 */
  const confirmNewNames = async (names) => {
    /* 방금 만든 방은 명단이 비어 있다. 헷갈릴 상대가 없으니 묻지 않는다 */
    if (players.length === 0) return true;
    const have = new Set(players.map((p) => p.name));
    const fresh = [...new Set(names)].filter((n) => !have.has(n));
    if (fresh.length === 0) return true;
    return confirm({
      title: '명단에 없는 이름',
      message: `${fresh.join(', ')} — 이 방 명단에 넣고 진행할까요?`,
      detail:
        '이미 있는 사람이 이름만 바꿔 적은 거라면 전적이 두 줄로 갈립니다. ' +
        `지금 명단: ${players.map((p) => p.name).join(', ')}`,
      confirmText: '넣고 진행',
    });
  };

  /* 양 팀이 갖춰졌는지. 승리 기록과 또또 열기가 같은 검사를 쓴다.
     같은 사람이 양 팀에 있는 일은 이제 생기지 않는다 - place가 넣기 전에
     양쪽에서 빼기 때문이다 */
  const ready = async () => {
    if (teamA.length === 0 || teamB.length === 0) {
      toast.error('양 팀 모두 최소 1명은 있어야 해요.');
      return false;
    }
    return confirmNewNames([...teamA, ...teamB]);
  };

  const recordWin = async (winner) => {
    if (saving.current) return;
    if (!(await ready())) return;
    saving.current = true;
    try {
      await onAdd({ mode, teamA, teamB, winner });
      toast.success(`${winner === 'A' ? '1팀' : '2팀'} 승리! 기록했어요.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      saving.current = false;
    }
  };

  /* 팀 짜는 화면을 또또용으로 한 번 더 만들 이유가 없다. 같은 패널에서 연다 */
  const openBetting = async (closeSeconds = null, killLine = null) => {
    if (saving.current) return;
    if (!(await ready())) return;
    saving.current = true;
    try {
      await onOpenBetting({ mode, teamA, teamB, closeSeconds, killLine });
      setShowBetOpen(false);
      toast.success(
        closeSeconds
          ? `또또를 열었어요. ${Math.round(closeSeconds / 60) || 1}분 뒤 자동으로 마감됩니다.`
          : '또또를 열었어요. 마감은 직접 눌러야 합니다.'
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      saving.current = false;
    }
  };

  const card = (name, side) => (
    <PlayerCard
      key={name}
      name={name}
      game={gameKey}
      player={infoOf(name)}
      title={titles?.get(name)}
      stat={statOf(stats, name)}
      form={forms.get(name)}
      onDrag={(n) => {
        dragging.current = n;
      }}
      onTap={side ? undefined : () => tapIn(name)}
      onMove={side ? () => place(name, side === 'A' ? 'B' : 'A') : undefined}
      onRemove={side ? () => place(name, null) : undefined}
    />
  );

  const teamPanel = (side, label, list, accent) => {
    const short = Math.max(0, modeInfo.teamSize - list.length);
    return (
      <div
        className={`sr-team ${accent} ${over === side ? 'is-over' : ''}`}
        onDragOver={dragOver(side)}
        onDragLeave={() => setOver(null)}
        onDrop={dropOn(side)}
      >
        <div className="sr-team-head">
          <h3>{label}</h3>
          <span className="sr-team-count">
            <b>{list.length}</b>/{modeInfo.teamSize}
          </span>
        </div>
        <div className="sr-team-cards">
          {list.map((n) => card(n, side))}
          {/* 빈 자리를 그려둬야 몇 명이 모자란지 세지 않는다 */}
          {Array.from({ length: short }, (_, i) => (
            <div className="sr-slot" key={`s${i}`}>
              {i === 0 ? '여기로 끌어다 놓기' : ''}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* 지금 열려 있는 또또. 권한이 없는 사람에게는 이 탭에서 볼 게 이것뿐이라
     맨 위에 둔다. 자세한 건 또또 탭이 맡는다 - 같은 걸 두 벌로 그리면
     둘이 조금씩 달라지고 어느 쪽이 맞는지 아무도 모르게 된다 */
  const live = activeScrim ? (
    <section className={`room-panel sr-live s-${activeScrim.status}`}>
      <h3>
        <FaDice /> 지금 진행 중
        <span className={`bet-status is-live s-${activeScrim.status}`}>
          {activeScrim.status === 'betting' ? '또또 받는 중' : '또또 마감 · 경기 중'}
        </span>
        {activeScrim.status === 'betting' && activeScrim.betting_closes_at && (
          <BetTimer closesAt={activeScrim.betting_closes_at} openedAt={activeScrim.played_at} />
        )}
      </h3>

      <div className="sr-live-teams">
        {[
          { ids: activeScrim.team_a || [], label: '1팀', accent: 'team-blue' },
          { ids: activeScrim.team_b || [], label: '2팀', accent: 'team-red' },
        ].map(({ ids, label, accent }) => (
          <div className={`sr-live-team ${accent}`} key={label}>
            <span className="sr-live-label">{label}</span>
            <span className="sr-live-names">
              {ids.map((id) => (
                <span key={id}>{players.find((p) => p.id === Number(id))?.name || '?'}</span>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="sr-live-foot">
        <span>
          <b>{activeScrim.bet_count || 0}</b>명 ·{' '}
          {Number(activeScrim.bet_total || 0).toLocaleString()} 끼꼬
        </span>
        {onGoBet && (
          <button className="ghost-btn" onClick={onGoBet}>
            또또 보러 가기 <FaChevronRight />
          </button>
        )}
      </div>
    </section>
  ) : null;

  /* 권한이 없으면 팀을 짜는 화면 자체가 쓸모가 없다. 대신 지금 무슨 판이
     돌고 있는지는 보여준다 - 이 탭에 볼 게 하나도 없으면 왜 있는지 모른다 */
  if (!canEdit) {
    return (
      <div className="room-settings">
        {live}
        {!activeScrim && (
          <section className="room-panel">
            <h3>
              <FaGamepad /> 게임 시작
            </h3>
            <Empty
              icon={<FaGamepad />}
              title="지금 진행 중인 경기가 없어요"
              desc="팀을 짜고 또또가 열리면 여기에 올라옵니다. 기록은 권한을 받은 사람이 남겨요."
            />
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="room-settings">
      {live}

      <section className="room-panel">
        <h3>
          <FaGamepad /> 게임 시작
          <span className="panel-count">{teamA.length + teamB.length}명</span>
        </h3>

        <div className="sr-toolbar">
            {/* 이것만 팝업을 여는 버튼이다. 나머지는 이 화면에서 바로 끝나는
                동작이라, 같은 회색 버튼으로 두면 무슨 일이 날지 모르고 누른다 */}
            <button className="tool-btn is-open" onClick={() => setShowBalancer(true)}>
              <FaUsers /> 팀 짜기
              <FaExternalLinkAlt className="tool-btn-out" />
            </button>
            {lastGame && (
              <button className="ghost-btn" onClick={fillFromLastGame} title="직전 경기와 같은 인원">
                <FaRedo /> 직전 인원
              </button>
            )}
            {lastSplit && (
              <button
                className="ghost-btn"
                onClick={() => applyTeams(lastSplit.teamA, lastSplit.teamB)}
                title={`${timeAgo(lastSplit.at)} 짠 팀`}
              >
                <FaArrowRight /> 방금 짠 팀
              </button>
            )}
          <button className="ghost-btn" onClick={clearTeams}>
            팀 비우기
          </button>
        </div>

        {/* 모드가 하나뿐인 게임(롤)에서는 아예 안 그린다 */}
        {hasModeChoice(gameKey) && (
          <div className="sr-modes">
            {game.modes.map((m) => (
              <button
                key={m.key}
                className={`sr-mode ${mode === m.key ? 'active' : ''}`}
                onClick={() => setMode(m.key)}
              >
                <strong>{m.label}</strong>
                {m.desc && <em>{m.desc}</em>}
              </button>
            ))}
          </div>
        )}

        {/* 아직 어느 팀도 아닌 사람들. 끌어다 넣거나 눌러서 넣는다 */}
        <div
          className={`sr-pool ${over === 'pool' ? 'is-over' : ''}`}
          onDragOver={dragOver('pool')}
          onDragLeave={() => setOver(null)}
          onDrop={dropOn(null)}
        >
          <div className="sr-pool-head">
            <span className="sr-pool-title">
              대기<b>{pool.length}</b>
            </span>
            {pool.length > 1 && (
              <div className="sr-sorts">
                {SORTS.map((o) => (
                  <button
                    key={o.key}
                    className={`sr-sort ${sort === o.key ? 'is-on' : ''}`}
                    onClick={() => setSort(o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {pool.length > 0 ? (
            <div className="sr-pool-cards">{pool.map((n) => card(n, null))}</div>
          ) : (
            <p className="sr-pool-hint">
              대기가 비었어요. 팀에서 ✕를 누르거나 카드를 여기로 끌어다 놓으면 돌아옵니다.
            </p>
          )}
          <div className="sr-pool-add">
            <input
              value={typed}
              placeholder="명단에 없는 이름"
              maxLength={16}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTyped()}
            />
            <button className="ghost-btn" onClick={addTyped} disabled={!typed.trim()}>
              <FaPlus /> 넣기
            </button>
          </div>
        </div>

        <div className="sr-teams">
          {teamPanel('A', '1팀', teamA, 'team-blue')}
          {teamPanel('B', '2팀', teamB, 'team-red')}
        </div>

        {/* 승리 기록과 또또 열기는 여기서 고르는 두 갈래다.
            또또가 구석의 작은 버튼이면 이런 게 있는 줄도 모른다 */}
        <div className="win-buttons">
          <button className="win-btn team-blue" onClick={() => recordWin('A')}>
            <FaTrophy /> 1팀 승리
          </button>
          <button className="win-btn team-red" onClick={() => recordWin('B')}>
            <FaTrophy /> 2팀 승리
          </button>
          {onOpenBetting && (
            <button className="win-btn bet-open" onClick={() => setShowBetOpen(true)}>
              <FaDice /> 또또 열기
            </button>
          )}
        </div>
        {onOpenBetting && (
          <p className="sr-bet-hint">
            또또를 열면 결과를 나중에 넣습니다. 그 사이에 다들 끼꼬를 걸 수 있어요.
          </p>
        )}
      </section>

      {showBetOpen && (
        <BetOpenModal
          onClose={() => setShowBetOpen(false)}
          onOpen={openBetting}
          mode={mode}
          playerCount={teamA.length + teamB.length}
        />
      )}

      {showBalancer && (
        <Modal
          title="내전 팀 짜기"
          desc="여기서 팀을 짠 다음 '이 팀으로 내전 진행하기'를 누르면 그대로 옮겨집니다."
          onClose={() => setShowBalancer(false)}
        >
          <TeamBalance
            embedded
            matches={matches}
            onUseTeams={(a, b) => {
              applyTeams(a, b);
              toast.success('짠 팀을 그대로 가져왔어요.');
            }}
            recent={recentPeople}
            /* 난투(2대2)면 10칸이 아니라 4칸으로 연다 */
            slots={modeInfo.teamSize * 2}
          />
        </Modal>
      )}
    </div>
  );
};

export default ScrimRecord;
