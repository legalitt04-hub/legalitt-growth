const fs = require('fs');
let content = fs.readFileSync('app.config.js', 'utf8');
content = content.replace(/extra: \{/, "extra: {\n      eas: {\n        projectId: ''\n      },");
fs.writeFileSync('app.config.js', content);
console.log('Fixed app.config.js');
