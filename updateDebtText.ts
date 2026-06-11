import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/components/GamificationTab.tsx");
let content = fs.readFileSync(p, "utf8");

content = content.replace(
  /<div className="text-\[#FFFFFF\] text-\[12px\] font-medium">\n\s*<span className="font-medium tracking-wide">• Debt Monster Active:<\/span> \{- \(200 - \(cWeek\?\.monFriCount \|\| 0\)\)\} baseline, \{cWeek\.tax\} tax\.\n\s*<\/div>/g,
  `<div className="text-[#FFFFFF]">
                  <span className="text-[36px] font-medium tracking-tight">{- (200 - (cWeek?.monFriCount || 0))}</span> <span className="text-[16px] font-bold opacity-90">baseline, {cWeek.tax} tax</span>
                </div>`
);

content = content.replace(
  /<div className="text-\[#FFFFFF\] text-\[12px\] font-medium tracking-wide">\n\s*Ahead of debt curve\.\n\s*\{cWeek\?\.monFriCount! > 200 && ` \(\+\$\{cWeek!\.monFriCount - 200\} Tokens\)`\}\n\s*<\/div>/g,
  `<div className="text-[#FFFFFF]">
                  <span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">Ahead of debt curve.</span>
                  {cWeek?.monFriCount! > 200 && <span className="text-[16px] font-bold opacity-90"> (+$\{cWeek!.monFriCount - 200\} Tokens)</span>}
                </div>`
);

fs.writeFileSync(p, content, "utf8");
console.log("Updated Debt Monster text");
