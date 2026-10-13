const fs = require('fs');
let code = fs.readFileSync('src/components/sales/lead-board.tsx', 'utf8');

// 1. Make refresh silent after initial load
code = code.replace(
  'function refresh() {\n    setLoading(true);\n    salesFeaturesApi.leads().then(setLeads).finally(() => setLoading(false));\n  }',
  'function refresh(silent = false) {\n    if (!silent) setLoading(true);\n    salesFeaturesApi.leads().then(setLeads).finally(() => {\n      if (!silent) setLoading(false);\n    });\n  }'
);

// 2. Change useEffect to use non-silent
code = code.replace(
  'useEffect(refresh, []);',
  'useEffect(() => { refresh(); }, []);'
);

// 3. Make moveLeadToStage optimistic and use silent refresh
code = code.replace(
  'async function moveLeadToStage(id: string, stage: Stage) {\n    setMovingId(id);\n    await salesFeaturesApi.setLeadStage(id, stage).finally(() => setMovingId(null));\n    refresh();\n  }',
  'async function moveLeadToStage(id: string, stage: Stage) {\n    setLeads(current => current.map(l => l.id === id ? { ...l, stage } : l));\n    setMovingId(id);\n    await salesFeaturesApi.setLeadStage(id, stage).finally(() => setMovingId(null));\n    refresh(true);\n  }'
);

fs.writeFileSync('src/components/sales/lead-board.tsx', code);
