const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.expo' && file !== 'assets') {
        filelist = walkSync(filePath, filelist);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      filelist.push(filePath);
    }
  });
  return filelist;
};

const files = walkSync(path.join(process.cwd(), 'src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = content;
  
  updated = updated.replace(/fontWeight:\s*['"](400|normal)['"]/g, "fontFamily: 'Outfit_400Regular'");
  updated = updated.replace(/fontWeight:\s*['"]500['"]/g, "fontFamily: 'Outfit_500Medium'");
  updated = updated.replace(/fontWeight:\s*['"](600|bold)['"]/g, "fontFamily: 'Outfit_600SemiBold'");
  updated = updated.replace(/fontWeight:\s*['"](700|800|900)['"]/g, "fontFamily: 'Outfit_700Bold'");
  
  // also inject Outfit_400Regular for plain Text elements that don't have font weights, 
  // but it's safer to just let default handle it, or we can just apply globally via Text styling.
  
  if (content !== updated) {
    fs.writeFileSync(file, updated);
    console.log('Updated font family in', file);
  }
});
