const fs = require('fs');
let code = fs.readFileSync('src/components/sales/lead-board.tsx', 'utf8');

const targetStr = '{lead.company && <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>🏢 {lead.company}</div>}';
const replacementStr = targetStr + '\n                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500, marginTop: "0.25rem" }}>📍 {lead.city || "Location pending"}</div>';

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/sales/lead-board.tsx', code);
