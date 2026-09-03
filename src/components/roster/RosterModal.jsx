import React from 'react';
import Modal from '../common/Modal';
import RosterEditor from './RosterEditor';
import { useRosterModalOpen, closeRosterModal } from '../../rosterModal';
import './RosterModal.css';

/* App에 한 번만 놓고, 어디서든 openRosterModal()로 연다 */
const RosterModal = () => {
  const open = useRosterModalOpen();
  if (!open) return null;

  return (
    <Modal
      title="내 팀원 명단"
      desc="저장해두면 도구마다 이름 칸 옆 버튼으로 바로 불러올 수 있어요. 못 가는 라인도 같이 저장됩니다."
      size="modal-sm"
      onClose={closeRosterModal}
    >
      <RosterEditor />
    </Modal>
  );
};

export default RosterModal;
