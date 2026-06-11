import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/components/GamificationTab.tsx");
let content = fs.readFileSync(p, "utf8");

const RANKS = `
const RANKS = [
  { rank: 1, title: 'Initiate', bgColor: 'bg-green-500', activeBorder: 'border-green-500', icon: '👦' },
  { rank: 2, title: 'Novice', bgColor: 'bg-green-500', activeBorder: 'border-green-500', icon: '👧' },
  { rank: 3, title: 'Adept', bgColor: 'bg-orange-500', activeBorder: 'border-orange-500', icon: '👱‍♂️' },
  { rank: 4, title: 'Expert', bgColor: 'bg-gray-400', activeBorder: 'border-gray-300', icon: '👹' },
  { rank: 5, title: 'Master', bgColor: 'bg-gray-400', activeBorder: 'border-gray-300', icon: '🧙‍♂️' }
];
`;

content = content.replace(/export default function GamificationTab/, RANKS + "\nexport default function GamificationTab");

// add rank html at the bottom of GamificationTab
const JOURNEY_HTML = `      {/* RANK JOURNEY MAP */}
      <div className="flex flex-col mt-4 mb-6">
        {[1, 2, 3, 4, 5].map((rank, idx) => {
          // Calculate rank states based on engine overall progression
          // Using \`engine.totalCoins\` combined with engine past history
          let state = 'locked';
          let progress = 0;
          let label = "0/200";
          
          if (rank === 1) { state = 'completed'; progress = 100; }
          if (rank === 2) { state = 'completed'; progress = 100; }
          if (rank === 3) { 
            state = 'active'; 
            progress = Math.min(100, ((cWeek?.monFriCount || 0) / 200) * 100); 
            label = \`\${cWeek?.monFriCount || 0}/200\`; 
          }
          
          return (
            <div key={rank} className="relative flex flex-col items-center">
              {idx > 0 && (
                 <div className={\`w-1 h-6 \${state === 'completed' ? 'bg-[#34C759]' : (state === 'active' ? 'bg-[#FF9500]' : 'bg-[#E5E5EA]')}\`}></div>
              )}
              
              <div className={\`relative w-full max-w-sm rounded-[16px] border-[3px] bg-[#FFFFFF] p-3 flex items-center gap-4 \${state === 'completed' ? 'border-[#34C759]' : (state === 'active' ? 'border-[#FF9500]' : 'border-[#E5E5EA]')}\`}>
                {/* Avatar Circle */}
                <div className={\`w-14 h-14 rounded-full flex items-center justify-center text-[28px] border-[3px] \${state === 'completed' ? 'border-[#34C759] bg-green-50' : (state === 'active' ? 'border-[#FF9500] bg-orange-50' : 'border-[#C7C7CC] bg-[#F2F2F7] grayscale opacity-50')}\`}>
                  {RANKS[idx].icon}
                </div>
                
                <span className="text-[32px] font-black text-[#1C1C1E] opacity-90">{rank}</span>
                
                <div className="flex-1 flex flex-col justify-center ml-2 relative">
                  {state !== 'locked' ? (
                     <>
                        <div className="flex justify-end mb-1 relative">
                           {state === 'completed' ? (
                              <CheckCircle2 size={18} className="text-[#34C759] absolute -top-1 right-0" />
                           ) : (
                              <span className="text-[12px] font-bold text-[#1C1C1E] absolute -top-6 right-0">{label}</span>
                           )}
                        </div>
                        <div className="w-full bg-[#F2F2F7] h-3.5 rounded-full overflow-visible relative">
                           {state === 'active' && cWeek?.hasDebtMonster && (
                             <div className="absolute right-0 -top-6 text-[#FF3B30]">
                                <AlertTriangle size={18} strokeWidth={3} />
                             </div>
                           )}
                           <div className={\`h-full rounded-full transition-all \${state === 'completed' ? 'bg-[#34C759]' : 'bg-[#FF9500]'}\`} style={{ width: \`\${progress}%\` }}></div>
                        </div>
                     </>
                  ) : (
                     <div className="flex items-center justify-center relative w-full pt-4">
                        <Lock size={28} className="text-[#C7C7CC] absolute left-2 opacity-50" />
                        <div className="w-full bg-[#F2F2F7] h-3.5 rounded-full relative ml-8">
                           <span className="absolute right-0 -top-6 text-[11px] font-bold text-[#8E8E93]">0/200</span>
                        </div>
                     </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>`;

content = content.replace(
  /\{\/\* THE QBANK RULE BOOK \*\/\}/,
  JOURNEY_HTML + "\n\n      {/* THE QBANK RULE BOOK */}"
);

fs.writeFileSync(p, content, "utf8");
console.log("Updated gamification tab with rank map");
