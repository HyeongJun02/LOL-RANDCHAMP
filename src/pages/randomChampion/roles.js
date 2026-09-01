export const ROLES = [
  { role: 'Assassin', icon: '/role_icon/Slayer.png', label: '암살자' },
  { role: 'Fighter', icon: '/role_icon/Fighter.png', label: '전사' },
  { role: 'Mage', icon: '/role_icon/Mage.png', label: '마법사' },
  { role: 'Marksman', icon: '/role_icon/Marksman.png', label: '원거리' },
  { role: 'Support', icon: '/role_icon/Controller.png', label: '서포터' },
  { role: 'Tank', icon: '/role_icon/Tank.png', label: '탱커' },
];

export const findRole = (tag) => ROLES.find((r) => r.role === tag);
