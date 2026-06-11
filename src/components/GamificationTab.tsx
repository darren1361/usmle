import React, { useState, useMemo, useEffect } from 'react';
import { USMLERow } from '../types';
import { Coins, Flame, Ban, Dumbbell, Check, Ghost, Shield, ShieldAlert, Award, Lock, Unlock, ShoppingBag, Info } from 'lucide-react';

interface GamificationTabProps {
  rows: USMLERow[];
  purchasedRewards: Record<string, number>;
  setPurchasedRewards: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

interface Reward {
  id: string;
  title: string;
  costCoins: number;
  costGT: number;
  reqText: string;
}

const REWARDS: Reward[] = [
  { id: 'dq_icecream', title: 'DQ Blizzard Ice Cream', costCoins: 200, costGT: 0, reqText: 'Requires an unbroken 5-day streak of 40 questions/day.' },
  { id: 'calisthenics_upg', title: 'Calisthenics Gear/Outing', costCoins: 400, costGT: 0, reqText: '2 straight weeks of hitting 200 questions by Friday night.' },
  { id: 'fitbit_band', title: 'Active Fitbit Sport Band', costCoins: 600, costGT: 0, reqText: '3 straight weeks of hitting the 200 baseline.' },
  { id: 'hobby_upgrade', title: 'Hobby Upgrade Orchid/Kit', costCoins: 800, costGT: 0, reqText: '4 straight weeks of hitting 200 questions by Friday night.' },
  { id: 'on_cloud', title: 'On Cloud Shoes', costCoins: 1000, costGT: 0, reqText: 'Requires maintaining a flawless 5-week streak with zero weekend catch-up.' },
];

const GroguAvatar = () => (
  <svg viewBox="0 0 100 100" className="w-16 h-16 filter drop-shadow-[0_0_8px_rgba(52,199,89,0.55)]">
    <defs>
      <radialGradient id="gradRef1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#34C759" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#1C1C1E" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="40" fill="url(#gradRef1)" />
    {/* Diamond Crystal */}
    <path d="M 50 22 L 64 50 L 50 78 L 36 50 Z" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 50 22 L 50 78" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
    <path d="M 36 50 L 64 50" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="2 3" />
    {/* Orbit rings */}
    <ellipse cx="50" cy="50" rx="32" ry="12" fill="none" stroke="#34C759" strokeWidth="1" transform="rotate(-15 50 50)" opacity="0.7" />
  </svg>
);

const AhsokaAvatar = () => (
  <svg viewBox="0 0 100 100" className="w-16 h-16 filter drop-shadow-[0_0_8px_rgba(255,149,0,0.55)]">
    <defs>
      <linearGradient id="gradRef2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF9500" />
        <stop offset="100%" stopColor="#007AFF" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
    {/* Rays */}
    <path d="M 50 10 L 50 90 M 10 50 L 90 50 M 22 22 L 78 78 M 22 78 L 78 22" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    {/* Crossed sabers */}
    <path d="M 30 70 Q 50 50 70 30" fill="none" stroke="#FF9500" strokeWidth="3" strokeLinecap="round" />
    <path d="M 30 30 Q 50 50 70 70" fill="none" stroke="#007AFF" strokeWidth="3" strokeLinecap="round" />
    <circle cx="50" cy="50" r="10" fill="#1C1C1E" stroke="url(#gradRef2)" strokeWidth="2" />
    <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
  </svg>
);

const LukeAvatar = () => (
  <svg viewBox="0 0 100 100" className="w-16 h-16 filter drop-shadow-[0_0_10px_rgba(52,199,89,0.6)]">
    <defs>
      <radialGradient id="gradRef3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#30D158" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#1C1C1E" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="35" fill="url(#gradRef3)" />
    <line x1="50" y1="85" x2="50" y2="15" stroke="rgba(255,255,255,0.2)" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
    <line x1="50" y1="85" x2="50" y2="15" stroke="#30D158" strokeWidth="4" strokeLinecap="round" />
    <line x1="50" y1="85" x2="50" y2="15" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="47" y="72" width="6" height="13" rx="1.5" fill="#C7C7CC" />
    {/* Small sparks */}
    <circle cx="35" cy="30" r="1.5" fill="#30D158" />
    <circle cx="65" cy="45" r="1.5" fill="#30D158" />
    <circle cx="44" cy="65" r="1" fill="#FFFFFF" />
  </svg>
);

const ObiWanAvatar = () => (
  <svg viewBox="0 0 100 100" className="w-16 h-16 filter drop-shadow-[0_0_10px_rgba(0,122,255,0.6)]">
    <defs>
      <linearGradient id="gradRef4" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#007AFF" />
        <stop offset="100%" stopColor="#5856D6" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="50" cy="50" r="38" fill="none" stroke="url(#gradRef4)" strokeWidth="2.5" />
    <circle cx="50" cy="50" r="26" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.8" />
    {/* Master Star */}
    <path d="M 50 18 L 54 42 L 78 42 L 58 54 L 66 78 L 50 63 L 34 78 L 42 54 L 22 42 L 46 42 Z" fill="url(#gradRef4)" stroke="#FFFFFF" strokeWidth="1" />
    <circle cx="50" cy="48" r="4" fill="#FFFFFF" />
  </svg>
);

const YodaAvatar = () => (
  <svg viewBox="0 0 100 100" className="w-16 h-16 filter drop-shadow-[0_0_12px_rgba(255,214,10,0.85)]">
    <defs>
      <linearGradient id="gradRef5" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD60A" />
        <stop offset="50%" stopColor="#FF9500" />
        <stop offset="100%" stopColor="#30D158" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradRef5)" strokeWidth="2" />
    {/* Ring 1 */}
    <ellipse cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" transform="rotate(30 50 50)" />
    <ellipse cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" transform="rotate(-30 50 50)" />
    {/* Outer Dots */}
    <circle cx="50" cy="5" r="2.5" fill="#FFD60A" />
    <circle cx="50" cy="95" r="2.5" fill="#FFD60A" />
    {/* Infinite Triquetra or Sacred Geometry */}
    <path d="M 50 20 C 65 35, 65 65, 50 80 C 35 65, 35 35, 50 20" fill="url(#gradRef5)" opacity="0.85" />
    <path d="M 20 50 C 35 35, 65 35, 80 50 C 65 65, 35 65, 20 50" fill="url(#gradRef5)" opacity="0.85" />
    <circle cx="50" cy="50" r="8" fill="#FFFFFF" />
  </svg>
);

const getAvatarForLevel = (lvl: number) => {
  switch (lvl) {
    case 1: return <GroguAvatar />;
    case 2: return <AhsokaAvatar />;
    case 3: return <LukeAvatar />;
    case 4: return <ObiWanAvatar />;
    case 5: return <YodaAvatar />;
    default: return <GroguAvatar />;
  }
};

const getTitleForLevel = (lvl: number) => {
  switch (lvl) {
    case 1: return "Grogu (Padawan)";
    case 2: return "Ahsoka Tano (Apprentice)";
    case 3: return "Luke Skywalker (Knight)";
    case 4: return "Obi-Wan Kenobi (Jedi Master)";
    case 5: return "Master Yoda (Grandmaster)";
    default: return "Grogu (Padawan)";
  }
};

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7; 
  d.setDate(d.getDate() - day + 1);
  d.setHours(0,0,0,0);
  return d;
}

export default function GamificationTab({ rows, purchasedRewards, setPurchasedRewards }: GamificationTabProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const engine = useMemo(() => {
    const countsByDate: Record<string, number> = {};
    const effectiveDate = new Date("2026-06-08T00:00:00").getTime();
    rows.forEach(r => {
      if (r.date && (r.attempt1 || r.attempt2)) {
        const rowDate = new Date(r.date + "T00:00:00");
        if (rowDate.getTime() >= effectiveDate) {
          countsByDate[r.date] = (countsByDate[r.date] || 0) + 1;
        }
      }
    });

    const now = new Date();
    // Offset local date to calculate midnight correctly in local timezone
    let minDate = getMonday(now);
    Object.keys(countsByDate).forEach(d => {
      // Create local date correctly
      const parts = d.split('-');
      if (parts.length === 3) {
        const p = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if(!isNaN(p.getTime()) && p < minDate) {
          minDate = getMonday(p);
        }
      }
    });

    let totalCoins = 0;
    let totalGT = 0;
    
    const weekIter = new Date(minDate);
    const resultWeeks = [];

    const formatLocalDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    while (weekIter <= getMonday(now)) {
      const weekStr = formatLocalDate(weekIter);
      let monFriCount = 0;
      let weekendCount = 0;
      let perfectStreak = true;
      const dailyCounts: number[] = [];

      for (let i = 0; i < 7; i++) {
        const checkDay = new Date(weekIter);
        checkDay.setDate(checkDay.getDate() + i);
        const yyyymmdd = formatLocalDate(checkDay);
        const count = countsByDate[yyyymmdd] || 0;
        dailyCounts.push(count);

        if (i < 5) {
          monFriCount += count;
          if (count < 40) perfectStreak = false;
        } else {
          weekendCount += count;
        }
      }

      let weekCoins = 0;
      let weekGT = 0;
      let hasDebtMonster = false;
      let debt = 0;
      let tax = 0;
      let gymLockdownSaturday = false;
      let failedWeekFreeze = false;
      
      const isCurrent = weekStr === formatLocalDate(getMonday(now));
      const todayDay = now.getDay(); // 0 is Sun, 1 is Mon, etc.

      if (isCurrent) {
        if (monFriCount >= 200) {
          weekCoins = monFriCount + weekendCount;
          weekGT = monFriCount - 200;
        } else {
          const isWeekend = todayDay === 0 || todayDay === 6;
          debt = 200 - monFriCount;
          tax = Math.ceil(debt * 0.10);
          
          if (isWeekend) {
            hasDebtMonster = true;
            gymLockdownSaturday = true;
            if (weekendCount >= debt + tax) {
              weekCoins = monFriCount + (weekendCount - tax);
            } else {
              if (todayDay === 0) {
                failedWeekFreeze = true;
              }
              weekCoins = monFriCount + weekendCount;
            }
          } else {
            // Monday to Friday
            const expectedSoFar = todayDay === 0 ? 200 : todayDay * 40;
            hasDebtMonster = monFriCount < expectedSoFar;
            gymLockdownSaturday = false;
            failedWeekFreeze = false;
            weekCoins = monFriCount + weekendCount;
          }
        }
      } else {
        if (monFriCount >= 200) {
          weekGT = monFriCount - 200;
          weekCoins = monFriCount + weekendCount;
        } else {
          hasDebtMonster = true;
          debt = 200 - monFriCount;
          tax = Math.ceil(debt * 0.10);
          gymLockdownSaturday = true;

          if (weekendCount >= debt + tax) {
            weekCoins = monFriCount + (weekendCount - tax);
          } else {
            failedWeekFreeze = true;
            weekCoins = monFriCount + weekendCount; 
          }
        }
      }

      if (perfectStreak && monFriCount >= 200) {
        weekCoins += 50; 
      }

      totalCoins += weekCoins;
      totalGT += weekGT;

      resultWeeks.push({
        weekStart: weekStr,
        isCurrentWeek: isCurrent,
        monFriCount, weekendCount, total: monFriCount + weekendCount,
        gymLockdownSaturday, failedWeekFreeze, perfectStreak, tax, hasDebtMonster, weekCoins, weekGT, dailyCounts
      });

      weekIter.setDate(weekIter.getDate() + 7);
    }

    const coinsSpent = Object.keys(purchasedRewards).reduce((acc, id) => {
      const reward = REWARDS.find(r => r.id === id);
      return acc + (reward ? reward.costCoins * purchasedRewards[id] : 0);
    }, 0);
    const gtSpent = Object.keys(purchasedRewards).reduce((acc, id) => {
      const reward = REWARDS.find(r => r.id === id);
      return acc + (reward ? reward.costGT * purchasedRewards[id] : 0);
    }, 0);

    return {
      weeks: resultWeeks,
      currentWeek: resultWeeks[resultWeeks.length - 1],
      totalCoins: Math.max(0, totalCoins - coinsSpent),
      totalGT: Math.max(0, totalGT - gtSpent),
    };
  }, [rows, purchasedRewards]);

  const handlePurchase = (id: string, coins: number, gt: number) => {
    if (engine.totalCoins >= coins && engine.totalGT >= gt) {
      const currentCount = purchasedRewards[id] || 0;
      const nextR = { ...purchasedRewards, [id]: currentCount + 1 };
      setPurchasedRewards(nextR);
    }
  };

  const cWeek = engine.currentWeek;

  const isFreezeActiveFromLastWeek = useMemo(() => {
    const todayDay = new Date().getDay();
    const isMonOrTue = todayDay === 1 || todayDay === 2;
    if (isMonOrTue && engine.weeks.length >= 2) {
      const prevWeek = engine.weeks[engine.weeks.length - 2];
      return prevWeek ? prevWeek.failedWeekFreeze : false;
    }
    return false;
  }, [engine.weeks]);

  const totalQuestions = useMemo(() => {
    let sum = 0;
    const effectiveDate = new Date("2026-06-08T00:00:00").getTime();
    rows.forEach(r => {
      if (r.date && (r.attempt1 || r.attempt2)) {
        const rowDate = new Date(r.date + "T00:00:00");
        if (rowDate.getTime() >= effectiveDate) {
          sum += 1;
        }
      }
    });
    return sum;
  }, [rows]);

  const levelInfo = useMemo(() => {
    // Each level is unlocked after finishing 200 questions.
    let levelNum = 1;
    if (totalQuestions < 200) {
      levelNum = 1;
    } else if (totalQuestions < 400) {
      levelNum = 2;
    } else if (totalQuestions < 600) {
      levelNum = 3;
    } else if (totalQuestions < 800) {
      levelNum = 4;
    } else {
      levelNum = 5;
    }

    let progressToNext = 0;
    let base = 0;
    let target = 200;

    if (levelNum === 1) {
      progressToNext = (totalQuestions / 200) * 100;
      base = 0;
      target = 200;
    } else if (levelNum === 2) {
      progressToNext = ((totalQuestions - 200) / 200) * 100;
      base = 200;
      target = 400;
    } else if (levelNum === 3) {
      progressToNext = ((totalQuestions - 400) / 200) * 100;
      base = 400;
      target = 600;
    } else if (levelNum === 4) {
      progressToNext = ((totalQuestions - 600) / 200) * 100;
      base = 600;
      target = 800;
    } else {
      progressToNext = 100;
      base = 800;
      target = 800;
    }

    return {
      level: levelNum,
      progressToNext,
      base,
      target
    };
  }, [totalQuestions]);

  const debt = cWeek ? Math.max(0, 200 - cWeek.monFriCount) : 0;
  const tax = cWeek ? cWeek.tax : 0;

  return (
    <div className="flex flex-col gap-6 bg-transparent w-full h-full overflow-y-auto pb-8">
      
      {/* TWO-COLOR PREMIUM HIGH-CONTRAST SLATE CARD */}
      <div className="bg-[#1C1C1E] text-white p-6 rounded-[28px] border border-white/5 shadow-xl flex flex-col gap-6">
        
        {/* HEADER BAR: LEVEL ON TOP LEFT, BALANCE MOVED TO FAR RIGHT */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-2xl">
              <Award size={24} className="text-[#34C759]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Current Standing</span>
              <h2 className="text-[20px] font-extrabold text-white tracking-tight leading-tight">
                Level {levelInfo.level} • {getTitleForLevel(levelInfo.level)}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:text-right">
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Available Balance</span>
              <div className="flex items-center gap-1.5 mt-0.5 text-[#FFFFFF]">
                <Coins size={20} className="text-amber-400 stroke-2" />
                <span className="text-[22px] font-black tracking-tight">
                  {engine.totalCoins.toLocaleString()}{' '}
                  <span className="text-[11px] opacity-75 font-bold uppercase tracking-wider">Coins</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS CORE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          
          {/* LEVEL BADGE */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-sm p-5 rounded-2xl flex flex-col justify-between items-center text-center">
            <div className="relative mb-3 flex flex-col items-center justify-center min-h-[68px]">
              {getAvatarForLevel(levelInfo.level)}
            </div>
            
            {/* progress bar */}
            <div className="w-full px-1">
              <div className="flex justify-between text-[9px] font-bold text-white/60 mb-1">
                <span>{totalQuestions} Qs Logged</span>
                {levelInfo.level < 5 ? (
                  <span>Next: {levelInfo.target}</span>
                ) : (
                  <span className="text-[#30D158] font-bold">MAX RANK</span>
                )}
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#FFFFFF] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${levelInfo.level < 5 ? levelInfo.progressToNext : 100}%` }}
                />
              </div>
              <div className="text-[9px] text-white/50 font-bold mt-1 uppercase">
                {levelInfo.level < 5 ? `${Math.ceil(levelInfo.target - totalQuestions)} Qs to unlock next rank` : "Grandmaster Achieved"}
              </div>
            </div>
          </div>

          {/* WEEKLY GOAL */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-sm p-5 rounded-2xl flex flex-col justify-between items-center text-center">
            <div className="relative flex flex-col items-center justify-end h-[68px] w-[100px] mb-3">
              <svg viewBox="0 0 100 50" className="w-[100px] h-[50px] overflow-visible absolute bottom-0">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" />
                <path 
                  d="M 10 50 A 40 40 0 0 1 90 50" 
                  fill="none" 
                  stroke={cWeek?.monFriCount >= 200 ? "#30D158" : "#FF9500"} 
                  strokeWidth="10" 
                  strokeLinecap="round" 
                  strokeDasharray="125" 
                  strokeDashoffset={125 - Math.min(125, ((cWeek?.monFriCount || 0) / 200) * 125)} 
                  style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} 
                />
              </svg>
              <div className="relative text-[20px] font-extrabold text-[#FFFFFF] z-10 translate-y-1">
                {cWeek?.monFriCount || 0}<span className="text-[12px] opacity-60">/200</span>
              </div>
            </div>
            <div>
              <div className="text-[12px] font-bold tracking-wider uppercase text-white/90">Baseline Goal</div>
              <div className="text-[9px] text-white/50 font-bold mt-1 uppercase">Monday - Friday Target</div>
            </div>
          </div>

          {/* STREAK */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-sm p-5 rounded-2xl flex flex-col justify-between items-center text-center">
            <div className="relative mb-3 flex flex-col items-center justify-center min-h-[68px]">
              {cWeek?.perfectStreak && <Flame size={16} className="text-amber-500 fill-amber-500 absolute -top-5 -left-4 animate-pulse" />}
              <div className="flex gap-1 items-end">
                {['M','T','W','T','F'].map((day, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-[9px] font-bold mb-1 text-white/50">{day}</span>
                    <div className={`w-[20px] h-[20px] border flex items-center justify-center rounded-md transition-colors ${(cWeek?.dailyCounts?.[i] || 0) >= 40 ? 'bg-white border-white text-[#1C1C1E]' : 'bg-transparent border-white/20 text-white/40'}`}>
                      {(cWeek?.dailyCounts?.[i] || 0) >= 40 ? (
                        <Check size={11} strokeWidth={4} />
                      ) : (
                        <span className="text-[8px] font-bold">{cWeek?.dailyCounts?.[i] || 0}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[12px] font-bold tracking-wider uppercase text-[#FFFFFF]">Mon-Fri Check</div>
              <div className="text-[9px] text-white/50 font-bold mt-1 uppercase">45+ daily adds (+50 reward)</div>
            </div>
          </div>

          {/* DEBT RISK */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-sm p-5 rounded-2xl flex flex-col justify-between items-center text-center">
            <div className="h-[68px] flex items-center justify-center mb-3">
              <Ghost size={44} strokeWidth={1.5} className={cWeek?.hasDebtMonster ? "text-red-400 fill-red-500/20 opacity-100 animate-bounce" : "text-white/40 opacity-40"} />
            </div>
            <div>
              <div className="text-[12px] font-bold tracking-wider uppercase text-[#FFFFFF]">
                Debt Threat: <span className={cWeek?.hasDebtMonster ? "text-red-400 font-extrabold" : "text-white/60"}>{cWeek?.hasDebtMonster ? 'ACTIVE' : 'NONE'}</span>
              </div>
              <div className="text-[9px] text-white/50 font-bold mt-1 uppercase">
                {cWeek?.hasDebtMonster ? 'Requires Weekend Duty' : 'All Systems Clear'}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECONDARY ROW: ENFORCEMENTS & REWARDS (Bento Card Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch w-full">
        
        {/* ACTIVE ENFORMANCE CARD (Span 2) */}
        <div className="lg:col-span-2 bg-[#FFFFFF] rounded-[24px] border border-[#E5E5EA] shadow-sm p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-red-50 text-[#FF3B30] p-2 rounded-xl border border-red-100 shrink-0">
                <ShieldAlert size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-[16px] font-extrabold text-[#1C1C1E] tracking-tight">Active Enforcements</h3>
                <p className="text-[11px] text-[#8E8E93] font-medium leading-none mt-1">Locks which trigger automatically</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Gym Lockdown Status Bar */}
              <div className={`p-4 rounded-2xl border transition-all ${
                cWeek?.gymLockdownSaturday && cWeek.weekendCount < ((200 - cWeek.monFriCount) + cWeek.tax)
                  ? 'bg-red-50/50 border-red-200/60 text-red-900' 
                  : 'bg-green-50/30 border-green-100/80 text-green-950'
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`p-1.5 rounded-lg shrink-0 ${
                    cWeek?.gymLockdownSaturday && cWeek.weekendCount < ((200 - cWeek.monFriCount) + cWeek.tax)
                      ? 'bg-red-500 text-white' 
                      : 'bg-green-500 text-white'
                  }`}>
                    <Ban size={14} className="stroke-[2.5]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[12px] font-extrabold tracking-tight">Saturday Gym Lockdown</span>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                        cWeek?.gymLockdownSaturday && cWeek.weekendCount < ((200 - cWeek.monFriCount) + cWeek.tax)
                          ? 'bg-red-200/60 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {cWeek?.gymLockdownSaturday && cWeek.weekendCount < ((200 - cWeek.monFriCount) + cWeek.tax) ? 'Lockdown active' : 'Gym Free'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-gray-500 font-medium mt-1.5 leading-relaxed">
                      {cWeek?.gymLockdownSaturday && cWeek.weekendCount < ((200 - cWeek.monFriCount) + cWeek.tax)
                        ? "Saturday morning threshold breached! All workouts are strictly disabled until full 200 study base is met."
                        : "No lockouts logged. You've cleared the daily rules or Saturday is not yet reached."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Weekly Freeze Penalty Status Bar */}
              <div className={`p-4 rounded-2xl border transition-all ${
                (cWeek?.failedWeekFreeze || isFreezeActiveFromLastWeek) 
                  ? 'bg-red-50/50 border-red-200/60 text-red-900' 
                  : 'bg-green-50/30 border-green-100/80 text-green-950'
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`p-1.5 rounded-lg shrink-0 ${
                    (cWeek?.failedWeekFreeze || isFreezeActiveFromLastWeek) 
                      ? 'bg-red-500 text-white' 
                      : 'bg-green-500 text-white'
                  }`}>
                    <Dumbbell size={14} className="stroke-[2.5]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[12px] font-extrabold tracking-tight">2-Day Leisure Freeze</span>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                        (cWeek?.failedWeekFreeze || isFreezeActiveFromLastWeek) 
                          ? 'bg-red-200/60 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {(cWeek?.failedWeekFreeze || isFreezeActiveFromLastWeek) ? 'Active Freeze' : 'No Freeze'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-gray-500 font-medium mt-1.5 leading-relaxed">
                      {(cWeek?.failedWeekFreeze || isFreezeActiveFromLastWeek)
                        ? "Sunday baseline fell short. Enjoyment networks and leisure are locked on Monday and Tuesday."
                        : "Leisure profiles operate normally. Maintain targets to defend this status."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* WEEKLY DEBT LEDGER BREAKDOWN */}
          <div className="bg-[#F8F9FA] rounded-[20px] p-4 border border-[#E5E5EA]/70 flex flex-col gap-2.5">
            <h4 className="text-[11px] font-extrabold text-[#1C1C1E] uppercase tracking-wider flex items-center gap-1.5">
              <Info size={12} className="text-[#8E8E93]" />
              Weekend Debt Ledger & Interest
            </h4>
            <div className="grid grid-cols-2 gap-3 divide-x divide-[#E5E5EA]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider">Unfinished Deficit</span>
                <span className="text-[16px] font-extrabold text-[#1C1C1E]">
                  {debt} Qs
                </span>
              </div>
              <div className="flex flex-col gap-0.5 pl-3">
                <span className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider">10% Penalty Compound</span>
                <span className="text-[16px] font-extrabold text-[#FF3B30]">
                  +{tax} Qs
                </span>
              </div>
            </div>
            <div className="border-t border-[#E5E5EA] pt-2.5 flex justify-between items-center mt-0.5">
              <span className="text-[11px] text-gray-500 font-bold">Total Weekend Clear Duty:</span>
              <span className={`text-[12px] font-black px-2.5 py-0.5 rounded-lg ${
                cWeek?.monFriCount >= 200 ? 'bg-green-500/10 text-[#34C759]' : 'bg-red-500/10 text-[#FF3B30]'
              }`}>
                {cWeek?.monFriCount >= 200 ? '0' : debt + tax} Qs
              </span>
            </div>
          </div>

        </div>

        {/* REWARD VAULT & SHOPPING STATION (Span 3) */}
        <div className="lg:col-span-3 bg-[#FFFFFF] rounded-[24px] border border-[#E5E5EA] shadow-sm p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
              <div className="bg-amber-50 text-amber-500 p-2 rounded-xl border border-amber-100 shrink-0">
                <ShoppingBag size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-[16px] font-extrabold text-[#1C1C1E] tracking-tight">Reward Vault & Upgrade Station</h3>
                <p className="text-[11px] text-[#8E8E93] font-medium leading-none mt-1">Claim your earned milestones</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
              {REWARDS.map(r => {
                const canAfford = engine.totalCoins >= r.costCoins && engine.totalGT >= r.costGT;
                const outOfDebt = !cWeek?.hasDebtMonster; 
                const available = canAfford && outOfDebt;
                const purchasedCount = purchasedRewards[r.id] || 0;
                
                return (
                  <div key={r.id} className="border border-[#F2F2F7] bg-[#FFFFFF] hover:border-[#5856D6]/40 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-all duration-200">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[12px] font-extrabold text-[#1C1C1E] tracking-tight line-clamp-1" title={r.title}>
                          {r.title}
                        </span>
                        <span className="flex items-center gap-0.5 bg-[#FFF9E6] border border-[#FFD60A]/40 text-[#B28900] px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0">
                          <Coins size={10} className="text-[#FFCC00]" />
                          {r.costCoins}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-gray-400 font-medium leading-relaxed mt-2 line-clamp-2" title={r.reqText}>
                        {r.reqText}
                      </p>
                    </div>

                    <div className="pt-2">
                      {purchasedCount > 0 && (
                        <div className="text-[9px] font-black text-[#5856D6] bg-[#5856D6]/5 border border-[#5856D6]/10 rounded-md py-1 px-2 text-center mb-2">
                          CLAIMED: {purchasedCount}x
                        </div>
                      )}

                      {available ? (
                        <button
                          onClick={() => handlePurchase(r.id, r.costCoins, r.costGT)}
                          className="w-full text-center bg-[#5856D6] hover:bg-[#4644B8] text-white text-[11px] font-bold py-1.5 rounded-xl shadow-xs transition-all duration-150"
                        >
                          Claim Reward
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full text-center bg-[#F2F2F7] text-gray-400 text-[10.5px] font-bold py-1.5 rounded-xl cursor-not-allowed border border-transparent"
                        >
                          {!outOfDebt 
                            ? 'Locked: Resolve Debt' 
                            : `Need ${r.costCoins - engine.totalCoins} more Coins`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 flex items-center justify-between shrink-0">
            <span className="text-[10px] tracking-tight text-gray-400 font-bold">Reward coins accrue automatically as you satisfy study goals.</span>
            {Object.keys(purchasedRewards).length > 0 && (
              showResetConfirm ? (
                <div className="flex gap-2 text-[10px]">
                  <button
                    onClick={() => {
                      setPurchasedRewards({});
                      setShowResetConfirm(false);
                    }}
                    className="text-[#FF3B30] hover:underline font-black"
                  >
                    Confirm Reset
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="text-gray-500 hover:underline font-bold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="text-[10px] text-[#FF3B30] hover:underline font-bold opacity-75 hover:opacity-100 transition-opacity"
                >
                  Reset Purchases
                </button>
              )
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
