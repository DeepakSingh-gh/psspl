const fs = require('fs');
let code = fs.readFileSync('src/components/sales/lead-board.tsx', 'utf8');

code = code.replace(/useEffect\(\(\) => \{ salesFeaturesApi\.products\?\.\(\)\.then\(setProducts\)\.catch\(\(\)=>setProducts\(\[\]\)\); \}, \[\]\);/, '');

fs.writeFileSync('src/components/sales/lead-board.tsx', code);
