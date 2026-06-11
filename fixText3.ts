import fs from 'fs';
import path from 'path';

const files = [
  'src/components/StatsDashboard.tsx',
  'src/components/GamificationTab.tsx',
  'src/components/FocusTimer.tsx'
];

for (const file of files) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');

  // Days of week and day counts: font-bold
  // StatsDashboard
  content = content.replace(/text-\[10px\] text-\[#FFFFFF\] opacity-90 font-medium/g, 'text-[10px] text-[#FFFFFF] font-bold');
  content = content.replace(/text-\[10px\] font-medium tracking-wide text-center/g, 'text-[10px] font-bold text-center');

  // StatsDashboard main numbers sizing
  // Today count / target
  content = content.replace(/text-\[14px\] font-medium text-\[#FFFFFF\] opacity-90/g, 'text-[36px] font-medium tracking-tight text-[#FFFFFF] opacity-90');
  
  // GamificationTab target size 
  // <span className="text-[14px] font-medium text-[#FFFFFF] opacity-90">
  //                 / 200 Mon-Fri
  //               </span>
  // wait, the gamification tab 32px is matched here:
  content = content.replace(/span className="text-\[14px\] font-medium text-\[#FFFFFF\] opacity-90"/g, 'span className="text-[32px] font-medium tracking-tight text-[#FFFFFF] opacity-90"');

  // FocusTimer box internal shaded background
  // <div className="bg-black/10 p-2 rounded-xl mb-2 text-center border border-transparent">
  content = content.replace(/<div className="bg-black\/10 p-2 rounded-xl mb-2 text-center border border-transparent">/g, '<div className="mb-2 text-center">');

  // FocusTimer font sizes and styles to match
  content = content.replace(/<div className="text-5xl  font-medium tracking-wide text-\[#000000\] tracking-tighter">/g, '<div className="text-[36px] font-medium tracking-tight text-[#000000]">');
  // and buttons in timer:
  content = content.replace(/px-3 py-1 rounded-full text-\[13px\] font-bold/g, 'px-3 py-1 rounded-full text-[13px] font-bold');

  fs.writeFileSync(p, content, 'utf8');
}
console.log('Fixed text sizes and borders!');
