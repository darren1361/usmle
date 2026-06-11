import fs from 'fs';
import path from 'path';

const files = [
  'src/components/FocusTimer.tsx',
  'src/components/StatsDashboard.tsx',
  'src/components/GamificationTab.tsx'
];

const stringReplacements = [
  ["Total balance", "Total Balance"],
  ["Grand target", "Grand Target"],
  ["Current cycle", "Current Cycle"],
  ["Active enforcement", "Active Enforcement"],
  ["Reward vault", "Reward Vault"],
  ["Gym lockdown", "Gym Lockdown"],
  ["2-Day freeze", "2-Day Freeze"],
  ["Debt monster active", "Debt Monster Active"],
  ["Daily question goal", "Daily Question Goal"],
  ["Weekly question goal", "Weekly Question Goal"],
  ["Required pacing", "Required Pacing"],
];

for (const file of files) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');

  // Apply title capitalizations
  for (const [find, replace] of stringReplacements) {
    content = content.replace(find, replace);
  }

  // Update sizes and weights for titles
  content = content.replace(/text-\[14px\] font-medium tracking-wide/g, "text-[16px] font-bold");
  content = content.replace(/text-\[11px\] font-medium tracking-wide/g, "text-[13px] font-bold");

  content = content.replace(/text-sm font-medium tracking-wide text-\[#000000\]/g, "text-sm font-bold text-[#000000]");

  // In GamificationTab, Total Balance is at index 164:
  // <h3 className="text-[14px] font-medium tracking-wide text-[#FFFFFF] mb-1">Total balance</h3>
  content = content.replace(/text-\[14px\] font-medium tracking-wide text-\[#FFFFFF\]/g, "text-[16px] font-bold text-[#FFFFFF]");

  fs.writeFileSync(p, content, 'utf8');
}
console.log('Fixed titles and fonts!');
