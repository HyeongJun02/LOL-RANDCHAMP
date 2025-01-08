import React from 'react';
import './RoleIcons.css';

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
    toggleRole((prevRoles) =>
      prevRoles.includes(role)
        ? prevRoles.filter((r) => r !== role)
        : [...prevRoles, role]
    );
  };

  return (
    <div className="role-icons">
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
