import React, { useState } from 'react';
import { FaLink, FaGhost, FaUserSlash, FaCrown, FaUserShield } from 'react-icons/fa';
import Modal from '../../components/common/Modal';
import { ROLE_LABEL } from '../../server/rooms';
import { MONTHLY_KKIKO } from '../../rules/tuning';

const num = (n) => Number(n || 0).toLocaleString();

/* 멤버 한 명을 관리하는 팝업.

   전에는 참가자 연결 셀렉트와 버튼 셋(부방장/방장 넘기기/내보내기)이
   목록 줄에 그대로 붙어 있었다. 열 명이면 그 줄이 열 개라 설정 탭이
   가로로도 세로로도 늘어졌고, 한 달에 한 번 쓸 버튼이 매번 눈에 들어왔다.
   목록에는 '누구인가'만 남기고, 손대는 건 여기로 모은다. */
const MemberModal = ({
  member: m,
  members,
  players,
  isOwner,
  isAdmin,
  isMe,
  onClose,
  onLink,
  onRole,
  onHandOver,
  onKick,
  onDropGhost,
}) => {
  /* 구글 계정을 바꿔 들어온 사람의 옛 계정을 내보낼 때, 거기 쌓인 끼꼬가
     같이 사라지면 억울하다. 받을 사람을 골라두면 넘어간다.
     처음 받은 10000은 안 넘어간다 - 그것까지 넘기면 계정을 새로 만들어
     들어왔다 나가는 것만으로 끼꼬를 찍어낼 수 있다 */
  const [to, setTo] = useState('');
  const spare = Math.max(0, (m.points ?? 0) - MONTHLY_KKIKO);
  const canKick = isOwner && !m.is_ghost && !isMe;

  return (
    <Modal
      title={m.nickname}
      desc={`${m.is_ghost ? '유령 멤버' : ROLE_LABEL[m.role]} · ${num(m.points)} 끼꼬`}
      onClose={onClose}
    >
      <div className="mem-modal">
        {isAdmin && (
          <label className="mem-field">
            <span className="mem-field-label">
              <FaLink /> 이 계정은 명단의 누구인가
            </span>
            <select
              className="rooms-input"
              value={m.player?.id ?? ''}
              onChange={(e) => onLink(m, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">안 이어짐</option>
              {players.map((p) => {
                const taken = p.linked_user_id && p.linked_user_id !== m.user_id;
                return (
                  <option key={p.id} value={p.id} disabled={taken}>
                    {p.name}
                    {taken ? ' (이미 이어짐)' : ''}
                  </option>
                );
              })}
            </select>
            <p className="rooms-hint">
              이어두면 그 이름으로 뛴 경기의 참여 끼꼬가 이 계정으로 들어갑니다.
            </p>
          </label>
        )}

        {isOwner && !m.is_ghost && !isMe && (
          <div className="mem-field">
            <span className="mem-field-label">
              <FaUserShield /> 권한
            </span>
            <div className="rooms-form-row">
              <button
                className="ghost-btn"
                onClick={() => onRole(m, m.role === 'admin' ? 'member' : 'admin')}
              >
                {m.role === 'admin' ? '부방장 해제' : '부방장으로'}
              </button>
              <button className="ghost-btn" onClick={() => onHandOver(m)}>
                <FaCrown /> 방장 넘기기
              </button>
            </div>
            <p className="rooms-hint">부방장은 경기와 또또를 남길 수 있어요.</p>
          </div>
        )}

        {canKick && (
          <div className="mem-field is-danger">
            <span className="mem-field-label">
              <FaUserSlash /> 내보내기
            </span>
            {/* 넘길 게 없으면 고를 칸을 띄우지 않는다. 빈 셀렉트만 보이면
                '왜 아무것도 못 고르지' 하고 멈춘다 */}
            {spare > 0 ? (
              <>
                <select
                  className="rooms-input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                >
                  <option value="">끼꼬는 같이 없애기</option>
                  {members
                    .filter((x) => x.user_id !== m.user_id)
                    .map((x) => (
                      <option key={x.user_id} value={x.user_id}>
                        {x.nickname} 님에게 {num(spare)} 넘기기
                      </option>
                    ))}
                </select>
                <p className="rooms-hint">
                  가진 {num(m.points)} 끼꼬 중 <b>{num(spare)}</b>만 넘어갑니다. 처음 받은{' '}
                  {num(MONTHLY_KKIKO)}은 빠집니다 — 그것까지 넘기면 계정을 새로 만들어
                  들어왔다 나가는 것만으로 끼꼬가 늘어납니다.
                </p>
              </>
            ) : (
              <p className="rooms-hint">
                넘길 끼꼬가 없어요. 처음 받은 {num(MONTHLY_KKIKO)}을 넘기지는 않습니다.
              </p>
            )}
            <button className="ghost-btn is-danger" onClick={() => onKick(m, to || null)}>
              <FaUserSlash /> 내보내기
            </button>
          </div>
        )}

        {isAdmin && m.is_ghost && (
          <div className="mem-field is-danger">
            <span className="mem-field-label">
              <FaGhost /> 유령 멤버
            </span>
            <p className="rooms-hint">
              사이트를 안 쓰는 친구 자리입니다. 지우면 이 몫의 끼꼬도 사라져요.
            </p>
            <button className="ghost-btn is-danger" onClick={() => onDropGhost(m)}>
              삭제
            </button>
          </div>
        )}

        {!isAdmin && (
          <p className="rooms-hint">
            {m.player ? `명단의 '${m.player.name}'과 이어져 있어요.` : '참가자와 안 이어졌어요.'}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default MemberModal;
