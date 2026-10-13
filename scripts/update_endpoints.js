const fs = require('fs');
let c = fs.readFileSync('server/app.mjs', 'utf8');
c = c.replace(/AND status='planned'/g, '');
c = c.replace('app.patch("/api/follow-ups/:id/toggle"', 'app.delete("/api/follow-ups/:id", authenticate, async (req, res, next) => { try { db.prepare("DELETE FROM follow_ups WHERE id=? AND user_id=?").run(req.params.id, req.user.id); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });\n  app.patch("/api/follow-ups/:id/toggle"');
fs.writeFileSync('server/app.mjs', c);
