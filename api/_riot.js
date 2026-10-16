/* 라이엇 API 중계. 브라우저는 /api/riot?fn=... 만 부르고, 키는 여기서만 쓴다.

   키를 화면 코드에 넣으면 누구나 개발자 도구로 꺼내 간다. 라이엇 서버도
   브라우저에서 오는 요청을 막는다(CORS). 그래서 서버 함수 하나를 사이에 둔다.

   아무 주소나 대신 불러주면 남이 우리 키로 라이엇 API를 마음대로 쓴다.
   fn 이름으로 정해둔 요청만 받고, 들어오는 값은 모양을 확인한다.

   Vercel(api/riot.js) · Netlify(netlify/functions/riot.js) · 로컬 개발 서버
   (src/setupProxy.js)가 전부 이 파일의 run()을 부른다.

   응답은 필요한 칸만 추려서 보낸다. 매치 상세 원본은 한 판에 50KB가 넘는다.
   CDN 캐시(s-maxage)를 걸어 같은 요청이 라이엇까지 가지 않게 한다 -
   개인 키는 2분에 100번이 한도라 캐시 없이는 금방 막힌다. */

const PLATFORM = 'https://kr.api.riotgames.com';
const REGION = 'https://asia.api.riotgames.com';

/* ---------- 입력 확인 ---------- */

/* 라이엇 ID 이름은 3~16자, 태그는 3~5자. 너무 빡빡하게 막으면 옛 계정이
   걸리니 길이만 본다. 슬래시·물음표는 주소를 바꿔버리니 막는다 */
const NAME_RE = /^[^/?#\\]{1,16}$/;
const TAG_RE = /^[^/?#\\]{1,5}$/;
const MATCH_RE = /^KR_\d{5,15}$/;

const validName = (name, tag) =>
  typeof name === 'string' &&
  typeof tag === 'string' &&
  NAME_RE.test(name.trim()) &&
  TAG_RE.test(tag.trim());

const validMatchId = (id) => typeof id === 'string' && MATCH_RE.test(id);

/* ---------- 라이엇 호출 ---------- */

/* 실패를 던지지 않고 { error: 상태코드 }로 돌려준다. 프로필 한 화면에 일곱
   가지를 같이 부르는데, 하나가 403(키 권한 없음)이라고 전부 실패하면 안 된다 */
const call = async (key, url) => {
  try {
    const r = await fetch(url, { headers: { 'X-Riot-Token': key } });
    if (!r.ok) return { error: r.status };
    return { data: await r.json() };
  } catch {
    return { error: 502 };
  }
};

/* 성공한 것만 추린다. 실패는 그대로 둔다 */
const mapPart = (part, fn) => (part.data !== undefined ? { data: fn(part.data) } : part);

/* 따뜻한 함수 안에서 재사용하는 큰 데이터(도전 과제 이름, 발로 콘텐츠).
   ponytail: 인스턴스마다 따로라 첫 요청은 늘 원본을 받는다. 그래도 한 번이다 */
const memo = new Map();
const remember = async (key, ms, load) => {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await load();
  if (value.data !== undefined) memo.set(key, { value, until: Date.now() + ms });
  return value;
};

/* ---------- 추리기 ---------- */

const pickLocale = (list = []) =>
  (list.find((x) => x.locale === 'ko_KR') || list.find((x) => x.locale === 'en_US') || {})
    .content || '';

/* 서버 상태. 점검·장애가 없으면 빈 배열 */
const slimStatus = (s) =>
  [
    ...(s.maintenances || []).map((x) => ({ ...x, kind: 'maintenance' })),
    ...(s.incidents || []).map((x) => ({ ...x, kind: 'incident' })),
  ].map((x) => ({
    kind: x.kind,
    severity: x.incident_severity || null,
    title: pickLocale(x.titles),
    at: x.updated_at || x.created_at || null,
  }));

const slimLeague = (list) =>
  list.map((e) => ({
    queue: e.queueType,
    tier: e.tier || null,
    rank: e.rank || null,
    lp: e.leaguePoints ?? 0,
    wins: e.wins ?? 0,
    losses: e.losses ?? 0,
    hot: Boolean(e.hotStreak),
    // TFT 더블업 등은 순위 대신 등급(ratedTier)을 준다
    rated: e.ratedTier || null,
  }));

const slimMastery = (list) =>
  list.map((m) => ({ champId: m.championId, level: m.championLevel, points: m.championPoints }));

const slimLive = (g) => ({
  queue: g.gameQueueConfigId,
  mode: g.gameMode,
  start: g.gameStartTime || null,
  length: g.gameLength || 0,
  players: (g.participants || []).map((p) => ({
    puuid: p.puuid,
    name: p.riotId || '',
    champId: p.championId,
    team: p.teamId,
  })),
  bans: (g.bannedChampions || []).map((b) => ({ champId: b.championId, team: b.teamId })),
});

/* 도전 과제. 원본은 수백 개라 상위 몇 개만 이름을 붙여 보낸다.
   '상위 몇 %'가 낮을수록 드문 것이다 */
const slimChallenges = (p, config) => {
  const names = new Map(
    (config || []).map((c) => [c.id, c.localizedNames?.ko_KR?.name || c.localizedNames?.en_US?.name])
  );
  return {
    total: p.totalPoints
      ? {
          level: p.totalPoints.level,
          current: p.totalPoints.current,
          max: p.totalPoints.max,
          percentile: p.totalPoints.percentile ?? null,
        }
      : null,
    categories: Object.entries(p.categoryPoints || {}).map(([k, v]) => ({
      key: k,
      level: v.level,
      current: v.current,
      max: v.max,
    })),
    top: (p.challenges || [])
      .filter((c) => c.percentile != null && c.level && c.level !== 'NONE' && names.get(c.challengeId))
      .sort((a, b) => a.percentile - b.percentile)
      .slice(0, 5)
      .map((c) => ({
        id: c.challengeId,
        name: names.get(c.challengeId),
        level: c.level,
        percentile: c.percentile,
      })),
  };
};

const slimMatch = (m) => {
  const info = m.info || {};
  return {
    id: m.metadata?.matchId,
    queue: info.queueId,
    mode: info.gameMode,
    // 2021년 이후 매치는 초 단위다
    duration: info.gameDuration || 0,
    end: info.gameEndTimestamp || null,
    players: (info.participants || []).map((p) => ({
      puuid: p.puuid,
      name: p.riotIdGameName || p.summonerName || '',
      tag: p.riotIdTagline || '',
      team: p.teamId,
      win: Boolean(p.win),
      champ: p.championName,
      level: p.champLevel,
      pos: p.teamPosition || '',
      k: p.kills,
      d: p.deaths,
      a: p.assists,
      cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
      gold: p.goldEarned,
      dmg: p.totalDamageDealtToChampions,
      vision: p.visionScore,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      fb: Boolean(p.firstBloodKill),
      multi: p.largestMultiKill || 0,
    })),
    teams: (info.teams || []).map((t) => ({
      id: t.teamId,
      win: Boolean(t.win),
      kills: t.objectives?.champion?.kills ?? 0,
      dragon: t.objectives?.dragon?.kills ?? 0,
      baron: t.objectives?.baron?.kills ?? 0,
      tower: t.objectives?.tower?.kills ?? 0,
    })),
  };
};

/* 타임라인. 분마다 두 팀 골드 차이, 첫 킬, 큰 오브젝트만 */
const slimTimeline = (t) => {
  const info = t.info || {};
  const team = new Map(
    (info.participants || []).map((p) => [p.participantId, p.participantId <= 5 ? 100 : 200])
  );
  const puuidOf = new Map((info.participants || []).map((p) => [p.participantId, p.puuid]));
  const frames = info.frames || [];

  const goldDiff = frames.map((f) =>
    Object.values(f.participantFrames || {}).reduce(
      (sum, pf) => sum + (team.get(pf.participantId) === 100 ? 1 : -1) * (pf.totalGold || 0),
      0
    )
  );

  const events = frames.flatMap((f) => f.events || []);
  const kill = events.find((e) => e.type === 'CHAMPION_KILL');
  const objectives = events
    .filter((e) => e.type === 'ELITE_MONSTER_KILL')
    .map((e) => ({
      t: e.timestamp,
      type: e.monsterType,
      sub: e.monsterSubType || null,
      team: e.killerTeamId || team.get(e.killerId) || null,
    }));

  return {
    goldDiff,
    firstKill: kill
      ? { t: kill.timestamp, killer: puuidOf.get(kill.killerId) || null, victim: puuidOf.get(kill.victimId) || null }
      : null,
    objectives,
  };
};

const slimTftMatch = (m) => {
  const info = m.info || {};
  return {
    id: m.metadata?.match_id,
    type: info.tft_game_type || null,
    set: info.tft_set_number ?? null,
    at: info.game_datetime || null,
    players: (info.participants || [])
      .map((p) => ({
        puuid: p.puuid,
        name: p.riotIdGameName || '',
        tag: p.riotIdTagline || '',
        placement: p.placement,
        level: p.level,
        traits: (p.traits || [])
          .filter((x) => x.tier_current > 0)
          .sort((a, b) => b.style - a.style || b.num_units - a.num_units)
          .slice(0, 4)
          .map((x) => ({ name: x.name, units: x.num_units, style: x.style })),
        units: (p.units || []).map((u) => ({
          id: u.character_id,
          star: u.tier,
          items: (u.itemNames || []).length,
        })),
      }))
      .sort((a, b) => a.placement - b.placement),
  };
};

/* 순위표 상위 n명. 이름은 계정 API로 붙인다 (리그 API는 이제 puuid만 준다) */
const topWithNames = async (key, entries, n) => {
  const top = [...entries].sort((a, b) => b.leaguePoints - a.leaguePoints).slice(0, n);
  const accounts = await Promise.all(
    top.map((e) => call(key, `${REGION}/riot/account/v1/accounts/by-puuid/${e.puuid}`))
  );
  return top.map((e, i) => ({
    name: accounts[i].data?.gameName || '',
    tag: accounts[i].data?.tagLine || '',
    lp: e.leaguePoints,
    wins: e.wins,
    losses: e.losses,
  }));
};

/* ---------- fn ---------- */

const MIN = 60;
const DAY = 24 * 60 * MIN;

/* 화면 첫머리. 사람을 안 찾아도 보이는 것들 */
const home = async (key) => {
  const [rotation, lolStatus, tftStatus, valStatus, chall, tftChall, valContent] = await Promise.all([
    call(key, `${PLATFORM}/lol/platform/v3/champion-rotations`),
    call(key, `${PLATFORM}/lol/status/v4/platform-data`),
    call(key, `${PLATFORM}/tft/status/v1/platform-data`),
    call(key, `${PLATFORM}/val/status/v1/platform-data`),
    call(key, `${PLATFORM}/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`),
    call(key, `${PLATFORM}/tft/league/v1/challenger?queue=RANKED_TFT`),
    remember('val-content', DAY * 1000, () =>
      call(key, `${PLATFORM}/val/content/v1/contents?locale=ko-KR`)
    ),
  ]);

  const act = (valContent.data?.acts || []).find((a) => a.isActive && a.type === 'act');
  const valBoard = act
    ? await call(key, `${PLATFORM}/val/ranked/v1/leaderboards/by-act/${act.id}?size=10&startIndex=0`)
    : { error: valContent.error || 404 };

  const [challTop, tftTop] = await Promise.all([
    chall.data ? topWithNames(key, chall.data.entries || [], 10).then((data) => ({ data })) : chall,
    tftChall.data ? topWithNames(key, tftChall.data.entries || [], 10).then((data) => ({ data })) : tftChall,
  ]);

  return {
    maxAge: 10 * MIN,
    body: {
      rotation: mapPart(rotation, (r) => ({
        ids: r.freeChampionIds || [],
        newbie: r.freeChampionIdsForNewPlayers || [],
        newbieLevel: r.maxNewPlayerLevel ?? null,
      })),
      status: {
        lol: mapPart(lolStatus, slimStatus),
        tft: mapPart(tftStatus, slimStatus),
        val: mapPart(valStatus, slimStatus),
      },
      challenger: challTop,
      tftChallenger: tftTop,
      valorant: {
        content: mapPart(valContent, (c) => ({
          act: act ? act.name : null,
          agents: (c.characters || [])
            .filter((x) => x.isPlayableCharacter !== false && x.name && !/null/i.test(x.name))
            .map((x) => x.name)
            .sort((a, b) => a.localeCompare(b, 'ko')),
          maps: (c.maps || []).map((x) => x.name).filter(Boolean),
        })),
        leaderboard: mapPart(valBoard, (b) =>
          (b.players || []).map((p) => ({
            rank: p.leaderboardRank,
            name: p.gameName || '비공개',
            tag: p.tagLine || '',
            rating: p.rankedRating,
            wins: p.numberOfWins,
          }))
        ),
      },
    },
  };
};

/* 라이엇 ID 하나로 볼 수 있는 것 전부 */
const profile = async (key, { name, tag }) => {
  if (!validName(name, tag)) return { status: 400, body: { error: 'bad_name' } };
  const account = await call(
    key,
    `${REGION}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name.trim())}/${encodeURIComponent(tag.trim())}`
  );
  if (account.error) return { status: account.error, body: { error: account.error } };
  const puuid = account.data.puuid;

  const [summoner, leagues, mastery, live, challenges, matches, tftLeagues, tftMatches] =
    await Promise.all([
      call(key, `${PLATFORM}/lol/summoner/v4/summoners/by-puuid/${puuid}`),
      call(key, `${PLATFORM}/lol/league/v4/entries/by-puuid/${puuid}`),
      call(key, `${PLATFORM}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=8`),
      call(key, `${PLATFORM}/lol/spectator/v5/active-games/by-summoner/${puuid}`),
      call(key, `${PLATFORM}/lol/challenges/v1/player-data/${puuid}`),
      call(key, `${REGION}/lol/match/v5/matches/by-puuid/${puuid}/ids?count=10`),
      call(key, `${PLATFORM}/tft/league/v1/by-puuid/${puuid}`),
      call(key, `${REGION}/tft/match/v1/matches/by-puuid/${puuid}/ids?count=5`),
    ]);

  const config = challenges.data
    ? await remember('chal-config', DAY * 1000, () =>
        call(key, `${PLATFORM}/lol/challenges/v1/challenges/config`)
      )
    : null;

  return {
    maxAge: 2 * MIN,
    body: {
      account: { puuid, name: account.data.gameName, tag: account.data.tagLine },
      summoner: mapPart(summoner, (s) => ({ level: s.summonerLevel, icon: s.profileIconId })),
      leagues: mapPart(leagues, slimLeague),
      mastery: mapPart(mastery, slimMastery),
      // 게임 중이 아니면 404다. 실패가 아니라 '안 하는 중'
      live: live.error === 404 ? { data: null } : mapPart(live, slimLive),
      challenges: mapPart(challenges, (p) => slimChallenges(p, config?.data)),
      matches: matches,
      tftLeagues: mapPart(tftLeagues, slimLeague),
      tftMatches: tftMatches,
    },
  };
};

const match = async (key, { id }) => {
  if (!validMatchId(id)) return { status: 400, body: { error: 'bad_id' } };
  const r = await call(key, `${REGION}/lol/match/v5/matches/${id}`);
  if (r.error) return { status: r.error, body: { error: r.error } };
  // 끝난 판은 바뀌지 않는다
  return { maxAge: DAY, body: slimMatch(r.data) };
};

const timeline = async (key, { id }) => {
  if (!validMatchId(id)) return { status: 400, body: { error: 'bad_id' } };
  const r = await call(key, `${REGION}/lol/match/v5/matches/${id}/timeline`);
  if (r.error) return { status: r.error, body: { error: r.error } };
  return { maxAge: DAY, body: slimTimeline(r.data) };
};

const tftMatch = async (key, { id }) => {
  if (!validMatchId(id)) return { status: 400, body: { error: 'bad_id' } };
  const r = await call(key, `${REGION}/tft/match/v1/matches/${id}`);
  if (r.error) return { status: r.error, body: { error: r.error } };
  return { maxAge: DAY, body: slimTftMatch(r.data) };
};

const FNS = { home, profile, match, timeline, tftMatch };

/* 어느 서버에서 부르든 같은 모양으로 돌려준다: { status, headers, body } */
const run = async (query = {}, key) => {
  const json = (status, body, maxAge = 0) => ({
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 실패는 캐시하지 않는다. 키를 바꾸거나 한도가 풀리면 바로 다시 돼야 한다
      'Cache-Control':
        status === 200 && maxAge > 0
          ? `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}`
          : 'no-store',
    },
    body,
  });

  const fn = FNS[query.fn];
  if (!fn) return json(400, { error: 'bad_fn' });
  if (!key) return json(503, { error: 'no_key' });

  try {
    const out = await fn(key, query);
    return json(out.status || 200, out.body, out.maxAge);
  } catch {
    return json(500, { error: 'server' });
  }
};

/* Vercel과 로컬 개발 서버(express)는 req/res 모양이 같다 */
const nodeHandler = async (req, res) => {
  const out = await run(req.query || {}, process.env.RIOT_API_KEY);
  Object.entries(out.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.status(out.status).send(JSON.stringify(out.body));
};

module.exports = {
  run,
  nodeHandler,
  // 테스트용
  validName,
  validMatchId,
  slimMatch,
  slimTimeline,
  slimTftMatch,
  slimStatus,
  slimChallenges,
  slimLeague,
};
