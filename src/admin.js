import { useCallback, useEffect, useState } from 'react';
import { rpc } from './rooms';

/* 관리자 화면이 쓰는 통로.

   여기 있는 것들은 전부 방을 넘나드는 값이라 RLS로는 볼 수 없다.
   (RLS는 "내가 멤버인 방만" 이라서, 전체 사용자나 전체 방은 원리상 안 나온다)
   그래서 전부 SECURITY DEFINER 함수로 받아오고, 그 함수들이 첫 줄에서
   require_site_admin()으로 막는다.

   막는 건 서버다. 화면에서 감추는 건 거들 뿐이고, 주소를 직접 쳐도
   함수가 거절한다. */

export const fetchOverview = () => rpc('admin_overview');
export const fetchAllUsers = () => rpc('admin_users');
export const fetchAllRooms = () => rpc('admin_rooms');

export const ADMIN_LOG_PAGE = 40;

export const fetchAllLogs = (beforeId) =>
  rpc('admin_logs', { p_before: beforeId ?? null, p_limit: ADMIN_LOG_PAGE });

export const setSiteRole = (userId, role) =>
  rpc('set_site_role', { p_user: userId, p_role: role });

export const adminDeleteRoom = (roomId) => rpc('admin_delete_room', { p_room: roomId });

/* 달이 넘어갔는데 아무도 안 들어와서 시즌이 안 돌아간 경우를 밀어준다.
   같은 달에 불러도 아무 일이 없다 - 강제 초기화가 아니다 */
export const rollSeasonNow = () => rpc('admin_roll_season');

/* 세 덩어리를 한 번에 받아둔다. 탭을 옮길 때마다 다시 받으면
   숫자가 탭마다 미묘하게 달라 보인다 */
export const useAdminData = (enabled) => {
  const [state, setState] = useState({ loading: enabled, error: null, data: null });

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({ loading: false, error: null, data: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const [overview, users, rooms] = await Promise.all([
        fetchOverview(),
        fetchAllUsers(),
        fetchAllRooms(),
      ]);
      setState({
        loading: false,
        error: null,
        data: { overview: overview || {}, users: users || [], rooms: rooms || [] },
      });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
};
