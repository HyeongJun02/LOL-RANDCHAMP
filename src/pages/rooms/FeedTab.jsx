import React, { useCallback, useEffect, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { fetchLogs, feedParts, FEED_PAGE } from '../../rooms';
import { SkelRows } from '../../components/common/Skeleton';

const when = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};

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

  const load = useCallback(
    async (at, cursorList) => {
      setLoading(true);
      try {
        const rows = (await fetchLogs(roomId, cursorList[at])) || [];
        setItems(rows);
        setHasNext(rows.length === FEED_PAGE);
      } catch {
        setItems([]);
        setHasNext(false);
      } finally {
        setLoading(false);
      }
    },
    [roomId]
  );

  /* 방에 무슨 일이 생기면(version) 첫 페이지부터 다시 본다 */
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

  if (loading) return <SkelRows count={6} h={40} />;

  if (items.length === 0) {
    return <p className="rooms-blank">아직 남은 기록이 없어요.</p>;
  }

  return (
    <>
      <ul className="room-feed">
        {items.map((log) => {
          const { tag, parts } = feedParts(log);
          return (
            <li key={log.id}>
              <span className={`feed-tag tone-${tag.tone}`}>{tag.label}</span>
              <span className="feed-when">{when(log.created_at)}</span>
              <span className="feed-text">
                {parts.map((x, i) => (
                  <span key={i} className={`feed-${x.k}`}>
                    {x.v}
                  </span>
                ))}
              </span>
            </li>
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
