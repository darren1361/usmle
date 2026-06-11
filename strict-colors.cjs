const fs = require('fs');
const path = require('path');

const rules = [
  // 1. Remove background opacity modifiers
  { find: /bg-\[#[A-Fa-f0-9]{6}\]\/\d{1,3}/g, replace: (match) => match.split('/')[0] },
  { find: /bg-white\/\d{1,3}/g, replace: 'bg-[#FFFFFF]' },
  { find: /bg-black\/\d{1,3}/g, replace: 'bg-[#1C1C1E]' },
  
  // 2. Remove text, border, and ring opacity modifiers
  { find: /text-\[#[A-Fa-f0-9]{6}\]\/\d{1,3}/g, replace: (match) => match.split('/')[0] },
  { find: /border-\[#[A-Fa-f0-9]{6}\]\/\d{1,3}/g, replace: (match) => match.split('/')[0] },
  { find: /ring-\[#[A-Fa-f0-9]{6}\]\/\d{1,3}/g, replace: (match) => match.split('/')[0] },
  { find: /text-white\/\d{1,3}/g, replace: 'text-[#FFFFFF]' },

  // 3. Map base Tailwind colors to approved hex codes
  { find: /\bbg-white\b/g, replace: 'bg-[#FFFFFF]' },
  { find: /\btext-white\b/g, replace: 'text-[#FFFFFF]' },
  { find: /\bbg-black\b/g, replace: 'bg-[#1C1C1E]' },
  { find: /\btext-black\b/g, replace: 'text-[#1C1C1E]' },
  { find: /\bbg-transparent\b/g, replace: 'bg-transparent' }, // Ignore
  
  // Map standard tailwind grays
  { find: /\b(text|border|ring|bg)-gray-\d{3}\b/g, replace: (match, p1) => {
      if (p1 === 'text' || p1 === 'border' || p1 === 'ring') return p1 + '-[#1C1C1E]';
      return p1 + '-[#F2F2F7]';
  }},
  { find: /\b(text|border|ring|bg)-slate-\d{3}\b/g, replace: (match, p1) => {
      if (p1 === 'text' || p1 === 'border' || p1 === 'ring') return p1 + '-[#1C1C1E]';
      return p1 + '-[#F2F2F7]';
  }},

  // Map unauthorized hex codes
  // Grays/Muted -> F2F2F7 vs 1C1C1E
  { find: /\[#E5E5EA\]/g, replace: '[#F2F2F7]' },
  { find: /\[#F2F2F7\]/g, replace: '[#F2F2F7]' },
  { find: /\[#F8F8F9\]/g, replace: '[#F2F2F7]' },
  { find: /\[#E2E2E7\]/g, replace: '[#F2F2F7]' },
  { find: /\[#8E8E93\]/g, replace: '[#1C1C1E]' },
  { find: /\[#C6C6C8\]/g, replace: '[#F2F2F7]' },
  { find: /\[#3C3C4399\]/g, replace: '[#1C1C1E]' },
  { find: /\[#3C3C43\]/g, replace: '[#1C1C1E]' },
  { find: /\[#3D3D41\]/g, replace: '[#1C1C1E]' },
  { find: /\[#AF52DE\]/g, replace: '[#0088FF]' }, // purple -> blue
  
  // Replace inline styles too if any exist
  { find: /color:\s*'(?:#8E8E93|#3D3D41|#1C1C1E|#3C3C4399)'/g, replace: "color: '#1C1C1E'" },
  { find: /borderColor:\s*'(?:#E5E5EA|#F8F8F9)'/g, replace: "borderColor: '#F2F2F7'" },
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const rule of rules) {
         const newContent = content.replace(rule.find, rule.replace);
         if (newContent !== content) {
            content = newContent;
            modified = true;
         }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated colors in: ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
