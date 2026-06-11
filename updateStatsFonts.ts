import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/components/StatsDashboard.tsx");
let content = fs.readFileSync(p, "utf8");

content = content.replace(
  /<span className="inline-block px-3 py-1 bg-white\/20 text-\[#FFFFFF\] text-\[12px\] font-medium tracking-wide rounded-full">\s*\{studyTaskProgress\.weekly\.target - studyTaskProgress\.weekly\.completed\} more needed\s*<\/span>/,
  '<span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">\n                {studyTaskProgress.weekly.target - studyTaskProgress.weekly.completed} <span className="text-[16px] font-bold opacity-90">more needed</span>\n              </span>'
);

content = content.replace(
  /<span className="inline-block px-3 py-1 bg-\[#FFFFFF\] text-\[#5856D6\] text-\[12px\] font-medium tracking-wide rounded-full">\s*Goal met\s*<\/span>/,
  '<span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">\n                Goal met\n              </span>'
);

content = content.replace(
  /<span className="inline-block px-3 py-1 bg-white\/20 text-\[#FFFFFF\] text-\[12px\] font-medium tracking-wide rounded-full">\s*\{Math\.max\(0, \(studyTaskProgress\.weekly\.requiredDailyToPace \|\| 0\) - studyTaskProgress\.todayData\.count\)\} more to stay on track\s*<\/span>/,
  '<span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">\n                  {Math.max(0, (studyTaskProgress.weekly.requiredDailyToPace || 0) - studyTaskProgress.todayData.count)} <span className="text-[16px] font-bold opacity-90">more to stay on track</span>\n                </span>'
);

content = content.replace(
  /<span className="inline-block px-3 py-1 bg-\[#FFFFFF\] text-\[#FF2D55\] text-\[12px\] font-medium tracking-wide rounded-full">\s*Daily pace matched!\s*<\/span>/,
  '<span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">\n                  Daily pace matched!\n                </span>'
);

content = content.replace(
  /<span className="inline-block px-3 py-1 bg-\[#FFFFFF\] text-\[#FF2D55\] text-\[12px\] font-medium tracking-wide rounded-full">\s*Pacing disabled\s*<\/span>/,
  '<span className="text-[36px] font-medium tracking-tight text-[#FFFFFF]">\n                Pacing disabled\n              </span>'
);

fs.writeFileSync(p, content, "utf8");
console.log("Updated StatsDashboard.tsx");
