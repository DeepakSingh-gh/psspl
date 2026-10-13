const fs = require('fs');
let code = fs.readFileSync('src/components/sales/lead-board.tsx', 'utf8');

// 1. Add dragging state
code = code.replace(
  'const [movingId, setMovingId] = useState<string | null>(null);',
  'const [movingId, setMovingId] = useState<string | null>(null);\n  const [dragging, setDragging] = useState<string | null>(null);\n  const [overStage, setOverStage] = useState<string | null>(null);'
);

// 2. Add moveLeadStage function
code = code.replace(
  'function refresh() {',
  'async function moveLeadToStage(id: string, stage: Stage) {\n    setMovingId(id);\n    await salesFeaturesApi.setLeadStage(id, stage).finally(() => setMovingId(null));\n    refresh();\n  }\n\n  function refresh() {'
);

// 3. Add drag events to columns
code = code.replace(
  '<div key={stage} className="kanban-col" style={{ width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", height: "100%" }}>',
  '<div key={stage} className="kanban-col" style={{ width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", height: "100%", transform: overStage === stage ? "scale(1.02)" : "scale(1)", transition: "transform 0.2s" }}\n              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overStage !== stage) setOverStage(stage); }}\n              onDragLeave={() => setOverStage((current) => current === stage ? null : current)}\n              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragging; setOverStage(null); setDragging(null); if (id) moveLeadToStage(id, stage as Stage); }}\n            >'
);

// 4. Add drag events to cards
code = code.replace(
  '<div key={lead.id} className="kanban-card" style={{ background: "#ffffff", borderRadius: "10px", padding: "1rem", border: "1px solid #e2e8f0", cursor: "pointer", position: "relative", overflow: "hidden" }} onClick={() => toggleExpand(lead.id)}>',
  '<div key={lead.id} className="kanban-card" draggable onDragStart={(e) => { setDragging(lead.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", lead.id); }} onDragEnd={() => { setDragging(null); setOverStage(null); }} style={{ background: "#ffffff", borderRadius: "10px", padding: "1rem", border: "1px solid #e2e8f0", cursor: "grab", position: "relative", overflow: "hidden", opacity: dragging === lead.id ? 0.5 : 1 }} onClick={() => toggleExpand(lead.id)}>'
);

fs.writeFileSync('src/components/sales/lead-board.tsx', code);
console.log("Drag drop added successfully.");
