const db = require('better-sqlite3')('data/crm.sqlite');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='visits'").get().sql);
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='follow_ups'").get().sql);
