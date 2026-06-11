const fs = require('fs');
const path = require('path');

const classes = new Set();
const regex = /\b(bg|text|border|ring|shadow|from|to|via)-[a-z]+-[0-9]{2,3}(\/[0-9]{1,2})?\b/g;

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      let match;
      while ((match = regex.exec(content)) !== null) {
        classes.add(match[0]);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
console.log(Array.from(classes).sort().join('\n'));
