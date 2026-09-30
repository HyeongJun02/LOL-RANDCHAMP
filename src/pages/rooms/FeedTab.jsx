import React, { useCallback, useEffect, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaListUl } from 'react-icons/fa';
import { fetchLogs, feedParts, FEED_PAGE, FEED_FILTERS } from '../../server/rooms';
import { SkelRows } from '../../components/common/Skeleton';
import Empty from '../../components/common/Empty';

const hhmm = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/* 날짜 구분선에 적는 말. 오늘·어제는 숫자보다 그 말이 빨리 읽힌다 */
const dayLabel = (d) => {
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(d)) / 86400000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEK[d.getDay()]})`;
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/* 방의 '로그' 탭. 시스템이 쌓는 기록만 보여준다 - 직접 채팅은 없다.

   '더 보기'로 계속 이어 붙이면 목록이 끝없이 길어져서 어디까지 봤는지
   놓친다. 한 번에 한 페이지만 보여주고 앞뒤로 넘긴다.

   커서(마지막 id) 방식이라 페이지를 되돌아가려면 지나온 커서를 들고
   있어야 한다. cursors[i] = i페이지를 받을 때 쓴 beforeId */
const FeedTab = ({ roomId, version }) => {
  const [items, setItems] = useState([]);
  const [cursors, setCursors] = useState([undefined]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  /* 고른 라벨. 걸러내기는 서버가 한다 - 받아온 20줄에서 화면이 골라내면
     페이지마다 줄 수가 달라지고 빈 페이지가 나온다 */
  const [filter, setFilter] = useState(0);
  const types = FEED_FILTERS[filter]?.types || null;
  const typeKey = types ? types.join(',') : '';

  const load = useCallback(
    async (at, cursorList) => {
      setLoading(true);
      try {
        const rows = (await fetchLogs(roomId, cursorList[at], typeKey ? typeKey.split(',') : null)) || [];
        setItems(rows);
        setHasNext(rows.length === FEED_PAGE);
      } catch {
        setItems([]);
        setHasNext(false);
      } finally {
        setLoading(false);
      }
    },
    [roomId, typeKey]
  );

  /* 방에 무슨 일이 생기거나(version) 고른 라벨이 바뀌면 첫 페이지부터 */
  useEffect(() => {
    setPage(0);
    setCursors([undefined]);
    load(0, [undefined]);
  }, [load, version]);

  const next = () => {
    const last = items[items.length - 1];
    if (!last) return;
    const list = [...cursors];
    list[page + 1] = last.id;
    setCursors(list);
    setPage(page + 1);
    load(page + 1, list);
  };

  const prev = () => {
    if (page === 0) return;
    setPage(page - 1);
    load(page - 1, cursors);
  };

  const chips = (
    <div className="feed-filters">
      {FEED_FILTERS.map((f, i) => (
        <button
          key={f.label}
          className={`feed-filter ${i === filter ? 'is-on' : ''}`}
          onClick={() => setFilter(i)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <>
        {chips}
        <SkelRows count={6} h={40} />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {chips}
        <Empty
          icon={<FaListUl />}
          title={filter === 0 ? '아직 남은 기록이 없어요' : `'${FEED_FILTERS[filter].label}' 기록이 없어요`}
          desc={
            filter === 0
              ? '경기·또또·끼꼬가 오갈 때마다 여기에 한 줄씩 쌓입니다.'
              : '다른 라벨을 골라보세요.'
          }
        />
      </>
    );
  }

  /* 날짜가 바뀌는 자리에 선을 넣는다. 시간만 적혀 있으면 스크롤하는 동안
     어느 날 일인지 놓친다 (한 페이지에 며칠이 섞여 들어온다) */
  let lastDay = null;

  return (
    <>
      {chips}

      <ul className="room-feed">
        {items.map((log) => {
          const { tag, parts } = feedParts(log);
          const at = new Date(log.created_at);
          const key = dayKey(at);
          const fresh = key !== lastDay;
          lastDay = key;
          return (
            <React.Fragment key={log.id}>
              {fresh && (
                <li className="feed-day" aria-hidden="true">
                  <span>{dayLabel(at)}</span>
                </li>
              )}
              <li>
                <span className={`feed-tag tone-${tag.tone}`}>{tag.label}</span>
                <span className="feed-when">{hhmm(at)}</span>
                <span className="feed-text">
                  {parts.map((x, i) => (
                    <span key={i} className={`feed-${x.k}`}>
                      {x.v}
                    </span>
                  ))}
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ul>

      <div className="feed-pager">
        <button className="ghost-btn" onClick={prev} disabled={page === 0}>
          <FaChevronLeft /> 이전
        </button>
        <span className="feed-page-no">{page + 1}쪽</span>
        <button className="ghost-btn" onClick={next} disabled={!hasNext}>
          다음 <FaChevronRight />
        </button>
      </div>
    </>
  );
};

export default FeedTab;
