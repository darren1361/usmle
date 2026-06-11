import React from 'react';

export function getRankLevel(totalQs: number) {
  if (totalQs <= 500) return 0; // Youngling
  if (totalQs <= 1000) return 1; // Padawan
  if (totalQs <= 1500) return 2; // Jedi Knight
  if (totalQs <= 2000) return 3; // Jedi Master
  if (totalQs <= 2500) return 4; // Senior Master
  if (totalQs <= 3000) return 5; // Council Member
  return 6; // Grand Master
}

export const AvatarBadge = ({ totalQs, profileUrl }: { totalQs: number; profileUrl?: string | null }) => {
  const level = getRankLevel(totalQs);
  
  // Design restricted to ONLY: #F2F2F7, #1C1C1E, #FF383C, #FF8D28, #34C759, #0088FF, #FFFFFF
  const avatars = [
    { seed: 'Gizmo', color: '#1C1C1E', label: 'Youngling' }, // 0
    { seed: 'Sassy', color: '#FF8D28', label: 'Padawan' }, // 1
    { seed: 'Tinkerbell', color: '#0088FF', label: 'Jedi Knight' }, // 2
    { seed: 'Trouble', color: '#34C759', label: 'Jedi Master' }, // 3
    { seed: 'Tiger', color: '#FF383C', label: 'Senior Master' }, // 4
    { seed: 'Oliver', color: '#1C1C1E', label: 'Council Member' }, // 5
    { seed: 'Socks', color: '#0088FF', label: 'Grand Master' }, // 6
  ];
  
  const rank = avatars[level];
  const imgUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${rank.seed}`;
  
  return (
    <div className="flex items-center gap-2">
      <div 
        className="w-8 h-8 rounded-full bg-[#FFFFFF] flex items-center justify-center border-2 overflow-hidden shadow-sm"
        style={{ borderColor: rank.color }}
        title={`${rank.label} - ${totalQs} Qs`}
      >
        <img src={profileUrl || imgUrl} alt={rank.label} className="w-full h-full object-cover bg-[#F2F2F7]" referrerPolicy="no-referrer" />
      </div>
    </div>
  );
};
