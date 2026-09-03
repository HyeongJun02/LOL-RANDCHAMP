import React, { useCallback, useEffect, useState } from 'react';
import { fetchLogs, feedLine, FEED_PAGE } from '../../rooms';

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

/* 방의 '피드' 탭. 시스템이 쌓는 로그만 보여준다 - 직접 채팅은 없다.

   version이 바뀌면 처음부터 다시 받는다. 그 외에는 '더 보기'로
   커서를 따라 20개씩만 이어 받는다. 전체를 다시 받지 않는다 */
const FeedTab = ({ roomId, version }) => {
  const [items, setItems] = useState([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLogs(roomId);
      setItems(rows || []);
      setDone((rows || []).length < FEED_PAGE);
    } catch {
      setItems([]);
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load, version]);

  const more = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    try {
      const rows = await fetchLogs(roomId, last.id);
      setItems((prev) => [...prev, ...(rows || [])]);
      if ((rows || []).length < FEED_PAGE) setDone(true);
    } catch {
      setDone(true);
    }
  };

  if (loading) return <p className="rooms-hint">불러오는 중…</p>;

  if (items.length === 0) {
    return <p className="rooms-blank">아직 남은 기록이 없어요.</p>;
  }

  return (
    <>
      <ul className="room-feed">
        {items.map((log) => (
          <li key={log.id}>
            <span className="feed-when">{when(log.created_at)}</span>
            <span className="feed-text">{feedLine(log)}</span>
          </li>
        ))}
      </ul>
      {!done && (
        <button className="ghost-btn feed-more" onClick={more}>
          더 보기
        </button>
      )}
    </>
  );
};

export default FeedTab;
