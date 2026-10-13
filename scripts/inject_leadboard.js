const fs = require('fs');
let content = fs.readFileSync('src/components/sales/sales-hub.tsx', 'utf8');

// Add import if missing
if (!content.includes('import { LeadBoard }')) {
  content = content.replace(
    'import { SalesAskAi } from "./sales-ask-ai";',
    'import { SalesAskAi } from "./sales-ask-ai";\nimport { LeadBoard } from "./lead-board";'
  );
}

// Replace the pipeline section
const startIndex = content.indexOf('{tab==="pipeline"&&<section><form className="quick-form hub-card"');
if (startIndex !== -1) {
  const endIndex = content.indexOf('</section>}', startIndex) + '</section>}'.length;
  content = content.slice(0, startIndex) + '{tab==="pipeline"&&<section><LeadBoard /></section>}' + content.slice(endIndex);
}

fs.writeFileSync('src/components/sales/sales-hub.tsx', content);
