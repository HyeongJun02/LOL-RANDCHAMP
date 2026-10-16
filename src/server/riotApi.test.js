/* api/_riot.js - 라이엇 API 중계 서버 함수.
   라이엇에 실제로 가지 않는다. fetch를 가짜로 바꿔 모양만 본다 */
const riot = require('../../api/_riot');

const reply = (status, body) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

afterEach(() => {
  delete global.fetch;
});

test('정해둔 fn만 받는다', async () => {
  const out = await riot.run({ fn: 'anything' }, 'KEY');
  expect(out.status).toBe(400);
  expect(out.headers['Cache-Control']).toBe('no-store');
});

test('키가 없으면 503 no_key (라이엇에 가지 않는다)', async () => {
  global.fetch = jest.fn();
  const out = await riot.run({ fn: 'home' }, undefined);
  expect(out.status).toBe(503);
  expect(out.body.error).toBe('no_key');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('라이엇 ID · 매치 번호 모양을 확인한다 (주소를 바꾸는 글자는 막는다)', () => {
  expect(riot.validName('Hide on bush', 'KR1')).toBe(true);
  expect(riot.validName('한글이름', 'KR1')).toBe(true);
  expect(riot.validName('a/../b', 'KR1')).toBe(false);
  expect(riot.validName('name', 'K?R')).toBe(false);
  expect(riot.validName('', 'KR1')).toBe(false);
  expect(riot.validName('12345678901234567', 'KR1')).toBe(false);
  expect(riot.validMatchId('KR_7012345678')).toBe(true);
  expect(riot.validMatchId('NA1_7012345678')).toBe(false);
  expect(riot.validMatchId('KR_1/../x')).toBe(false);
});

test('없는 라이엇 ID는 404, 캐시하지 않는다', async () => {
  global.fetch = jest.fn(() => reply(404, {}));
  const out = await riot.run({ fn: 'profile', name: '없는사람', tag: 'KR1' }, 'KEY');
  expect(out.status).toBe(404);
  expect(out.headers['Cache-Control']).toBe('no-store');
  /* 키는 헤더로만 간다. 주소에 실으면 로그에 남는다 */
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).not.toContain('KEY');
  expect(init.headers['X-Riot-Token']).toBe('KEY');
  expect(url).toContain('/riot/account/v1/accounts/by-riot-id/');
});

test('프로필: 한 칸이 403이어도 나머지는 온다, 게임 중이 아니면(404) live는 null', async () => {
  global.fetch = jest.fn((url) => {
    if (url.includes('/accounts/by-riot-id/')) {
      return reply(200, { puuid: 'P1', gameName: 'Faker', tagLine: 'KR1' });
    }
    if (url.includes('/summoners/by-puuid/')) return reply(200, { summonerLevel: 700, profileIconId: 6 });
    if (url.includes('/spectator/')) return reply(404, {});
    if (url.includes('/challenges/')) return reply(403, {});
    if (url.includes('/lol/match/v5/matches/by-puuid/')) return reply(200, ['KR_1', 'KR_2']);
    return reply(200, []);
  });
  const out = await riot.run({ fn: 'profile', name: 'Faker', tag: 'KR1' }, 'KEY');
  expect(out.status).toBe(200);
  expect(out.body.account).toEqual({ puuid: 'P1', tftPuuid: 'P1', name: 'Faker', tag: 'KR1' });
  expect(out.body.summoner.data).toEqual({ level: 700, icon: 6 });
  expect(out.body.live).toEqual({ data: null });
  expect(out.body.challenges).toEqual({ error: 403 });
  /* 매치 목록은 큐별로 따로 받는다 (matchIds) */
  expect(out.body.matches).toBeUndefined();
  expect(out.headers['Cache-Control']).toContain('s-maxage=120');
});

test('라이엇이 막히면(429) 그대로 알린다', async () => {
  global.fetch = jest.fn(() => reply(429, {}));
  const out = await riot.run({ fn: 'match', id: 'KR_123456' }, 'KEY');
  expect(out.status).toBe(429);
});

test('끝난 매치는 하루 캐시하고, 필요한 칸만 보낸다', async () => {
  global.fetch = jest.fn(() =>
    reply(200, {
      metadata: { matchId: 'KR_123456' },
      info: {
        queueId: 420,
        gameMode: 'CLASSIC',
        gameDuration: 1800,
        gameEndTimestamp: 1,
        participants: [
          {
            puuid: 'P1',
            riotIdGameName: 'Faker',
            riotIdTagline: 'KR1',
            teamId: 100,
            win: true,
            championName: 'Ahri',
            kills: 10,
            deaths: 2,
            assists: 5,
            totalMinionsKilled: 200,
            neutralMinionsKilled: 10,
            item0: 3089,
            somethingHuge: 'x'.repeat(1000),
          },
        ],
        teams: [{ teamId: 100, win: true, objectives: { champion: { kills: 30 }, dragon: { kills: 3 } } }],
      },
    })
  );
  const out = await riot.run({ fn: 'match', id: 'KR_123456' }, 'KEY');
  expect(out.headers['Cache-Control']).toContain(`s-maxage=${24 * 60 * 60}`);
  const p = out.body.players[0];
  expect(p).toMatchObject({ name: 'Faker', tag: 'KR1', champ: 'Ahri', k: 10, d: 2, a: 5, cs: 210 });
  expect(p.somethingHuge).toBeUndefined();
  expect(out.body.teams[0]).toMatchObject({ kills: 30, dragon: 3, baron: 0 });
});

test('타임라인: 골드 차이는 블루팀(1~5번)이 앞서면 +', () => {
  const t = riot.slimTimeline({
    info: {
      participants: [
        { participantId: 1, puuid: 'A' },
        { participantId: 6, puuid: 'B' },
      ],
      frames: [
        {
          participantFrames: { 1: { participantId: 1, totalGold: 500 }, 6: { participantId: 6, totalGold: 500 } },
          events: [],
        },
        {
          participantFrames: { 1: { participantId: 1, totalGold: 1800 }, 6: { participantId: 6, totalGold: 1200 } },
          events: [
            { type: 'CHAMPION_KILL', timestamp: 95000, killerId: 6, victimId: 1 },
            { type: 'ELITE_MONSTER_KILL', timestamp: 300000, monsterType: 'DRAGON', monsterSubType: 'FIRE_DRAGON', killerTeamId: 100 },
          ],
        },
      ],
    },
  });
  expect(t.goldDiff).toEqual([0, 600]);
  expect(t.firstKill).toEqual({ t: 95000, killer: 'B', victim: 'A' });
  expect(t.objectives).toEqual([{ t: 300000, type: 'DRAGON', sub: 'FIRE_DRAGON', team: 100 }]);
});

test('TFT 매치: 등수 순으로, 켜진 특성만 등급 높은 순', () => {
  const m = riot.slimTftMatch({
    metadata: { match_id: 'KR_9' },
    info: {
      tft_game_type: 'standard',
      participants: [
        { puuid: 'B', placement: 3, traits: [], units: [] },
        {
          puuid: 'A',
          placement: 1,
          traits: [
            { name: 'TFT13_Off', tier_current: 0, style: 0, num_units: 1 },
            { name: 'TFT13_Low', tier_current: 1, style: 1, num_units: 2 },
            { name: 'TFT13_High', tier_current: 3, style: 3, num_units: 6 },
          ],
          units: [{ character_id: 'TFT13_Jinx', tier: 2, itemNames: ['a', 'b'] }],
        },
      ],
    },
  });
  expect(m.players.map((p) => p.puuid)).toEqual(['A', 'B']);
  expect(m.players[0].traits.map((t) => t.name)).toEqual(['TFT13_High', 'TFT13_Low']);
  expect(m.players[0].units).toEqual([{ id: 'TFT13_Jinx', star: 2, items: 2 }]);
});

test('서버 상태는 한국어 제목을 고르고, 없으면 영어', () => {
  const s = riot.slimStatus({
    maintenances: [{ titles: [{ locale: 'en_US', content: 'Maint' }, { locale: 'ko_KR', content: '점검' }] }],
    incidents: [{ incident_severity: 'warning', titles: [{ locale: 'en_US', content: 'Login issue' }] }],
  });
  expect(s.map((x) => [x.kind, x.title])).toEqual([
    ['maintenance', '점검'],
    ['incident', 'Login issue'],
  ]);
});

test('도전 과제는 드문 것(상위 % 낮은 것) 다섯 개만, 이름을 붙여서', () => {
  const config = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, localizedNames: { ko_KR: { name: `과제${id}` } } }));
  const out = riot.slimChallenges(
    {
      totalPoints: { level: 'GOLD', current: 100, max: 200, percentile: 0.3 },
      challenges: [1, 2, 3, 4, 5, 6, 7].map((id) => ({
        challengeId: id,
        level: 'GOLD',
        percentile: id / 10,
      })),
    },
    config
  );
  expect(out.top.map((c) => c.name)).toEqual(['과제1', '과제2', '과제3', '과제4', '과제5']);
  expect(out.total.level).toBe('GOLD');
});

test('로테이션: 라이엇의 새 응답 이름(sr · newplayer)도 옛 이름도 읽는다', async () => {
  const rotations = [
    { sr: [1, 2], newplayer: [3] },
    { freeChampionIds: [1, 2], freeChampionIdsForNewPlayers: [3], maxNewPlayerLevel: 10 },
  ];
  for (const body of rotations) {
    global.fetch = jest.fn((url) => reply(url.includes('champion-rotations') ? 200 : 403, body));
    const out = await riot.run({ fn: 'home' }, 'KEY');
    expect(out.body.rotation.data.ids).toEqual([1, 2]);
    expect(out.body.rotation.data.newbie).toEqual([3]);
  }
});

const PUUID = 'QK4MRJe80C71DvtdsZGOIhAioIp9jErARylp-KkhTJ9eMKvK-5sWJI3HHOKvbS0zFAMlJYzV0y8fcw';

test('매치 목록: 큐로 걸러 20판씩, start로 이어 받는다', async () => {
  global.fetch = jest.fn(() => reply(200, Array.from({ length: 20 }, (_, i) => `KR_${i}`)));
  const out = await riot.run({ fn: 'matchIds', puuid: PUUID, filter: 'solo', start: '20' }, 'KEY');
  expect(out.status).toBe(200);
  expect(out.body.more).toBe(true);
  const url = global.fetch.mock.calls[0][0];
  expect(url).toContain('start=20&count=20&queue=420');

  global.fetch = jest.fn(() => reply(200, ['KR_1']));
  const normal = await riot.run({ fn: 'matchIds', puuid: PUUID, filter: 'normal' }, 'KEY');
  expect(global.fetch.mock.calls[0][0]).toContain('&type=normal');
  /* 20판보다 적게 오면 더 없다 */
  expect(normal.body.more).toBe(false);
});

test('매치 목록: 정해둔 큐 · 모양 맞는 puuid · 범위 안의 start만', async () => {
  global.fetch = jest.fn(() => reply(200, []));
  const bad = [
    { puuid: PUUID, filter: 'urf' },
    { puuid: 'abc/../x', filter: 'all' },
    { puuid: PUUID, filter: 'all', start: '-1' },
    { puuid: PUUID, filter: 'all', start: '5000' },
  ];
  for (const q of bad) {
    const out = await riot.run({ fn: 'matchIds', ...q }, 'KEY');
    expect(out.status).toBe(400);
  }
  expect(global.fetch).not.toHaveBeenCalled();
});

test('타임라인 이벤트: 킬 · 오브젝트 · 건물만, 건물은 부순 팀으로', () => {
  const t = riot.slimTimeline({
    info: {
      participants: [
        { participantId: 1, puuid: 'A' },
        { participantId: 6, puuid: 'B' },
      ],
      frames: [
        {
          participantFrames: {},
          events: [
            { type: 'WARD_PLACED', timestamp: 1 },
            { type: 'CHAMPION_KILL', timestamp: 60000, killerId: 1, victimId: 6, assistingParticipantIds: [] },
            { type: 'BUILDING_KILL', timestamp: 700000, buildingType: 'TOWER_BUILDING', towerType: 'OUTER_TURRET', laneType: 'MID_LANE', teamId: 200, killerId: 1 },
            { type: 'ELITE_MONSTER_KILL', timestamp: 800000, monsterType: 'HORDE', killerTeamId: 200, killerId: 6 },
          ],
        },
      ],
    },
  });
  expect(t.events.map((e) => [e.kind, e.team])).toEqual([
    ['kill', 100],
    ['building', 100],
    ['monster', 200],
  ]);
  expect(t.events[1]).toMatchObject({ tower: 'OUTER_TURRET', lane: 'MID_LANE', killer: 'A' });
});

test('TFT 키가 따로 있으면 TFT 요청은 그 키로, puuid도 그 키로 다시 찾는다', async () => {
  global.fetch = jest.fn((url, init) => {
    const k = init.headers['X-Riot-Token'];
    if (url.includes('/accounts/by-riot-id/')) {
      return reply(200, { puuid: k === 'TFT' ? 'TFT_PUUID' : 'LOL_PUUID', gameName: 'A', tagLine: 'KR1' });
    }
    return reply(200, []);
  });
  const out = await riot.run({ fn: 'profile', name: 'A', tag: 'KR1' }, { lol: 'LOL', tft: 'TFT' });
  expect(out.body.account).toMatchObject({ puuid: 'LOL_PUUID', tftPuuid: 'TFT_PUUID' });
  const calls = global.fetch.mock.calls.map(([u, i]) => [u, i.headers['X-Riot-Token']]);
  calls
    .filter(([u]) => u.includes('/tft/'))
    .forEach(([u, k]) => {
      expect(k).toBe('TFT');
      expect(u).toContain('TFT_PUUID');
    });
  calls.filter(([u]) => u.includes('/lol/')).forEach(([, k]) => expect(k).toBe('LOL'));
});

test('관전: 주문 · 룬 · 라이엇 ID를 추린다, 열 명 랭크는 따로 (솔로 없으면 자유)', async () => {
  global.fetch = jest.fn((url) => {
    if (url.includes('/accounts/by-riot-id/')) return reply(200, { puuid: PUUID, gameName: 'A', tagLine: 'KR1' });
    if (url.includes('/spectator/')) {
      return reply(200, {
        gameQueueConfigId: 420,
        gameStartTime: 1,
        participants: [
          {
            puuid: PUUID,
            teamId: 100,
            championId: 202,
            riotId: 'A#KR1',
            spell1Id: 21,
            spell2Id: 4,
            perks: { perkIds: [8021, 1, 2], perkStyle: 8000, perkSubStyle: 8300 },
          },
        ],
      });
    }
    return reply(200, []);
  });
  const prof = await riot.run({ fn: 'profile', name: 'A', tag: 'KR1' }, 'KEY');
  expect(prof.body.live.data.players[0]).toMatchObject({
    name: 'A#KR1',
    spells: [21, 4],
    keystone: 8021,
    runeStyle: 8000,
    runeSub: 8300,
  });

  const other = PUUID.replace(/^Q/, 'Z');
  global.fetch = jest.fn((url) =>
    reply(
      200,
      url.includes(PUUID)
        ? [{ queueType: 'RANKED_FLEX_SR', tier: 'GOLD', rank: 'II', leaguePoints: 40, wins: 3, losses: 2 }]
        : []
    )
  );
  const ranks = await riot.run({ fn: 'liveRanks', puuids: `${PUUID},${other}` }, 'KEY');
  expect(ranks.body[PUUID]).toMatchObject({ queue: 'RANKED_FLEX_SR', tier: 'GOLD', rank: 'II', lp: 40 });
  expect(ranks.body[other]).toBeNull();
  expect((await riot.run({ fn: 'liveRanks', puuids: 'x/../y' }, 'KEY')).status).toBe(400);
});

test('랭크 조회 only=solo면 자유 랭크로 대신하지 않는다', async () => {
  global.fetch = jest.fn(() =>
    reply(200, [{ queueType: 'RANKED_FLEX_SR', tier: 'GOLD', rank: 'II', leaguePoints: 1, wins: 1, losses: 1 }])
  );
  const any = await riot.run({ fn: 'liveRanks', puuids: PUUID }, 'KEY');
  expect(any.body[PUUID]).toMatchObject({ queue: 'RANKED_FLEX_SR' });
  const solo = await riot.run({ fn: 'liveRanks', puuids: PUUID, only: 'solo' }, 'KEY');
  expect(solo.body[PUUID]).toBeNull();
});
