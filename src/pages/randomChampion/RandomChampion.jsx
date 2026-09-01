import React, { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { fetchChampionData, championIcon } from '../../services/api';
import { ROLES } from './roles';
import { LINES } from '../../lines';
import { LANE_META, countUnclassified } from '../../champLanes';
import { filterChampions } from './filter';
import ResultPanel from './ResultPanel';
import PageHeader from '../../components/common/PageHeader';
import './RandomChampion.css';

const ROLL_TICKS = 16;
const ROLL_INTERVAL = 70;

const RandomChampion = () => {
  const [version, setVersion] = useState('');
  const [champions, setChampions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [roles, setRoles] = useState([]);
  const [lanes, setLanes] = useState([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [rolling, setRolling] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    fetchChampionData()
      .then((data) => {
        setVersion(data.version);
        setChampions(data.champions);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));

    return () => clearInterval(timer.current);
  }, []);

  const filtered = useMemo(
    () => filterChampions(champions, roles, query, lanes),
    [champions, roles, query, lanes]
  );

  const toggle = (setter) => (value) =>
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );

  const toggleRole = toggle(setRoles);
  const toggleLane = toggle(setLanes);
  const unclassified = countUnclassified(champions);

  const pick = () => filtered[Math.floor(Math.random() * filtered.length)];

  const roll = () => {
    if (timer.current) return;
    if (filtered.length === 0) {
      toast.error('조건에 맞는 챔피언이 없어요.');
      return;
    }

    setPicked(null);
    let ticks = 0;
    timer.current = setInterval(() => {
      if (++ticks >= ROLL_TICKS) {
        clearInterval(timer.current);
        timer.current = null;
        setRolling(null);
        setPicked(pick());
        return;
      }
      setRolling(pick());
    }, ROLL_INTERVAL);
  };

  const hasFilter = roles.length > 0 || lanes.length > 0 || query !== '';

  return (
    <div className="page champ-page">
      <PageHeader
        title="챔피언 랜덤 선택"
        sub="역할군으로 거르고 주사위를 굴리세요. 챔피언을 눌러 직접 골라도 됩니다."
      />

      <div className="champ-toolbar">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="챔피언 검색"
          />
        </div>

        <div className="role-chips">
          {ROLES.map(({ role, icon, label }) => (
            <button
              key={role}
              className={`role-chip ${roles.includes(role) ? 'active' : ''}`}
              onClick={() => toggleRole(role)}
            >
              <img src={icon} alt="" />
              {label}
            </button>
          ))}
        </div>

        <div className="toolbar-tail">
          <span className="champ-count">
            <strong>{filtered.length}</strong> / {champions.length}
          </span>
          <button
            className="reset-btn"
            disabled={!hasFilter}
            onClick={() => {
              setRoles([]);
              setLanes([]);
              setQuery('');
            }}
          >
            <FaTimes /> 초기화
          </button>
        </div>
      </div>

      <div className="lane-bar">
        <span className="lane-bar-label">라인</span>
        <div className="lane-chips">
          {LINES.map((l) => (
            <button
              key={l.name}
              className={`lane-chip ${lanes.includes(l.name) ? 'active' : ''}`}
              onClick={() => toggleLane(l.name)}
            >
              <img src={l.icon} alt="" />
              {l.name}
            </button>
          ))}
        </div>
        <span className="lane-source" title={LANE_META.note}>
          비공식 · {LANE_META.author} 분류 · {LANE_META.updatedAt} 기준
          {lanes.length > 0 && unclassified > 0 && ` · 미분류 ${unclassified}명 제외`}
        </span>
      </div>

      <div className="champ-layout">
        <main className="champ-main">
          {status === 'loading' && (
            <div className="champ-grid">
              {Array.from({ length: 30 }, (_, i) => (
                <div key={i} className="champ-tile is-skeleton" />
              ))}
            </div>
          )}

          {status === 'error' && (
            <p className="champ-message">
              챔피언 정보를 불러오지 못했어요. 새로고침해 주세요.
            </p>
          )}

          {status === 'ready' && filtered.length === 0 && (
            <p className="champ-message">조건에 맞는 챔피언이 없습니다.</p>
          )}

          {status === 'ready' && filtered.length > 0 && (
            <div className="champ-grid">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  className={`champ-tile ${picked?.id === c.id ? 'is-picked' : ''}`}
                  onClick={() => setPicked(c)}
                  title={`${c.name} · ${c.title}`}
                >
                  <img src={championIcon(version, c.id)} alt="" loading="lazy" />
                  <span className="champ-name">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </main>

        <ResultPanel
          champion={picked}
          rolling={rolling}
          version={version}
          onRoll={roll}
          poolSize={filtered.length}
        />
      </div>
    </div>
  );
};

export default RandomChampion;
