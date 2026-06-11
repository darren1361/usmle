const fs = require('fs');
const path = require('path');

const UI_CONFIG = {
  componentReplacements: {
    '#007AFF': '#0088FF', // blue
    '#FF9500': '#FF8D28', // orange
    '#D70015': '#FF383C', // red
    '#FF3B30': '#FF383C', // red alternative
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
      
      let modified = false;
      for (const [find, replace] of Object.entries(UI_CONFIG.componentReplacements)) {
        if (content.includes(find)) {
          content = content.split(find).join(replace);
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
