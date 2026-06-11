const fs = require('fs');
const path = require('path');

const replacements = {
  // Red
  'bg-red-500': 'bg-[#FF383C]',
  'text-red-400': 'text-[#FF383C]',
  'border-red-500': 'border-[#FF383C]',
  'text-[#D70015]': 'text-[#FF383C]',
  'bg-[#D70015]': 'bg-[#FF383C]',
  'bg-[#D70015]/60': 'bg-[#FF383C]/60', // wait, we will fix transparency next
  
  // Blue
  'bg-blue-600': 'bg-[#0088FF]',
  'text-blue-600': 'text-[#0088FF]',
  'text-blue-900': 'text-[#0088FF]',
  'border-blue-500': 'border-[#0088FF]',
  'bg-[#007AFF]': 'bg-[#0088FF]',
  'text-[#007AFF]': 'text-[#0088FF]',
  'border-[#007AFF]': 'border-[#0088FF]',
  'ring-[#007AFF]': 'ring-[#0088FF]',
  
  // Orange / Amber
  'bg-amber-500': 'bg-[#FF8D28]',
  'text-[#FF9500]': 'text-[#FF8D28]',
  'bg-[#FF9500]': 'bg-[#FF8D28]',
  
  // Green
  'bg-[#34C759]': 'bg-[#34C759]',
  'text-[#34C759]': 'text-[#34C759]',
  
  // Gray 6
  'bg-[#F2F2F7]': 'bg-[#F2F2F7]',
  
  // Black
  'bg-[#1C1C1E]': 'bg-[#1C1C1E]',
  'text-[#1C1C1E]': 'text-[#1C1C1E]',
};

// Regex replacements for default tailwind colors to literal hex colors
const regexReplacements = [
  { regex: /\bbg-blue-\d{3}\b/g, rep: 'bg-[#0088FF]' },
  { regex: /\btext-blue-\d{3}\b/g, rep: 'text-[#0088FF]' },
  { regex: /\bborder-blue-\d{3}\b/g, rep: 'border-[#0088FF]' },
  { regex: /\bring-blue-\d{3}\b/g, rep: 'ring-[#0088FF]' },
  
  { regex: /\bbg-indigo-\d{3}\b/g, rep: 'bg-[#0088FF]' },
  { regex: /\btext-indigo-\d{3}\b/g, rep: 'text-[#0088FF]' },
  { regex: /\bborder-indigo-\d{3}\b/g, rep: 'border-[#0088FF]' },
  
  { regex: /\bbg-sky-\d{3}\b/g, rep: 'bg-[#0088FF]' },
  { regex: /\btext-sky-\d{3}\b/g, rep: 'text-[#0088FF]' },
  
  { regex: /\bbg-red-\d{3}\b/g, rep: 'bg-[#FF383C]' },
  { regex: /\btext-red-\d{3}\b/g, rep: 'text-[#FF383C]' },
  { regex: /\bborder-red-\d{3}\b/g, rep: 'border-[#FF383C]' },
  
  { regex: /\bbg-rose-\d{3}\b/g, rep: 'bg-[#FF383C]' },
  { regex: /\btext-rose-\d{3}\b/g, rep: 'text-[#FF383C]' },
  { regex: /\bborder-rose-\d{3}\b/g, rep: 'border-[#FF383C]' },

  { regex: /\bbg-pink-\d{3}\b/g, rep: 'bg-[#FF383C]' },
  { regex: /\btext-pink-\d{3}\b/g, rep: 'text-[#FF383C]' },

  { regex: /\bbg-amber-\d{3}\b/g, rep: 'bg-[#FF8D28]' },
  { regex: /\btext-amber-\d{3}\b/g, rep: 'text-[#FF8D28]' },
  { regex: /\bborder-amber-\d{3}\b/g, rep: 'border-[#FF8D28]' },
  
  { regex: /\bbg-purple-\d{3}\b/g, rep: 'bg-[#0088FF]' },
  { regex: /\btext-purple-\d{3}\b/g, rep: 'text-[#0088FF]' },
  { regex: /\bborder-purple-\d{3}\b/g, rep: 'border-[#0088FF]' },
  { regex: /\bring-purple-\d{3}\b/g, rep: 'ring-[#0088FF]' },
  
  { regex: /\bbg-emerald-\d{3}\b/g, rep: 'bg-[#34C759]' },
  { regex: /\btext-emerald-\d{3}\b/g, rep: 'text-[#34C759]' },
  { regex: /\bborder-emerald-\d{3}\b/g, rep: 'border-[#34C759]' },
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

      // 1. Literal string replacements
      for (const [find, replace] of Object.entries(replacements)) {
        if (content.includes(find)) {
          content = content.split(find).join(replace);
          modified = true;
        }
      }
      
      // 2. Regex replacements
      for (const rule of regexReplacements) {
         const newContent = content.replace(rule.regex, rule.rep);
         if (newContent !== content) {
            content = newContent;
            modified = true;
         }
      }

      // 3. Transparent backgrounds with text-white -> Solid backgrounds
      // Match pattern: className="... bg-[#HEX]/[NUM] ... text-white ..."
      // We'll just replace `bg-[#FF383C]/60` with `bg-[#FF383C]` IF `text-white` is present anywhere in that className string.
      // Easiest is generic: 
      const clsRegex = /className=(?:\{`|")[^`"]+text-white[^`"]+(?:`\}|")/g;
      const newContent = content.replace(clsRegex, (match) => {
          // within this class string that contains text-white, replace any bg-[#HEX]/NUM with bg-[#HEX]
          return match.replace(/bg-(\[[^\]]+\]|\w+-\d{3})\/\d{1,2}/g, 'bg-$1');
      });
      if (newContent !== content) {
          content = newContent;
          modified = true;
      }
      
      // another variant: text-white might be before bg-HEX/opacity
      const clsRegex2 = /className=(?:\{`|")[^`"]*(?:bg-(\[[^\]]+\]|\w+-\d{3})\/\d{1,2})[^`"]*text-white[^`"]*(?:`\}|")/g;
      const newContent2 = content.replace(clsRegex2, (match) => {
          return match.replace(/bg-(\[[^\]]+\]|\w+-\d{3})\/\d{1,2}/g, 'bg-$1');
      });
      if (newContent2 !== content) {
          content = newContent2;
          modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated colors in: ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
