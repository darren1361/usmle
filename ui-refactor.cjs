const fs = require('fs');
const path = require('path');

const UI_CONFIG = {
  fontDisplayReplacements: [
    { find: 'font-display', replace: 'font-sans' }
  ],
  componentReplacements: {
    // 1. Debt Monster Card
    'bg-[#FF3B30]/10': 'bg-[#FFE5E5]',
    'text-[#FF3B30]/80': 'text-[#D70015]',
    'text-[#FF3B30]': 'text-[#D70015]', // Use deep crimson
    'bg-[#F2F2F7] text-[#FF3B30] border-transparent': 'bg-[#FFE5E5] text-[#D70015] border-transparent',
    'bg-rose-500/20 text-[#FF3B30]': 'bg-[#FFE5E5] text-[#D70015]',
    'bg-rose-500/70': 'bg-[#FF3B30]',
    
    // Progress track colors
    'w-full bg-[#E5E5EA] h-2.5 rounded-full': 'w-full bg-[#E5E5EA] h-2 rounded-full',
    
    // Days dots matching
    'bg-[#F2F2F7] border-transparent text-[#007AFF]': 'bg-[#E5F0FF] border-transparent text-[#007AFF]',
    'ring-2 ring-blue-500/30': 'ring-2 ring-[#007AFF]/30',

    // Currency Capsules
    'text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest': 'text-[11px] text-[#8E8E93] font-semibold uppercase tracking-wider',
    'text-xl font-bold font-mono text-[#34C759] flex items-center gap-1': 'text-xl font-semibold text-[#34C759] flex items-center gap-1',
    'text-xl font-bold font-mono text-[#FF9500] flex items-center gap-1': 'text-xl font-semibold text-[#FF9500] flex items-center gap-1',

    // Cards and Containers standardization
    'shadow-[0_8px_30px_rgb(230,200,205,0.4)]': 'shadow-sm',
    'rounded-[32px]': 'rounded-2xl',
    'rounded-[20px]': 'rounded-2xl',

    // Stats Dashboard outer wrappers
    'bg-[#F2F2F7] border-b border-[#E5E5EA] p-5 md:p-6': 'bg-transparent border-b border-[#E5E5EA] p-5 md:p-6',
    
    // Clean up random gray backgrounds
    'bg-[#F8F8F9]/40': 'bg-[#F2F2F7]',
    
    // Toggles and inputs
    'bg-[#E5E5EA] text-[#8E8E93] border border-[#E5E5EA] hover:text-black': 'bg-[#F2F2F7] text-[#8E8E93] hover:text-black',
  }
};

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Apply replacements
      for (const [find, replace] of Object.entries(UI_CONFIG.componentReplacements)) {
        content = content.split(find).join(replace);
      }
      for (const rep of UI_CONFIG.fontDisplayReplacements) {
        content = content.split(rep.find).join(rep.replace);
      }
      
      // Extra manual fixes via Regex if needed
      // Fix fonts from font-display -> font-sans
      content = content.replace(/font-display/g, 'font-sans');
      
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Processed: ${fullPath}`);
    }
  }
}

// Run against src directory
processDirectory(path.join(__dirname, 'src'));
