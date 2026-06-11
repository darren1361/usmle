import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/components/GamificationTab.tsx");
let content = fs.readFileSync(p, "utf8");

// Add dailyCounts to resultWeeks
content = content.replace(
  /for \(let i = 0; i < 7; i\+\) \{/,
  `const dailyCounts: number[] = [];\n      for (let i = 0; i < 7; i++) {`
);

content = content.replace(
  /const count = countsByDate\[yyyymmdd\] \|\| 0;/,
  `const count = countsByDate[yyyymmdd] || 0;\n        dailyCounts.push(count);`
);

content = content.replace(
  /gymLockdownSaturday, failedWeekFreeze, perfectStreak, tax, hasDebtMonster, weekCoins, weekGT/,
  `gymLockdownSaturday, failedWeekFreeze, perfectStreak, tax, hasDebtMonster, weekCoins, weekGT, dailyCounts`
);

// We need an arc function and Check/Ghost icon
const topImports = /import \{ Trophy, Coins, Award, Target, AlertTriangle, ShieldAlert, CheckCircle2, Lock, Unlock, Flame, Ban, ShieldCheck, Dumbbell \} from 'lucide-react';/;
content = content.replace(topImports, `import { Trophy, Coins, Award, Target, AlertTriangle, ShieldAlert, CheckCircle2, Lock, Unlock, Flame, Ban, ShieldCheck, Dumbbell, Check, Ghost } from 'lucide-react';`);

const WIDGET = `      {/* WIDGET */}
      <div className="bg-[#FFFFFF] rounded-[24px] p-6 flex flex-col sm:flex-row items-center justify-between border border-[#E5E5EA] shadow-sm mb-2 gap-6 sm:gap-0">
        
        {/* WEEKLY GOAL */}
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="relative flex flex-col items-center justify-end h-[60px] w-[90px]">
            <svg viewBox="0 0 100 50" className="w-[90px] h-[45px] overflow-visible absolute bottom-0">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E5E5EA" strokeWidth="12" strokeLinecap="round" />
              <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="none" 
                stroke={cWeek?.monFriCount >= 200 ? "#34C759" : (cWeek?.hasDebtMonster ? "#FF3B30" : "#FF9500")} 
                strokeWidth="12" 
                strokeLinecap="round" 
                strokeDasharray="125" 
                strokeDashoffset={125 - Math.min(125, ((cWeek?.monFriCount || 0) / 200) * 125)} 
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} 
              />
            </svg>
            <div className="relative text-[18px] font-bold text-[#1C1C1E] z-10 translate-y-1">{cWeek?.monFriCount || 0}<span className="text-[12px] opacity-60">/200</span></div>
          </div>
          <div className="text-[12px] font-bold tracking-wide mt-4 uppercase text-[#8E8E93]">Weekly Goal</div>
        </div>

        {/* STREAK */}
        <div className="flex flex-col items-center justify-center flex-1 sm:border-l sm:border-r border-[#E5E5EA] w-full sm:w-auto py-4 sm:py-0 border-t border-b sm:border-t-0 sm:border-b-0">
          <div className="relative">
            {cWeek?.perfectStreak && <Flame size={20} className="text-[#FF9500] fill-[#FF9500] absolute -top-5 -left-1" strokeWidth={1.5} />}
            <div className="flex gap-2 h-[50px] items-end pb-1">
              {['M','T','W','T','F'].map((day, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-[11px] font-bold mb-1.5 w-full text-center text-[#1C1C1E]">{day}</span>
                  <div className={\`w-[24px] h-[24px] border-2 flex items-center justify-center rounded-[6px] \${(cWeek?.dailyCounts?.[i] || 0) >= 40 ? 'bg-[#34C759] border-[#34C759]' : 'bg-[#FFFFFF] border-[#E5E5EA]'}\`}>
                    {(cWeek?.dailyCounts?.[i] || 0) >= 40 && <Check size={16} className="text-[#FFFFFF]" strokeWidth={4} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[12px] font-bold tracking-wide mt-4 uppercase text-[#8E8E93]">Streak</div>
        </div>

        {/* DEBT RISK */}
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="h-[50px] flex items-end pb-[2px]">
            <Ghost size={40} strokeWidth={1} className={(cWeek?.hasDebtMonster || (cWeek?.monFriCount === 0 && (new Date().getDay() > 1))) ? "text-[#FF3B30] fill-[#FF3B30] opacity-90" : "text-[#1C1C1E]"} />
          </div>
          <div className="text-[12px] font-bold tracking-wide mt-4 uppercase text-[#8E8E93]">
            Debt Risk: <span className={(cWeek?.hasDebtMonster || (cWeek?.monFriCount === 0 && (new Date().getDay() > 1))) ? "text-[#FF3B30]" : "text-[#34C759]"}>{(cWeek?.hasDebtMonster || (cWeek?.monFriCount === 0 && (new Date().getDay() > 1))) ? 'YES' : 'NO'}</span>
          </div>
        </div>

      </div>`;

content = content.replace(
  /\{\/\* Balances Block \*\/\}/,
  WIDGET + "\n\n      {/* Balances Block */}"
);

fs.writeFileSync(p, content, "utf8");
console.log("Updated gamification tab with widget");
