import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/components/GamificationTab.tsx");
let content = fs.readFileSync(p, "utf8");

content = content.replace(
  /<div className="w-\[1px\] h-10 bg-\[#FFFFFF\] opacity-20"><\/div>\n\s*<div className="flex flex-col items-end">\n\s*<span className="text-\[12px\] font-medium text-\[#FFFFFF\]">Tokens<\/span>\n\s*<span className="text-\[20px\] font-medium tracking-wide text-\[#FFFFFF\] flex items-center gap-1\.5">\n\s*<Trophy size=\{18\} \/> \{engine\.totalGT\.toLocaleString\(\)\}\n\s*<\/span>\n\s*<\/div>/g,
  ""
);

content = content.replace(
  /<div>\n\s*<div className="flex justify-between text-\[12px\] font-medium tracking-wide text-\[#FFFFFF\] mb-1">\n\s*<span className="flex items-center gap-1"><Trophy size=\{12\} \/> Tokens<\/span>\n\s*<span>\{engine\.totalGT\} <span className="opacity-60">\/ 50<\/span><\/span>\n\s*<\/div>\n\s*<div className="w-full bg-white\/20 h-2 rounded-full overflow-hidden">\n\s*<div className="h-full bg-\[#FFFFFF\] transition-all duration-1000" style=\{\{ width: `\$\{Math\.min\(100, \(engine\.totalGT \/ 50\) \* 100\)\}%` \}\} \/>\n\s*<\/div>\n\s*<\/div>/g,
  ""
);

content = content.replace(
  /<p className="text-\[12px\] text-\[#FFFFFF\] opacity-80">Use tokens for explicit rewards\.<\/p>/,
  ""
);

fs.writeFileSync(p, content, "utf8");
console.log("Removed tokens from UI");
