import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/components/GamificationTab.tsx");
let content = fs.readFileSync(p, "utf8");

// Fix the syntax error: Replace the literal interpolation inside JSX
content = content.replace(
  /\{cWeek\?\.monFriCount! > 200 && <span className="text-\[16px\] font-bold opacity-90"> \(\+\$\{cWeek!\.monFriCount - 200\} Extra Coins\)<\/span>\}/g,
  "{cWeek?.monFriCount! > 200 && <span className=\"text-[16px] font-bold opacity-90\">{` (+${cWeek!.monFriCount - 200} Extra Coins)`}</span>}"
);

// We want to add the Rule Book at the bottom before the last </div>
const ruleBookHTML = `

      {/* THE QBANK RULE BOOK */}
      <div className="bg-[#1C1C1E] p-6 rounded-[28px] border border-[#F2F2F7] mt-4">
        <h2 className="text-[20px] font-bold text-[#FFFFFF] mb-2 flex items-center gap-2">
          <Award size={20} className="text-[#007AFF]" /> THE QBANK RULE BOOK
        </h2>
        <p className="text-[12px] text-[#FFFFFF] opacity-80 mb-6 italic">Effective Date: June 7, 2026. (All questions completed prior to this date are archived. They remain untouched but do not count toward these new streaks or debts.)</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[#FFFFFF] text-[14px] font-bold mb-3 uppercase tracking-wider text-[#007AFF]">1. Currency & Goals</h3>
            <ul className="text-[#FFFFFF] text-[13px] space-y-2 opacity-90">
              <li><span className="font-bold text-[#FFCC00]">1 Question = 1 Coin.</span></li>
              <li><span className="font-bold">Daily Target:</span> 40 Coins.</li>
              <li><span className="font-bold">Weekly Target:</span> 200 Coins.</li>
            </ul>

            <h3 className="text-[#FFFFFF] text-[14px] font-bold mb-3 mt-6 uppercase tracking-wider text-[#FF9500]">2. The Rules</h3>
            <ul className="text-[#FFFFFF] text-[13px] space-y-2 opacity-90">
              <li><span className="font-bold">Daily Freedom:</span> Finish your 40 questions anytime before 11:59 PM. How you break them up is entirely up to you.</li>
              <li><span className="font-bold">The Hard Reset:</span> The board resets to 0 every Monday at 5:00 AM.</li>
              <li><span className="font-bold">No Coasting:</span> If you do 250 questions one week, next week's target is still 200. Surpassing the target does not lower future work.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-[#FFFFFF] text-[14px] font-bold mb-3 uppercase tracking-wider text-[#FF3B30]">3. The Penalties</h3>
            <ul className="text-[#FFFFFF] text-[13px] space-y-2 opacity-90">
              <li><span className="font-bold">Weekend Catch-Up:</span> If you miss your 40-question mark on a weekday, you must finish the exact number of missing questions on the weekend.</li>
              <li><span className="font-bold text-[#FF3B30]">Gym Lockdown:</span> If you hit Saturday morning and haven't finished your 200 questions for the week, no gym on Saturday or Sunday until the missing questions are logged.</li>
              <li><span className="font-bold text-[#FF3B30]">The 2-Day Freeze:</span> If it hits Sunday at 11:59 PM and you still haven't hit your 200 weekly questions, you trigger a mandatory gym freeze for Monday and Tuesday. The streak pauses, and the debt carries over.</li>
            </ul>

            <h3 className="text-[#FFFFFF] text-[14px] font-bold mb-3 mt-6 uppercase tracking-wider text-[#4CD964]">4. The Reward Vault</h3>
            <p className="text-[#FFFFFF] text-[12px] opacity-80 mb-2">Rewards require consecutive weekly streaks. You cannot claim a reward if you are currently in a Gym Freeze or owe questions.</p>
            <ul className="text-[#FFFFFF] text-[13px] space-y-2 opacity-90">
              <li><span className="font-bold">1-Week (200 Coins):</span> DQ Blizzard Ice Cream (Unbroken 5-day streak of 40/day)</li>
              <li><span className="font-bold">2-Week (400 Coins):</span> Calisthenics Gear OR Family Outing</li>
              <li><span className="font-bold">3-Week (600 Coins):</span> Active Fitbit Sport Band</li>
              <li><span className="font-bold">4-Week (800 Coins):</span> Hobby Upgrade</li>
              <li><span className="font-bold text-[#FFCC00]">5-Week (1,000 Coins):</span> On Cloud Shoes (Flawless 5-week streak with zero weekend catch-up)</li>
            </ul>
          </div>
        </div>
      </div>
`;

content = content.replace(
  /    <\/div>\n  \);\n\}\n$/,
  ruleBookHTML + "\n    </div>\n  );\n}\n"
);

fs.writeFileSync(p, content, "utf8");
console.log("Syntax fixed and Rulebook added!");
