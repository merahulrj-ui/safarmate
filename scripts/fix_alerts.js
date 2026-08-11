const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (!filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace Platform.OS condition blocks
  content = content.replace(/if\s*\(\s*Platform\.OS\s*!==\s*'web'\s*\)\s*Alert\.alert\(([^)]+)\);\s*else\s*alert\([^)]+\);/g, 'showAlert($1);');
  content = content.replace(/if\s*\(\s*typeof\s*window\s*!==\s*'undefined'\s*&&\s*window\.alert\s*\)\s*\{\s*window\.alert\(([^)]+)\);\s*\}\s*else\s*\{\s*alert\([^)]+\);\s*\}/g, 'showAlert("Notification", $1);');
  
  // Replace direct alerts
  content = content.replace(/(?<!\.)alert\(([^)]+)\)/g, 'showAlert("Notification", $1)');
  
  // Replace Alert.alert
  content = content.replace(/Alert\.alert\(([^)]+)\)/g, 'showAlert($1)');

  if (content !== original) {
    if (!content.includes('import { showAlert } from')) {
      content = `import { showAlert } from '@/utils/alert';\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + filePath);
  }
});
