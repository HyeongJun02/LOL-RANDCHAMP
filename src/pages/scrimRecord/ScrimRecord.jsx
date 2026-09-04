import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaArrowRight,
  FaPlus,
  FaTimes,
  FaTrophy,
  FaDice,
  FaUsers,
  FaRedo,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import { loadLastSplit } from '../../lastSplit';
import Modal from '../../components/common/Modal';
import TeamBalance from '../teamBalance/TeamBalance';
import BetOpenModal from '../rooms/BetOpenModal';
import RosterPicker from '../../components/common/RosterPicker';
import ClearInput from '../../components/common/ClearInput';
import { useDialog } from '../../components/common/Dialog';
import { timeAgo } from '../../timeAgo';
import './ScrimRecord.css';

/* 칼바람/일반을 나눠 세지 않기로 했다. scrims.mode는 NOT NULL이라 값은
   있어야 하는데, 이제 그 값으로 갈라 보는 곳이 없어 하나로 고정한다.
   (옛 기록의 'aram'도 그대로 남아 있고, 집계는 둘을 함께 센다) */
const MODE = 'normal';

const TEAM_SIZE = 5;
const blankTeam = () => Array.from({ length: TEAM_SIZE }, () => '');

/* 컴포넌트 함수 안에서 매 렌더마다 새로 만들면 리액트가 다른 컴포넌트로 보고
   통째로 재마운트한다 (인풋 포커스가 키 입력마다 날아가는 버그로 이어짐).
   그래서 모듈 스코프에 한 번만 선언하고 필요한 값은 전부 props로 받는다. */
const TeamPanel = ({ label, team, otherTeam, players, onChangeAt, onRemoveAt, onAdd, accent }) => {
  const filled = team.filter((n) => n.trim()).length;
  return (
    <div className={`sr-team ${accent}`}>
      <div className="sr-team-head">
        <h3>{label}</h3>
        {/* 몇 명 중 몇 명인지. '3명'만 있으면 자리가 남았는지 안 보인다 */}
        <span className="sr-team-count">
          <b>{filled}</b>/{team.length}
        </span>
      </div>
      {team.map((name, i) => (
        <div className={`sr-row ${name.trim() ? 'is-filled' : ''}`} key={i}>
          <span className="row-no">{i + 1}</span>
          <span className="input-with-clear">
            <input
              value={name}
              placeholder="이름"
              onChange={(e) => onChangeAt(i, e.target.value)}
            />
            <ClearInput value={name} onClear={() => onChangeAt(i, '')} />
          </span>
          <RosterPicker
            people={players}
            title="방 참가자 불러오기"
            taken={[...team.filter((_, idx) => idx !== i), ...otherTeam]}
            onPick={(m) => onChangeAt(i, m.name)}
          />
          <button className="row-del" onClick={() => onRemoveAt(i)} aria-label="자리 삭제">
            <FaTimes />
          </button>
        </div>
      ))}
      <button className="ghost-btn sr-add-slot" onClick={onAdd}>
        <FaPlus /> 자리 추가
      </button>
    </div>
  );
};

/* 방의 '기록' 탭.
   matches: rooms.js가 이름을 붙여 넘겨준 경기 목록
   players: 방 참가자 명단 (티어 배지와 이름 고르기에 쓴다)
   canEdit: 방장·부방장만 true. 나머지는 보기만 한다 */
const ScrimRecord = ({ matches = [], players = [], canEdit = false, onAdd, onRemove, onOpenBetting }) => {
  const { confirm } = useDialog();
  const [teamA, setTeamA] = useState(blankTeam);
  const [teamB, setTeamB] = useState(blankTeam);
  /* 더블클릭으로 같은 경기가 두 번 들어가는 걸 막는다.
     상태로 잡으면 렌더 클로저의 옛 값을 읽어서 두 번 통과한다 */
  const saving = useRef(false);
  const [showBalancer, setShowBalancer] = useState(false);
  const [showBetOpen, setShowBetOpen] = useState(false);

  const history = useMemo(
    () => [...matches].sort((a, b) => b.playedAt - a.playedAt),
    [matches]
  );

  const setAt = (setter) => (i, name) =>
    setter((prev) => prev.map((n, idx) => (idx === i ? name : n)));

  const addSlot = (setter) => () => setter((prev) => [...prev, '']);
  const removeSlot = (setter) => (i) => setter((prev) => prev.filter((_, idx) => idx !== i));

  /* 팝업에서 '이 팀으로 진행'을 누르면 그대로 옮겨 담는다.
     예전에는 팀 짜기 페이지에 다녀와서 '가져오기'를 눌러야 했다 */
  const applyTeams = (a, b) => {
    setTeamA(a);
    setTeamB(b);
    setShowBalancer(false);
    toast.success('짠 팀을 그대로 가져왔어요.');
  };

  /* 다른 기기/탭에서 짜둔 게 있으면 팝업을 열 때 이어서 보여준다 */
  const lastSplit = loadLastSplit();

  /* 직전 경기에 뛴 사람들. 내전은 같은 인원으로 연달아 하는 게 보통이라
     매번 열 명을 다시 골라 넣는 게 제일 번거롭다 */
  const lastGame = history[0];

  /* 팝업에도 같은 걸 쥐여준다. 티어는 방 참가자 명단에서 찾아 붙인다 */
  const recentPeople = (lastGame ? [...lastGame.teamA, ...lastGame.teamB] : [])
    .filter((n) => n && n.trim())
    .map((n) => players.find((p) => p.name === n) || { name: n });

  const fillFromLastGame = () => {
    if (!lastGame) return;
    setTeamA(lastGame.teamA);
    setTeamB(lastGame.teamB);
    toast.success('직전 경기 인원을 가져왔어요.');
  };

  /* 탭을 열었는데 비어 있고 직전 경기가 있으면 한 번만 자동으로 채운다.
     사람이 이미 뭔가 적어둔 상태를 덮어쓰지 않도록 '비어 있을 때'만 본다 */
  const autoFilled = useRef(false);
  useEffect(() => {
    if (autoFilled.current || !canEdit || !lastGame) return;
    const empty = [...teamA, ...teamB].every((n) => !n.trim());
    if (!empty) return;
    autoFilled.current = true;
    setTeamA(lastGame.teamA);
    setTeamB(lastGame.teamB);
  }, [canEdit, lastGame, teamA, teamB]);

  const clearTeams = () => {
    setTeamA(blankTeam());
    setTeamB(blankTeam());
  };

  const recordWin = async (winner) => {
    if (saving.current) return;
    const a = teamA.map((n) => n.trim()).filter(Boolean);
    const b = teamB.map((n) => n.trim()).filter(Boolean);
    if (a.length === 0 || b.length === 0) {
      toast.error('양 팀 모두 최소 1명은 있어야 해요.');
      return;
    }
    const overlap = a.find((n) => b.includes(n));
    if (overlap) {
      toast.error(`'${overlap}' 님이 양 팀에 모두 있어요.`);
      return;
    }

    saving.current = true;
    try {
      await onAdd({ mode: MODE, teamA: a, teamB: b, winner });
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
    const a = teamA.map((n) => n.trim()).filter(Boolean);
    const b = teamB.map((n) => n.trim()).filter(Boolean);
    if (a.length === 0 || b.length === 0) {
      toast.error('양 팀 모두 최소 1명은 있어야 해요.');
      return;
    }
    const overlap = a.find((n) => b.includes(n));
    if (overlap) {
      toast.error(`'${overlap}' 님이 양 팀에 모두 있어요.`);
      return;
    }
    saving.current = true;
    try {
      await onOpenBetting({ mode: MODE, teamA: a, teamB: b, closeSeconds, killLine });
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

  /* 지우면 그 경기가 지갑에 한 일까지 전부 되돌아간다.
     또또가 걸렸던 판이면 남의 돈이 오가므로 무슨 일이 일어나는지 적어준다 */
  const deleteMatch = async (m) => {
    const had = m.betCount > 0;
    const ok = await confirm({
      title: had ? '또또까지 되돌리기' : '기록 삭제',
      message: had ? '이 경기를 없던 걸로 할까요?' : '이 기록을 지울까요?',
      detail: had
        ? `${m.betCount}명이 건 ${m.betTotal.toLocaleString()} 끼꼬가 전부 돌아가고, 지급도 취소됩니다. 되돌릴 수 없어요.`
        : '전적에서 빠지고, 참여 포인트도 함께 되돌아갑니다.',
      confirmText: had ? '되돌리고 삭제' : '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await onRemove(m.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      {canEdit && (
        <>
          <div className="sr-toolbar">
            {/* 이것만 팝업을 여는 버튼이다. 나머지는 이 화면에서 바로 끝나는
                동작이라, 같은 회색 버튼으로 두면 무슨 일이 날지 모르고 누른다 */}
            <button className="tool-btn is-open" onClick={() => setShowBalancer(true)}>
              <FaUsers /> 내전 팀 짜기
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
                <FaArrowRight /> 방금 짠 팀 ({timeAgo(lastSplit.at)})
              </button>
            )}
            <button className="ghost-btn" onClick={clearTeams}>
              팀 비우기
            </button>
          </div>

          <div className="sr-teams">
            <TeamPanel
              label="1팀"
              team={teamA}
              otherTeam={teamB}
              players={players}
              onChangeAt={setAt(setTeamA)}
              onRemoveAt={removeSlot(setTeamA)}
              onAdd={addSlot(setTeamA)}
              accent="team-blue"
            />
            <TeamPanel
              label="2팀"
              team={teamB}
              otherTeam={teamA}
              players={players}
              onChangeAt={setAt(setTeamB)}
              onRemoveAt={removeSlot(setTeamB)}
              onAdd={addSlot(setTeamB)}
              accent="team-red"
            />
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

          {showBetOpen && (
            <BetOpenModal
              onClose={() => setShowBetOpen(false)}
              onOpen={openBetting}
              playerCount={
                teamA.filter((n) => n.trim()).length + teamB.filter((n) => n.trim()).length
              }
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
                onUseTeams={applyTeams}
                recent={recentPeople}
              />
            </Modal>
          )}
        </>
      )}

      <section className="sr-history">
        <h2>
          최근 기록<span className="panel-count">{history.length}경기</span>
        </h2>
        {history.length === 0 ? (
          <p className="rank-blank">아직 기록된 경기가 없어요.</p>
        ) : (
          <ul className="history-list">
            {history.map((m) => (
              <li key={m.id}>
                <span className="hist-time">{timeAgo(m.playedAt)}</span>
                <span className="hist-teams">
                  <span className={m.winner === 'A' ? 'hist-winner' : ''}>
                    {m.teamA.join(', ')}
                  </span>
                  <span className="hist-vs">vs</span>
                  <span className={m.winner === 'B' ? 'hist-winner' : ''}>
                    {m.teamB.join(', ')}
                  </span>
                </span>
                {canEdit && (
                  <button
                    className="row-del"
                    onClick={() => deleteMatch(m)}
                    aria-label="기록 삭제"
                  >
                    <FaTimes />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

export default ScrimRecord;
