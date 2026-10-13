const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve(raw);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const login = await post('/api/auth/login', { email: 'admin@psspl.com', password: 'psspl-admin-2026' });
  const token = login.token;
  console.log('Login successful. Token acquired.');

  const team = await get('/api/admin/team', token);
  console.log('\n--- ADMIN TEAM ---');
  console.log('Total members:', team.members?.length);
  console.log('Thrust leaderboard items:', team.thrustLeaderboard?.length);
  if (team.thrustLeaderboard?.length) {
    console.log('Top Thrust RMs:');
    team.thrustLeaderboard.slice(0, 3).forEach((item, i) => {
      console.log(` ${i + 1}. ${item.name}: ₹${item.thrustSalesLakh} Lac (${item.thrustActiveCount} active products, top: ${item.thrustTopProduct})`);
    });
  }

  const rmDetail = await get('/api/admin/team/aniljenafield', token);
  console.log('\n--- RM DETAIL: Anil Jena ---');
  console.log('RM Code:', rmDetail.rmCode);
  console.log('Operating Cities:', rmDetail.operatingCities);
  console.log('Special Achievements:', rmDetail.specialAchievements?.map(a => `${a.badge}: ${a.metric} (${a.title})`));
  console.log('Monthly Target vs Actual Count:', rmDetail.monthlyTargetVsActual?.length);
  console.log('Thrust Products Active Count:', rmDetail.thrustProducts?.activeCount);
  console.log('Thrust Products Total Lakh:', rmDetail.thrustProducts?.totalYtdLakh);
  console.log('Thrust Products Breakdown:');
  rmDetail.thrustProducts?.products?.forEach(p => {
    console.log(` - ${p.name.padEnd(25)}: ₹${p.ytdSalesLakh.toFixed(2)} Lac | Sold: ${p.isSold ? 'YES' : 'No'}`);
  });
}

run().catch(console.error);
