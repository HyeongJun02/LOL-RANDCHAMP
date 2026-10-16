import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthContext';
import { loadFavs, saveFavs } from '../../server/riotFavs';
import { FAV_MAX, ALIAS_MAX, sameId } from '../../rules/riot';

/* 전적 · 정보 즐겨찾기. 로그인했을 때만 (서버에 저장한다).
   바꾸면 화면부터 바꾸고 저장한다. 저장이 거절되면 되돌린다 */
const useRiotFavs = () => {
  const { user } = useAuth();
  const uid = user?.id || null;
  const [list, setList] = useState([]);
  const [ready, setReady] = useState(false);
  /* 저장 중에 또 바꾸면 '되돌릴 값'이 꼬인다. 마지막으로 서버에 들어간 값을 쥔다 */
  const saved = useRef([]);

  useEffect(() => {
    let alive = true;
    setReady(false);
    if (!uid) {
      setList([]);
      saved.current = [];
      setReady(true);
      return undefined;
    }
    loadFavs(uid)
      .then((l) => {
        if (!alive) return;
        setList(l);
        saved.current = l;
      })
      .catch((e) => toast.error(`즐겨찾기를 못 불러왔어요: ${e.message}`))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [uid]);

  const commit = useCallback(
    async (next) => {
      setList(next);
      try {
        await saveFavs(uid, next);
        saved.current = next;
      } catch (e) {
        setList(saved.current);
        toast.error(e.message);
      }
    },
    [uid]
  );

  const find = (id) => list.find((f) => sameId(f.id, id));

  const add = (id) => {
    if (!uid) {
      toast.error('로그인하면 즐겨찾기를 쓸 수 있어요.');
      return;
    }
    if (find(id)) return;
    if (list.length >= FAV_MAX) {
      toast.error(`즐겨찾기는 ${FAV_MAX}개까지예요.`);
      return;
    }
    commit([...list, { id, alias: '' }]);
  };

  const remove = (id) => commit(list.filter((f) => !sameId(f.id, id)));

  const setAlias = (id, alias) => {
    const a = String(alias || '').trim().slice(0, ALIAS_MAX);
    if ((find(id)?.alias || '') === a) return;
    commit(list.map((f) => (sameId(f.id, id) ? { ...f, alias: a } : f)));
  };

  /* 한 칸 위(-1) · 아래(+1) */
  const move = (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    commit(next);
  };

  return {
    loggedIn: Boolean(uid),
    ready,
    list,
    has: (id) => Boolean(find(id)),
    aliasOf: (id) => find(id)?.alias || '',
    add,
    remove,
    setAlias,
    move,
  };
};

export default useRiotFavs;

/* 매치 표 · 관전 화면이 이름 옆에 별명을 붙이려고 쓴다 */
export const FavsContext = createContext({ aliasOf: () => '' });
export const useAliasOf = () => useContext(FavsContext).aliasOf;
