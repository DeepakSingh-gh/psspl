const fs = require('fs');
let c = fs.readFileSync('src/components/sales/lead-board.tsx', 'utf8');

c = c.replace(/products=\{products\}/g, '');
c = c.replace(/const \[products, setProducts\].*?\]\);/g, '');
c = c.replace(/\{products.*?; \}/, '');
c = c.replace(/<label><span style=\{labelStyle\}>Interested Product<[\s\S]*?<\/label>/, '');
c = c.replace(/interestedProductId: form\.get\("interestedProductId"\), /, '');
c = c.replace(/function LeadForm\(\{.*\}\) \{/, 'function LeadForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void; }) {');

fs.writeFileSync('src/components/sales/lead-board.tsx', c);
