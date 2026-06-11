import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/components/GamificationTab.tsx");
let content = fs.readFileSync(p, "utf8");

content = content.replace(/\(\+\$\{cWeek!\.monFriCount - 200\} Tokens\)/, "(+${cWeek!.monFriCount - 200} Extra Coins)");

fs.writeFileSync(p, content, "utf8");
