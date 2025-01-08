import React, { useState } from 'react';
import './RandomLine.css';

const LINES = [
  { name: '탑', icon: '/line_icon/top_gold.svg' },
  { name: '정글', icon: '/line_icon/jungle_gold.svg' },
  { name: '미드', icon: '/line_icon/mid_gold.svg' },
  { name: '원딜', icon: '/line_icon/adc_gold.webp' },
  { name: '서폿', icon: '/line_icon/support_gold.svg' },
];

const RandomLine = () => {
  const [players, setPlayers] = useState([
    { name: '', disabledLines: [], fixedLine: null },
  ]);

  // 플레이어 추가
  const addPlayer = () => {
    if (players.length < 5) {
      setPlayers([
        ...players,
        { name: '', disabledLines: [], fixedLine: null },
      ]);
    } else {
      alert('최대 5명의 플레이어만 가능합니다.');
    }
  };

  // 플레이어 삭제
  const removePlayer = (index) => {
    const updatedPlayers = [...players];
    updatedPlayers.splice(index, 1);
    setPlayers(updatedPlayers);
  };

  // 플레이어 이름 변경
  const updatePlayerName = (index, newName) => {
    const updatedPlayers = [...players];
    updatedPlayers[index].name = newName;
    setPlayers(updatedPlayers);
  };

  // 라인 온/오프 토글
  const toggleLine = (playerIndex, lineName) => {
    const updatedPlayers = [...players];
    const disabledLines = updatedPlayers[playerIndex].disabledLines;

    if (disabledLines.includes(lineName)) {
      // 이미 제외된 라인을 다시 활성화
      updatedPlayers[playerIndex].disabledLines = disabledLines.filter(
        (line) => line !== lineName
      );
    } else {
      // 제외 가능한 라인의 개수를 체크하여 제한
      const remainingLines = LINES.filter(
        (line) => !disabledLines.includes(line) && line !== lineName
      );
      const availableLinesForOthers = players.reduce(
        (acc, player, i) =>
          i !== playerIndex
            ? acc.filter((line) => !player.disabledLines.includes(line))
            : acc,
        LINES
      );

      if (
        remainingLines.length <= 1 ||
        availableLinesForOthers.length <= players.length - 1
      ) {
        alert('라인을 너무 많이 제외할 수 없습니다.');
        return;
      }

      // 새 라인 제외 추가
      updatedPlayers[playerIndex].disabledLines.push(lineName);
    }

    setPlayers(updatedPlayers);
  };

  // 랜덤 배정
  const assignLines = () => {
    const availableLines = LINES.map((line) => line.name);
    const tempAssignedLines = [];

    // 고정된 라인 먼저 배정
    for (let player of players) {
      if (player.fixedLine) {
        if (availableLines.includes(player.fixedLine)) {
          tempAssignedLines.push({
            name: player.name || '플레이어',
            line: player.fixedLine,
          });
          availableLines.splice(availableLines.indexOf(player.fixedLine), 1);
        } else {
          alert(`고정된 라인 "${player.fixedLine}"은 이미 선택되었습니다.`);
          return;
        }
      }
    }

    // 나머지 플레이어에게 랜덤 배정
    for (let player of players) {
      if (!player.fixedLine) {
        const possibleLines = availableLines.filter(
          (line) => !player.disabledLines.includes(line)
        );
        if (possibleLines.length === 0) {
          alert('할당할 수 있는 라인이 부족합니다.');
          return;
        }
        const randomLine =
          possibleLines[Math.floor(Math.random() * possibleLines.length)];
        tempAssignedLines.push({
          name: player.name || '플레이어',
          line: randomLine,
        });
        availableLines.splice(availableLines.indexOf(randomLine), 1);
      }
    }

    console.log('라인 배정 결과:', tempAssignedLines);
    alert(tempAssignedLines.map((p) => `${p.name}: ${p.line}`).join('\n'));
  };

  return (
    <div className="random-line-container">
      <div className="player-cards">
        {players.map((player, index) => (
          <div key={index} className="player-card">
            <button
              className="remove-player-button"
              onClick={() => removePlayer(index)}
            >
              ×
            </button>
            <input
              type="text"
              placeholder={`플레이어 ${index + 1}`}
              value={player.name}
              onChange={(e) => updatePlayerName(index, e.target.value)}
              className="player-name-input"
            />
            <div className="line-options">
              {LINES.map((line) => (
                <div
                  key={line.name}
                  className={`line-option ${
                    player.disabledLines.includes(line.name) ? 'disabled' : ''
                  }`}
                  onClick={() => toggleLine(index, line.name)}
                >
                  <img src={line.icon} alt={line.name} className="line-icon" />
                  <span>{line.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {players.length < 5 && (
          <button onClick={addPlayer} className="add-player-button">
            +
          </button>
        )}
      </div>
      <button onClick={assignLines} className="assign-lines-button">
        라인 랜덤 배정
      </button>
    </div>
  );
};

export default RandomLine;
