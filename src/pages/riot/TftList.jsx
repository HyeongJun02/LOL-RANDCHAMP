import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { riotGet, loadTftData, tftLookup } from '../../server/riot';
import { errorText, clock, num } from '../../rules/riot';
import {
  TFT_TABS,
  tftQueueName,
  tftStage,
  placeTone,
  unitCost,
  tftShortName,
  summarizeTft,
} from '../../rules/tft';
import { timeAgo } from '../../lib/timeAgo';
import { useAliasOf } from './useRiotFavs';

/* TFT 최근 매치 (베타). 롤 목록과 같은 틀 - 큐 탭 · 20판씩 더 보기 · 최근 판 분석 ·
   펼치면 여덟 명 전원.
   라이엇이 TFT 목록은 큐로 걸러 주지 않아서, 큐 탭은 받아 둔 판에서 거른다.
   유닛 · 특성 · 아이템 · 증강의 이름과 그림은 데이터 드래곤(server/riot.js loadTftData) */

const EMPTY = [];

/* 특성 육각형. 등급(동 · 은 · 금 · 프리즘)이 바탕색 */
const Trait = ({ t, data }) => {
  const d = tftLookup(data?.traits, t.name);
  return (
    <span className={`tft-trait style-${Math.min(t.style, 4)}`} title={`${d?.name || tftShortName(t.name)} ${t.units}`}>
      {d ? <img src={d.icon} alt="" loading="lazy" /> : <b>{tftShortName(t.name).slice(0, 2)}</b>}
    </span>
  );
};

/* 유닛 초상화. 테두리 색이 코스트, 위에 별, 밑에 아이템 */
const Unit = ({ u, data, small }) => {
  const d = tftLookup(data?.units, u.id);
  const cost = unitCost(u, d?.cost);
  return (
    <span className={`tft-unit cost-${cost || 0} ${small ? 'is-small' : ''}`} title={d?.name || tftShortName(u.id)}>
      <em className="tft-stars">{'★'.repeat(u.star || 1)}</em>
      <span className="tft-face">
        {d ? <img src={d.icon} alt={d.name} loading="lazy" /> : <b>{tftShortName(u.id).slice(0, 3)}</b>}
      </span>
      {u.items.length > 0 && (
        <span className="tft-items">
          {u.items.map((it, i) => {
            const x = tftLookup(data?.items, it);
            return x ? <img key={i} src={x.icon} alt={x.name} title={x.name} loading="lazy" /> : <i key={i} />;
          })}
        </span>
      )}
    </span>
  );
};

const Augments = ({ list, data }) =>
  list.length > 0 && (
    <span className="tft-augments">
      {list.map((a) => {
        const x = tftLookup(data?.augments, a);
        return x ? (
          <img key={a} src={x.icon} alt={x.name} title={x.name} loading="lazy" />
        ) : (
          <i key={a} title={tftShortName(a)} />
        );
      })}
    </span>
  );

/* 한 사람의 덱 (특성 줄 + 유닛 줄) */
const Board = ({ p, data, small }) => (
  <span className="tft-board">
    <span className="tft-traits">
      {p.traits.map((t) => (
        <Trait key={t.name} t={t} data={data} />
      ))}
    </span>
    <span className="tft-units">
      {p.units.map((u, i) => (
        <Unit key={i} u={u} data={data} small={small} />
      ))}
    </span>
  </span>
);

/* 펼치면 여덟 명 전원 */
const Lobby = ({ m, me, data, onSearch }) => {
  const aliasOf = useAliasOf();
  return (
    <ol className="tft-lobby">
      {m.players.map((x) => {
        const id = `${x.name}#${x.tag}`;
        return (
          <li key={x.puuid} className={`${placeTone(x.placement)} ${x.puuid === me ? 'is-me' : ''}`}>
            <b className="tft-place">{x.placement}</b>
            <span className="tft-lobby-who">
              <button type="button" className="riot-link" onClick={() => x.name && onSearch(id)}>
                {x.name || '?'}
                {aliasOf(id) && <em className="riot-alias">{aliasOf(id)}</em>}
              </button>
              <em>
                Lv.{x.level} · {tftStage(x.lastRound)} · 피해 {num(x.damage)}
                {x.pair != null && ` · ${x.pair}팀`}
              </em>
            </span>
            <Augments list={x.augments} data={data} />
            <Board p={x} data={data} small />
          </li>
        );
      })}
    </ol>
  );
};

const TftRow = ({ m, me, data, onSearch }) => {
  const [open, setOpen] = useState(false);
  const p = m.players.find((x) => x.puuid === me);
  if (!p) return null;

  return (
    <li className={`riot-match tft-match ${placeTone(p.placement)}`}>
      <button type="button" className="tft-row" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="tft-head">
          <span className="tft-place-big">
            <strong>{p.placement}</strong>
            <em>등</em>
          </span>
          <span className="tft-meta">
            <b>{tftQueueName(m)}</b>
            <em>{m.at ? timeAgo(m.at) : ''}</em>
            <em>
              {clock(m.length)} · Lv.{p.level} · {tftStage(p.lastRound)}
            </em>
          </span>
        </span>
        <Augments list={p.augments} data={data} />
        <Board p={p} data={data} />
        <FaChevronDown className={`riot-chev ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="riot-match-open">
          <Lobby m={m} me={me} data={data} onSearch={onSearch} />
        </div>
      )}
    </li>
  );
};

/* 최근 판 분석 (TFT) */
const TftStats = ({ s, data }) => {
  const [open, setOpen] = useState(false);
  if (!s) return null;
  const name = (map, key) => tftLookup(map, key)?.name || tftShortName(key);
  return (
    <section className="riot-stats" aria-label="최근 TFT 판 분석">
      <div className="riot-stats-head">
        <strong>
          {s.games}판 평균 <em>{s.avgPlace.toFixed(2)}등</em>
        </strong>
        <span className="tft-recent" aria-label="최근 등수">
          {s.recent.map((x, i) => (
            <b key={i} className={placeTone(x)}>
              {x}
            </b>
          ))}
        </span>
        <button type="button" className="riot-fold riot-stats-toggle" onClick={() => setOpen((v) => !v)}>
          분석 {open ? '접기' : '펼치기'}
          <FaChevronDown className={`riot-chev ${open ? 'is-open' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <div className="riot-tiles">
        <div className="riot-tile">
          <span>순방 (4등 안)</span>
          <b>{Math.round((s.top4 / s.games) * 100)}%</b>
          <em>
            {s.top4} / {s.games}판
          </em>
        </div>
        <div className="riot-tile">
          <span>1등</span>
          <b>{s.wins}번</b>
          <em>{Math.round((s.wins / s.games) * 100)}%</em>
        </div>
        <div className="riot-tile">
          <span>평균 레벨</span>
          <b>{s.avgLevel.toFixed(1)}</b>
        </div>
        <div className="riot-tile">
          <span>평균 피해</span>
          <b>{Math.round(s.avgDamage)}</b>
          <em>플레이어에게</em>
        </div>
      </div>
      {open && (
        <div className="riot-stats-lists">
          <div>
            <h3 className="riot-label">주 특성 (금 이상)</h3>
            <ul>
              {s.traits.slice(0, 5).map((t) => (
                <li key={t.key}>
                  <Trait t={{ name: t.key, style: 3, units: '' }} data={data} />
                  <span className="riot-stats-name">{name(data?.traits, t.key)}</span>
                  <span className="riot-rate">{t.games}판</span>
                  <em>평균 {t.avgPlace.toFixed(1)}등</em>
                </li>
              ))}
              {s.traits.length === 0 && <li className="riot-muted">금 이상으로 켠 특성이 없어요.</li>}
            </ul>
          </div>
          <div>
            <h3 className="riot-label">많이 쓴 유닛</h3>
            <ul>
              {s.units.slice(0, 5).map((u) => (
                <li key={u.key}>
                  <Unit u={{ id: u.key, star: 1, items: [] }} data={data} small />
                  <span className="riot-stats-name">{name(data?.units, u.key)}</span>
                  <span className="riot-rate">{u.games}판</span>
                  <em>평균 {u.avgPlace.toFixed(1)}등</em>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};

const TftList = ({ puuid, me, champs, onSearch }) => {
  const [tab, setTab] = useState('all');
  const [list, setList] = useState({ ids: EMPTY, more: false, busy: true });
  const [matches, setMatches] = useState({});
  const [data, setData] = useState(null);
  const asked = useRef(new Set());
  const top = useRef(null);

  useEffect(() => {
    let alive = true;
    loadTftData(champs?.version).then((x) => alive && setData(x));
    return () => {
      alive = false;
    };
  }, [champs?.version]);

  const loadPage = useCallback(
    async (start) => {
      setList((prev) => ({ ...prev, busy: true, error: undefined }));
      const r = await riotGet({ fn: 'tftMatchIds', puuid, start: String(start) });
      setList((prev) => {
        if (r.error !== undefined) return { ...prev, busy: false, error: r.error };
        const got = r.data.ids || [];
        return {
          ids: start === 0 ? got : [...prev.ids, ...got.filter((x) => !prev.ids.includes(x))],
          more: Boolean(r.data.more),
          busy: false,
        };
      });
    },
    [puuid]
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  const fetchMatch = useCallback((id) => {
    asked.current.add(id);
    riotGet({ fn: 'tftMatch', id }).then((r) => setMatches((prev) => ({ ...prev, [id]: r })));
  }, []);

  useEffect(() => {
    list.ids.filter((id) => !asked.current.has(id)).forEach(fetchMatch);
  }, [list.ids, fetchMatch]);

  const pickTab = (key) => {
    setTab(key);
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const test = TFT_TABS.find((t) => t.key === tab).test;
  /* 아직 안 받은 판은 어느 큐인지 몰라서 자리만 둔다 (전체 탭에서만) */
  const rows = list.ids.filter((id) => {
    const d = matches[id]?.data;
    return d ? test(d) : tab === 'all';
  });
  const shown = rows.map((id) => matches[id]?.data).filter(Boolean);
  const stats = summarizeTft(shown, me);

  return (
    <div className="riot-matches" ref={top}>
      <div className="riot-queue-tabs riot-stick is-sub" role="tablist" aria-label="TFT 큐 고르기">
        {TFT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`riot-queue-tab ${tab === t.key ? 'is-on' : ''}`}
            onClick={() => pickTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TftStats s={stats} data={data} />

      {list.error !== undefined && list.ids.length === 0 ? (
        <p className="riot-muted">{errorText(list.error)}</p>
      ) : !list.busy && rows.length === 0 ? (
        <p className="riot-muted">
          {list.ids.length === 0 ? '최근 TFT 매치가 없어요.' : '받아 둔 판 중에 이 큐로 한 판이 없어요. 더 받아 보세요.'}
        </p>
      ) : (
        <ul className="riot-match-list">
          {rows.map((id) => {
            const r = matches[id];
            if (!r) return <li key={id} className="riot-match is-loading" />;
            if (r.error !== undefined) {
              return (
                <li key={id} className="riot-match is-error">
                  <span className="riot-muted">{errorText(r.error)}</span>
                  <button type="button" className="ghost-btn" onClick={() => fetchMatch(id)}>
                    다시
                  </button>
                </li>
              );
            }
            return <TftRow key={id} m={r.data} me={me} data={data} onSearch={onSearch} />;
          })}
          {list.busy && list.ids.length === 0 &&
            [0, 1, 2].map((i) => <li key={`s${i}`} className="riot-match is-loading" />)}
        </ul>
      )}

      {list.more && (
        <button type="button" className="ghost-btn riot-more" disabled={list.busy} onClick={() => loadPage(list.ids.length)}>
          {list.busy ? '불러오는 중…' : '20판 더 보기'}
        </button>
      )}
    </div>
  );
};

export default TftList;
