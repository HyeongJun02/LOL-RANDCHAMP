import React, { useEffect, useState } from 'react';
import { FaBroadcastTower } from 'react-icons/fa';
import { riotGet, champIconUrl, loadGameData } from '../../server/riot';
import {
  queueName,
  clock,
  tierText,
  tierIconOf,
  winRate,
  tierScore,
  tierFromScore,
  positionName,
} from '../../rules/riot';
import { guessLiveLanes, LIVE_POS } from '../../rules/riotStats';
import { lanesOf } from '../../rules/champLanes';
import { Lane } from './RiotBits';
import { useAliasOf } from './useRiotFavs';

/* 지금 게임 중. 관전 API는 게임 시작 3분 뒤부터 잡힌다.
   한 줄에 한 명: 챔피언 · 소환사 주문 · 룬 · 이름(누르면 그 사람) · 랭크 · 승률.
   랭크는 따로 받는다(열 명이라 요청이 열 개) - 프로필이 그만큼 늦어지지 않게 */

const TEAMS = [
  [100, '블루팀', 'is-blue'],
  [200, '레드팀', 'is-red'],
];

/* 1초마다 경과 시간을 올린다. 게임 시작 시각은 서버가 준다 */
const useElapsed = (start, length) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return start ? Math.max(0, (now - start) / 1000) : length;
};

const Icon = ({ item, size = 18 }) =>
  item ? (
    <img src={item.icon} alt={item.name} title={item.name} width={size} height={size} />
  ) : (
    <i style={{ width: size, height: size }} />
  );

const LiveGame = ({ g, champs, me, onSearch }) => {
  const elapsed = useElapsed(g.start, g.length);
  const aliasOf = useAliasOf();
  const [data, setData] = useState(null);
  const [ranks, setRanks] = useState({});

  useEffect(() => {
    let alive = true;
    loadGameData(champs?.version).then((x) => alive && setData(x));
    return () => {
      alive = false;
    };
  }, [champs?.version]);

  const puuids = g.players.filter((p) => !p.bot && p.puuid).map((p) => p.puuid).join(',');
  useEffect(() => {
    if (!puuids) return undefined;
    let alive = true;
    riotGet({ fn: 'liveRanks', puuids }).then((r) => alive && r.data && setRanks(r.data));
    return () => {
      alive = false;
    };
  }, [puuids]);

  /* 라인은 관전 API에 없다. 강타 · 챔피언 주 라인으로 추정한다 (rules/riotStats.js).
     소환사의 협곡 5대5에서만 - 칼바람 · 아레나는 라인이 없다 */
  const laned = g.mode === 'CLASSIC';
  const lanes = {};
  if (laned) {
    [100, 200].forEach((team) =>
      Object.assign(
        lanes,
        guessLiveLanes(
          g.players.filter((p) => p.team === team),
          (p) => lanesOf(champs?.byKey.get(p.champId)?.id)
        )
      )
    );
  }
  const laneOrder = (p) => (lanes[p.puuid] ? LIVE_POS.indexOf(lanes[p.puuid]) : 9);

  /* 팀 평균 티어. 랭크가 없는 사람은 빼고 센다 */
  const avgTier = (team) => {
    const scores = g.players
      .filter((p) => p.team === team)
      .map((p) => ranks[p.puuid])
      .filter(Boolean)
      .map((r) => tierScore(r.tier, r.rank))
      .filter((x) => x != null);
    return scores.length ? tierFromScore(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };

  return (
    <section className="riot-panel riot-live">
      <h2 className="riot-h">
        <FaBroadcastTower /> 지금 게임 중
        <em className="riot-h-sub">
          {queueName(g.queue, g.mode)} · <time className="riot-live-clock">{clock(elapsed)}</time>
        </em>
        {Object.keys(lanes).length > 0 && (
          <em className="riot-live-note" title="관전 정보에는 라인이 없어서 강타와 챔피언 주 라인으로 짐작했어요">
            라인은 추정
          </em>
        )}
      </h2>
      <div className="riot-live-teams">
        {TEAMS.map(([team, label, tone]) => {
          const bans = g.bans.filter((b) => b.team === team && b.champId > 0);
          const avg = avgTier(team);
          return (
            <div key={team} className={`riot-live-team ${tone}`}>
              <div className="riot-live-head">
                <strong>{label}</strong>
                {avg && <span>평균 {avg}</span>}
                {bans.length > 0 && (
                  <span className="riot-live-bans">
                    밴
                    {bans.map((b, i) => {
                      const c = champs?.byKey.get(b.champId);
                      return c ? (
                        <img key={i} src={champIconUrl(champs.version, c.id)} alt={c.name} title={c.name} />
                      ) : null;
                    })}
                  </span>
                )}
              </div>
              <ul>
                {g.players
                  .filter((p) => p.team === team)
                  .sort((a, b) => laneOrder(a) - laneOrder(b))
                  .map((p) => {
                    const c = champs?.byKey.get(p.champId);
                    const r = ranks[p.puuid];
                    const tierIcon = r && tierIconOf(r.tier);
                    const rate = r && winRate(r.wins, r.losses);
                    const [nick, tag] = p.name.split('#');
                    return (
                      <li key={p.puuid || p.name} className={p.puuid === me ? 'is-me' : ''}>
                        <span
                          className="riot-live-lane"
                          title={lanes[p.puuid] ? `${positionName(lanes[p.puuid])} (추정)` : ''}
                        >
                          <Lane pos={lanes[p.puuid]} iconOnly />
                        </span>
                        <span className="riot-live-champ" title={c?.name || ''}>
                          {c && <img src={champIconUrl(champs.version, c.id)} alt="" />}
                        </span>
                        <span className="riot-live-kit" aria-label="소환사 주문 · 룬">
                          <Icon item={data?.spells.get(p.spells[0])} />
                          <Icon item={data?.runes.get(p.keystone)} />
                          <Icon item={data?.spells.get(p.spells[1])} />
                          <Icon item={data?.runes.get(p.runeSub)} />
                        </span>
                        <span className="riot-live-who">
                          {p.bot || !tag ? (
                            <span className="riot-muted-name">{nick || '?'}</span>
                          ) : (
                            <button type="button" className="riot-link" onClick={() => onSearch(p.name)}>
                              {nick}
                              <em>#{tag}</em>
                            </button>
                          )}
                          <em className="riot-live-sub">
                            {c?.name || ''}
                            {aliasOf(p.name) && <b className="riot-alias">{aliasOf(p.name)}</b>}
                          </em>
                        </span>
                        <span className="riot-live-rank">
                          {tierIcon ? <img src={tierIcon} alt="" /> : <i />}
                          <span>
                            <b>{r ? tierText(r.tier, r.rank) : '언랭'}</b>
                            {r && (
                              <em>
                                {r.lp}LP · {rate != null ? `${rate}%` : '-'}
                                <small> ({r.wins + r.losses}판)</small>
                              </em>
                            )}
                          </span>
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LiveGame;
