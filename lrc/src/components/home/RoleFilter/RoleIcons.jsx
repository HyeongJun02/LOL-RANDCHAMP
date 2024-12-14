const RoleIcons = ({ selectedRoles, toggleRole }) => {
  const ROLE_ICONS = [
    { role: 'Assassin', icon: '/role_icon/Slayer.png', label: '암살자' },
    { role: 'Fighter', icon: '/role_icon/Fighter.png', label: '전사' },
    { role: 'Support', icon: '/role_icon/Controller.png', label: '서포터' },
    { role: 'Mage', icon: '/role_icon/Mage.png', label: '마법사' },
    { role: 'Marksman', icon: '/role_icon/Marksman.png', label: '원거리 딜러' },
    { role: 'Tank', icon: '/role_icon/Tank.png', label: '탱커' },
  ];

  const handleRoleToggle = (role) => {
    toggleRole(
      (prevSelectedRoles) =>
        prevSelectedRoles.includes(role)
          ? prevSelectedRoles.filter((r) => r !== role) // 이미 선택된 경우 제거
          : [...prevSelectedRoles, role] // 선택되지 않은 경우 추가
    );
  };

  return (
    <div className="role-icons">
      <div
        className={`role-icon-container ${
          selectedRoles.length === 0 ? 'selected' : ''
        }`}
        onClick={() => toggleRole([])} // 아무것도 선택되지 않았을 때 전체 선택으로 설정
      >
        <p className="role-label">초기화</p>
      </div>
      {ROLE_ICONS.map(({ role, icon, label }) => (
        <div
          key={role}
          className={`role-icon-container ${
            selectedRoles.includes(role) ? 'selected' : ''
          }`}
          onClick={() => handleRoleToggle(role)}
        >
          <img src={icon} alt={role} className="role-icon" />
          <p className="role-label">{label}</p>
        </div>
      ))}
    </div>
  );
};

export default RoleIcons;
