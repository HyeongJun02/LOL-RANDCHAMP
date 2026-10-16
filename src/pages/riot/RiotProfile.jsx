import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaSyncAlt,
  FaUserSlash,
  FaTrophy,
  FaStar,
  FaRegStar,
  FaBroadcastTower,
  FaMedal,
} from 'react-icons/fa';
import Empty from '../../components/common/Empty';
import { riotGet, champIconUrl, profileIconUrl } from '../../server/riot';
import {
  errorText,
  LEAGUE_QUEUES,
  tierText,
  winRate,
  queueName,
  clock,
  CHALLENGE_CATEGORIES,
  tierName,
  denied,
  tierIconOf,
} from '../../rules/riot';
import RiotPart from './RiotPart';
import MatchList from './MatchList';
import MatchDetail from './MatchDetail';
import TftList from './TftList';
import { AliasInput } from './FavPanel';
import { useAliasOf } from './useRiotFavs';

/* 라이엇 ID 하나로 보는 것 전부. 서버 함수가 한 번에 모아 준다(api/_riot.js의
   profile). 매치 상세는 목록에서 한 판씩 따로 받는다 - 한 판이 커서 */

const LeagueCard = ({ l }) => {
  const rate = winRate(l.wins, l.losses);
  const icon = tierIconOf(l.tier);
  return (
    <div className={`riot-league tier-${(l.tier || 'none').toLowerCase()}`}>
      {/* public/lol_tier_icon. 없는 등급(TFT 더블업의 등급 등)은 빈 자리 */}
      {icon ? <img className="riot-league-icon" src={icon} alt="" /> : <span className="riot-league-icon" />}
      <span className="riot-league-text">
        <span className="riot-label">{LEAGUE_QUEUES[l.queue] || l.queue}</span>
        <strong>{l.rated ? `${l.rated}` : tierText(l.tier, l.rank)}</strong>
        <span className="riot-league-meta">
          {!l.rated && <b>{l.lp} LP</b>}
          <span>
            {l.wins}승 {l.losses}패{rate != null && ` · ${rate}%`}
          </span>
          {l.hot && <em className="riot-hot">연승 중</em>}
        </span>
      </span>
    </div>
  );
};

/* 지금 게임 중. 관전 API는 게임 시작 3분 뒤부터 잡힌다 */
const LiveGame = ({ g, champs, me }) => {
  const aliasOf = useAliasOf();
  const elapsed = g.start ? Math.max(0, (Date.now() - g.start) / 1000) : g.length;
  return (
    <section className="riot-panel riot-live">
      <h2 className="riot-h">
        <FaBroadcastTower /> 지금 게임 중
        <em className="riot-h-sub">
          {queueName(g.queue, g.mode)} · {clock(elapsed)}
        </em>
      </h2>
      <div className="riot-live-teams">
        {[100, 200].map((team) => (
          <ul key={team} className={`riot-live-team ${team === 100 ? 'is-blue' : 'is-red'}`}>
            {g.players
              .filter((p) => p.team === team)
              .map((p) => {
                const c = champs?.byKey.get(p.champId);
                return (
                  <li key={p.puuid || p.name} className={p.puuid === me ? 'is-me' : ''}>
                    {c && <img src={champIconUrl(champs.version, c.id)} alt="" />}
                    <span className="riot-live-name">
                      {p.name || '?'}
                      {aliasOf(p.name) && <em className="riot-alias">{aliasOf(p.name)}</em>}
                    </span>
                    <em>{c?.name || ''}</em>
                  </li>
                );
              })}
          </ul>
        ))}
      </div>
    </section>
  );
};

const RiotProfile = ({ id, champs, onFound, onSearch, favs }) => {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState('lol');
  /* 게임 상세 탭이 볼 판. 안 고르면 목록의 맨 위 판 */
  const [detailId, setDetailId] = useState(null);
  const [listIds, setListIds] = useState([]);
  /* 새로고침하면 매치 목록도 처음부터 다시 받는다 */
  const [rev, setRev] = useState(0);
  const mainRef = useRef(null);

  const openDetail = useCallback((matchId) => {
    setDetailId(matchId);
    setTab('detail');
    mainRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

  const load = useCallback(
    (fresh = false) => {
      setBusy(true);
      riotGet({ fn: 'profile', name: id.name, tag: id.tag }, { fresh }).then((r) => {
        setRes(r);
        setBusy(false);
        if (r.data) onFound(`${r.data.account.name}#${r.data.account.tag}`);
      });
    },
    // onFound는 부모가 렌더마다 새로 만든다. id가 바뀔 때만 다시 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id.name, id.tag]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (busy && !res) return <div className="riot-loading">불러오는 중…</div>;
  if (res.error !== undefined) {
    return (
      <section className="riot-panel">
        <Empty
          icon={<FaUserSlash />}
          title={res.error === 404 ? '그런 라이엇 ID가 없어요' : '불러오지 못했어요'}
          desc={
            res.error === 404
              ? `${id.name}#${id.tag} - 이름과 태그를 다시 확인해 주세요. 태그는 # 뒤의 글자입니다.`
              : errorText(res.error)
          }
          action={
            res.error !== 404 && (
              <button className="ghost-btn" onClick={() => load(true)}>
                <FaSyncAlt /> 다시 시도
              </button>
            )
          }
        />
      </section>
    );
  }

  const d = res.data;
  const me = d.account.puuid;
  const riotId = `${d.account.name}#${d.account.tag}`;
  const icon = profileIconUrl(champs?.version, d.summoner.data?.icon);
  const leagues = [...(d.leagues.data || []), ...(d.tftLeagues.data || [])];

  return (
    <div className="riot-profile">
      <section className="riot-panel riot-head">
        {icon ? <img className="riot-avatar" src={icon} alt="" /> : <span className="riot-avatar" />}
        <div className="riot-head-text">
          <h2>
            {d.account.name}
            <em>#{d.account.tag}</em>
          </h2>
          {d.summoner.data && <span className="riot-muted">레벨 {d.summoner.data.level}</span>}
          {/* 즐겨찾기에 있으면 별명을 바로 적을 수 있다 */}
          {favs.has(riotId) && (
            <AliasInput
              key={riotId}
              value={favs.aliasOf(riotId)}
              onSave={(a) => favs.setAlias(riotId, a)}
              className="is-head"
            />
          )}
        </div>
        <button
          type="button"
          className={`riot-star ${favs.has(riotId) ? 'is-on' : ''}`}
          onClick={() => (favs.has(riotId) ? favs.remove(riotId) : favs.add(riotId))}
          aria-pressed={favs.has(riotId)}
          title={favs.loggedIn ? '즐겨찾기' : '로그인하면 즐겨찾기를 쓸 수 있어요'}
        >
          {favs.has(riotId) ? <FaStar /> : <FaRegStar />}
          즐겨찾기
        </button>
        <button
          className="ghost-btn"
          onClick={() => {
            load(true);
            setRev((r) => r + 1);
          }}
          disabled={busy}
        >
          <FaSyncAlt /> {busy ? '불러오는 중' : '새로고침'}
        </button>
      </section>

      {d.live.data && <LiveGame g={d.live.data} champs={champs} me={me} />}

      <div className="riot-cols">
        <aside className="riot-side">
          <section className="riot-panel">
            <h2 className="riot-h">
              <FaTrophy /> 랭크
            </h2>
            {d.leagues.error !== undefined && d.tftLeagues.error !== undefined ? (
              <p className="riot-muted">{errorText(d.leagues.error)}</p>
            ) : leagues.length === 0 ? (
              <p className="riot-muted">이번 시즌 랭크 기록이 없어요.</p>
            ) : (
              <div className="riot-leagues">
                {leagues.map((l) => (
                  <LeagueCard key={l.queue} l={l} />
                ))}
              </div>
            )}
          </section>

          {!denied(d.mastery) && (
          <section className="riot-panel">
            <h2 className="riot-h">
              <FaStar /> 챔피언 숙련도
            </h2>
            <RiotPart part={d.mastery} empty="숙련도 기록이 없어요.">
              {(list) => (
                <ul className="riot-mastery">
                  {list.map((m) => {
                    const c = champs?.byKey.get(m.champId);
                    return (
                      <li key={m.champId}>
                        {c && <img src={champIconUrl(champs.version, c.id)} alt="" loading="lazy" />}
                        <span className="riot-mastery-name">{c?.name || `#${m.champId}`}</span>
                        <em>Lv.{m.level}</em>
                        <b>{m.points.toLocaleString()}</b>
                      </li>
                    );
                  })}
                </ul>
              )}
            </RiotPart>
          </section>

          )}

          {!denied(d.challenges) && (
          <section className="riot-panel">
            <h2 className="riot-h">
              <FaMedal /> 도전 과제
            </h2>
            <RiotPart part={d.challenges}>
              {(ch) => (
                <div className="riot-chal">
                  {ch.total && (
                    <div className="riot-chal-total">
                      <strong>{tierName(ch.total.level)}</strong>
                      <span>
                        {ch.total.current.toLocaleString()} / {ch.total.max.toLocaleString()}점
                        {ch.total.percentile != null &&
                          ` · 상위 ${(ch.total.percentile * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  )}
                  {ch.categories.length > 0 && (
                    <div className="riot-tags">
                      {ch.categories.map((c) => (
                        <span key={c.key} className="riot-tag">
                          {CHALLENGE_CATEGORIES[c.key] || c.key} · {tierName(c.level)}
                        </span>
                      ))}
                    </div>
                  )}
                  {ch.top.length > 0 && (
                    <ul className="riot-chal-top">
                      {ch.top.map((c) => (
                        <li key={c.id}>
                          <span>{c.name}</span>
                          <em>
                            {tierName(c.level)} · 상위 {(c.percentile * 100).toFixed(1)}%
                          </em>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </RiotPart>
          </section>
          )}
        </aside>

        <section className="riot-panel riot-main" ref={mainRef}>
          {/* 최근 매치 | 게임 상세 | TFT (TFT 권한이 없는 키면 TFT 탭은 없다) */}
          <div className="seg-tabs riot-tabs">
            <button className={`seg-tab ${tab === 'lol' ? 'active' : ''}`} onClick={() => setTab('lol')}>
              최근 매치
            </button>
            <button
              className={`seg-tab ${tab === 'detail' ? 'active' : ''}`}
              onClick={() => setTab('detail')}
            >
              게임 상세
            </button>
            {!denied(d.tftMatches) && (
              <button className={`seg-tab ${tab === 'tft' ? 'active' : ''}`} onClick={() => setTab('tft')}>
                TFT <em className="riot-beta">베타</em>
              </button>
            )}
          </div>

          {/* 목록은 탭을 옮겨도 내려두지 않고 숨긴다. 내리면 고른 큐 · 더 받은 판이
              전부 날아가서, 상세를 보고 돌아올 때마다 처음부터 다시 받는다 */}
          <div hidden={tab !== 'lol'}>
            <MatchList
              key={rev}
              puuid={me}
              me={me}
              champs={champs}
              onSearch={onSearch}
              onDetail={openDetail}
              onLoaded={setListIds}
              fresh={rev > 0}
            />
          </div>
          {tab === 'detail' && (
            <MatchDetail
              id={detailId || listIds[0] || null}
              ids={listIds}
              me={me}
              champs={champs}
              onSearch={onSearch}
              onPick={setDetailId}
            />
          )}
          {tab === 'tft' && (
            <RiotPart part={d.tftMatches} empty="최근 TFT 매치가 없어요.">
              {/* TFT는 키가 따로라 puuid도 따로다 (api/_riot.js profile) */}
              {(ids) => <TftList ids={ids} me={d.account.tftPuuid || me} onSearch={onSearch} />}
            </RiotPart>
          )}
        </section>
      </div>
    </div>
  );
};

export default RiotProfile;
