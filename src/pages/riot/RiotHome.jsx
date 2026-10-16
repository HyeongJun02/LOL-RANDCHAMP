import React, { useCallback, useEffect, useState } from 'react';
import { FaSyncAlt, FaServer, FaCrown, FaGift } from 'react-icons/fa';
import { riotGet, champIconUrl } from '../../server/riot';
import { errorText, denied } from '../../rules/riot';
import { timeAgo } from '../../lib/timeAgo';
import RiotPart from './RiotPart';

/* 사람을 안 찾았을 때 보이는 오늘의 정보.
   서버 함수가 한 번에 모아 주고 10분 캐시한다 (api/_riot.js의 home) */

const STATUS_GAMES = [
  ['lol', '리그 오브 레전드'],
  ['tft', 'TFT'],
  ['val', '발로란트'],
];

const RankList = ({ rows, value, onSearch }) => (
  <ol className="riot-rank-list">
    {rows.map((r, i) => (
      <li key={`${r.name}${r.tag}${i}`}>
        <span className="riot-rank-no">{r.rank ?? i + 1}</span>
        {r.name && r.tag ? (
          <button type="button" className="riot-link" onClick={() => onSearch(`${r.name}#${r.tag}`)}>
            {r.name}
            <em>#{r.tag}</em>
          </button>
        ) : (
          <span className="riot-muted-name">{r.name || '이름 비공개'}</span>
        )}
        <span className="riot-rank-val">{value(r)}</span>
      </li>
    ))}
  </ol>
);

const RiotHome = ({ champs, onSearch }) => {
  const [home, setHome] = useState(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback((fresh = false) => {
    setBusy(true);
    riotGet({ fn: 'home' }, { fresh }).then((r) => {
      setHome(r);
      setBusy(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (busy && !home) return <div className="riot-loading">불러오는 중…</div>;
  if (home?.error !== undefined) {
    return (
      <section className="riot-panel">
        <p className="riot-muted">{errorText(home.error)}</p>
        <button className="ghost-btn" onClick={() => load(true)}>
          <FaSyncAlt /> 다시 시도
        </button>
      </section>
    );
  }
  const d = home.data;
  const champ = (key) => champs?.byKey.get(key);

  return (
    <div className="riot-home">
      {/* 서버 상태. 점검이나 장애가 있을 때만 눈에 띄게 */}
      <section className="riot-panel">
        <h2 className="riot-h">
          <FaServer /> 서버 상태
          <button
            className="riot-refresh"
            onClick={() => load(true)}
            disabled={busy}
            aria-label="새로고침"
            title="새로고침"
          >
            <FaSyncAlt />
          </button>
        </h2>
        <div className="riot-status">
          {STATUS_GAMES.filter(([k]) => !denied(d.status[k])).map(([k, label]) => {
            const part = d.status[k];
            const issues = part.data || [];
            const tone = part.error !== undefined ? 'is-unknown' : issues.length ? 'is-issue' : 'is-ok';
            return (
              <div key={k} className={`riot-status-card ${tone}`}>
                <strong>{label}</strong>
                <span className="riot-status-state">
                  {part.error !== undefined
                    ? '확인 불가'
                    : issues.length
                      ? `알림 ${issues.length}건`
                      : '정상'}
                </span>
                {issues.length > 0 && (
                  <ul>
                    {issues.slice(0, 3).map((x, i) => (
                      <li key={i}>
                        {x.kind === 'maintenance' ? '점검' : '장애'} · {x.title || '내용 없음'}
                        {x.at && <em>{timeAgo(new Date(x.at).getTime())}</em>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="riot-panel">
        <h2 className="riot-h">
          <FaGift /> 이번 주 무료 챔피언
        </h2>
        <RiotPart part={d.rotation}>
          {(r) => (
            <>
              <div className="riot-champ-grid">
                {r.ids.map((key) => {
                  const c = champ(key);
                  return (
                    <span key={key} className="riot-champ" title={c?.title || ''}>
                      {c && <img src={champIconUrl(champs.version, c.id)} alt="" loading="lazy" />}
                      <em>{c?.name || `#${key}`}</em>
                    </span>
                  );
                })}
              </div>
              {r.newbieLevel != null && (
                <p className="riot-muted">
                  소환사 레벨 {r.newbieLevel} 이하는 따로 {r.newbie.length}개 챔피언을 무료로 씁니다.
                </p>
              )}
            </>
          )}
        </RiotPart>
      </section>

      <div className="riot-rank-grid">
        <section className="riot-panel">
          <h2 className="riot-h">
            <FaCrown /> 솔로 랭크 챌린저
          </h2>
          <RiotPart part={d.challenger}>
            {(rows) => (
              <RankList rows={rows} onSearch={onSearch} value={(r) => `${r.lp.toLocaleString()} LP`} />
            )}
          </RiotPart>
        </section>

        {!denied(d.tftChallenger) && (
        <section className="riot-panel">
          <h2 className="riot-h">
            <FaCrown /> TFT 챌린저
          </h2>
          <RiotPart part={d.tftChallenger}>
            {(rows) => (
              <RankList rows={rows} onSearch={onSearch} value={(r) => `${r.lp.toLocaleString()} LP`} />
            )}
          </RiotPart>
        </section>
        )}

        {!denied(d.valorant.leaderboard) && (
        <section className="riot-panel">
          <h2 className="riot-h">
            <FaCrown /> 발로란트 리더보드
            {d.valorant.content.data?.act && <em className="riot-h-sub">{d.valorant.content.data.act}</em>}
          </h2>
          <RiotPart part={d.valorant.leaderboard}>
            {(rows) => (
              <RankList rows={rows} onSearch={() => {}} value={(r) => `${r.rating} RR`} />
            )}
          </RiotPart>
        </section>
        )}
      </div>

      {!denied(d.valorant.content) && (
      <section className="riot-panel">
        <h2 className="riot-h">발로란트 요원 · 맵</h2>
        <RiotPart part={d.valorant.content}>
          {(c) => (
            <div className="riot-val">
              <div>
                <span className="riot-label">요원 {c.agents.length}</span>
                <div className="riot-tags">
                  {c.agents.map((a) => (
                    <span key={a} className="riot-tag">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="riot-label">맵 {c.maps.length}</span>
                <div className="riot-tags">
                  {c.maps.map((m) => (
                    <span key={m} className="riot-tag">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </RiotPart>
      </section>
      )}
    </div>
  );
};

export default RiotHome;
