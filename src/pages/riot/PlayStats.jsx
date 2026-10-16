import React, { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { positionName, winRate } from '../../rules/riot';
import { Champ, Lane, champName } from './RiotBits';
import { useAliasOf } from './useRiotFavs';

/* 지금 고른 큐의 받아 둔 판들로 셈한 것 (rules/riotStats.js의 summarize).
   숫자 몇 개는 늘 보이고, 챔피언 · 라인 · 같이 한 사람은 펼쳐서 본다 -
   휴대폰에서 매치 목록이 한참 밀려나지 않게 */

const fmt = (n, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : '-');

const Tile = ({ label, value, sub }) => (
  <div className="riot-tile">
    <span>{label}</span>
    <b>{value}</b>
    {sub && <em>{sub}</em>}
  </div>
);

const Rate = ({ wins, games }) => {
  const r = winRate(wins, games - wins);
  return (
    <span className={`riot-rate ${r >= 60 ? 'is-hot' : r < 40 ? 'is-cold' : ''}`}>
      {wins}승 {games - wins}패 · {r}%
    </span>
  );
};

const PlayStats = ({ s, champs, onSearch }) => {
  const [open, setOpen] = useState(false);
  const aliasOf = useAliasOf();
  if (!s) return null;
  const { avg } = s;

  return (
    <section className="riot-stats" aria-label="최근 판 분석">
      <div className="riot-stats-head">
        <strong>
          {s.games}판 {s.wins}승 {s.games - s.wins}패 <em>{s.rate}%</em>
        </strong>
        {s.streak.count >= 2 && (
          <span className={`riot-streak ${s.streak.win ? 'is-win' : 'is-lose'}`}>
            {s.streak.count}연{s.streak.win ? '승' : '패'} 중
          </span>
        )}
        <button type="button" className="riot-fold riot-stats-toggle" onClick={() => setOpen((v) => !v)}>
          분석 {open ? '접기' : '펼치기'}
          <FaChevronDown className={`riot-chev ${open ? 'is-open' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <div className="riot-tiles">
        <Tile
          label="평균 KDA"
          value={avg.kda == null ? 'Perfect' : fmt(avg.kda, 2)}
          sub={`${fmt(avg.k)} / ${fmt(avg.d)} / ${fmt(avg.a)}`}
        />
        <Tile label="킬 관여" value={`${avg.kp}%`} />
        <Tile label="분당 CS" value={fmt(avg.csPerMin)} />
        <Tile label="분당 피해" value={Math.round(avg.dmgPerMin).toLocaleString()} />
        <Tile label="분당 시야" value={fmt(avg.visionPerMin, 2)} />
        <Tile
          label="MVP · ACE"
          value={`${s.mvp} · ${s.ace}`}
          sub={
            s.multi.penta
              ? `펜타킬 ${s.multi.penta}`
              : s.multi.quadra
                ? `쿼드라킬 ${s.multi.quadra}`
                : s.multi.triple
                  ? `트리플킬 ${s.multi.triple}`
                  : null
          }
        />
      </div>

      {open && (
        <div className="riot-stats-lists">
          <div>
            <h3 className="riot-label">많이 한 챔피언</h3>
            <ul>
              {s.champs.slice(0, 5).map((c) => (
                <li key={c.key}>
                  <Champ champs={champs} name={c.key} size="xs" />
                  <span className="riot-stats-name">{champName(champs, c.key)}</span>
                  <Rate wins={c.wins} games={c.games} />
                  <em>{c.d === 0 ? 'Perfect' : ((c.k + c.a) / c.d).toFixed(2)}</em>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="riot-label">라인</h3>
            <ul>
              {s.lanes.map((l) => (
                <li key={l.key}>
                  <Lane pos={l.key} iconOnly />
                  <span className="riot-stats-name">{positionName(l.key)}</span>
                  <Rate wins={l.wins} games={l.games} />
                </li>
              ))}
              {s.lanes.length === 0 && <li className="riot-muted">라인이 없는 판들이에요.</li>}
            </ul>
          </div>
          <div>
            <h3 className="riot-label">같이 자주 한 사람</h3>
            <ul>
              {s.mates.slice(0, 5).map((m) => (
                <li key={m.id}>
                  <button type="button" className="riot-link riot-stats-name" onClick={() => onSearch(m.id)}>
                    {m.name}
                    {aliasOf(m.id) && <em className="riot-alias">{aliasOf(m.id)}</em>}
                  </button>
                  <Rate wins={m.wins} games={m.games} />
                </li>
              ))}
              {s.mates.length === 0 && <li className="riot-muted">두 번 이상 같은 팀이었던 사람이 없어요.</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};

export default PlayStats;
