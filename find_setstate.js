const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      search(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/set[A-Z]\w*\(/) && !line.includes('useEffect') && !line.includes('useCallback') && !line.includes('=>') && !line.includes('function') && !line.includes('onClick') && !line.includes('onChange') && !line.includes('onSubmit') && !line.includes('catch') && !line.includes('then')) {
          console.log(fullPath + ':' + (i+1) + ': ' + line.trim());
        }
      }
    }
  }
}
search('./src');
