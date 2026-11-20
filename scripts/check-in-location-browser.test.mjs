import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import express from 'express';
import cors from 'cors';

test('mock GPS desktop/mobile check-ins preserve history, permissions, exact map links and automatic Admin updates',{skip:process.env.CRM_LOCATION_BROWSER_TEST!=='1',timeout:120000},async()=>{
  const root=mkdtempSync(join(tmpdir(),'psspl-location-browser-'));
  Object.assign(process.env,{NODE_ENV:'test',CRM_DATABASE_PATH:join(root,'test.sqlite'),CRM_TEST_DATABASE_ROOT:root,CRM_DISABLE_BASELINE_RESTORE:'true'});
  const {db}=await import('../server/db.mjs');
  const {authenticate,createSession}=await import('../server/auth.mjs');
  const {dailyFieldActivity,indiaBusinessDate}=await import('../server/field-activity.mjs');
  const {createCheckInRouter}=await import('../server/check-in-routes.mjs');
  const {createCheckInGeocoder}=await import('../server/check-in-geocoder.mjs');
  const {adminRouter}=await import('../server/admin.mjs');
  const {pipelineRouter}=await import('../server/pipeline-sync.mjs');
  const {salesRouter}=await import('../server/sales-routes.mjs');
  const {chromium,expect}=await import('@playwright/test');
  const ids=['admin','gps-a','gps-b','denied','coarse','api-scope'];
  for(const id of ids){
    db.prepare('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)').run(id,id+'@test.invalid','synthetic',id==='admin'?'admin':'rm');
    db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory) VALUES(?,?,?,'Test','Test')").run(id,id,id);
  }
  const tokens=Object.fromEntries(ids.map(id=>[id,createSession(id).token]));
  db.exec("INSERT INTO attendance(id,user_id,business_date,check_in_at,latitude,longitude) VALUES('historical','gps-a','2026-10-01','2026-10-01T04:00:00Z',12.3,45.6)");
  function buildDay(id){
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(id);
    const a=db.prepare('SELECT * FROM attendance WHERE user_id=? AND business_date=?').get(id,indiaBusinessDate());
    const time=value=>value?new Date(value).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}):null;
    return {salesperson:{id,email:user.email,role:user.role,name:id,region:'Test',territory:'Test',checkedInAt:time(a?.check_in_at),checkedOutAt:time(a?.check_out_at),trackingActive:!!a&&!a.check_out_at},
      visits:[],followUps:[],calls:[],attendanceHistory:db.prepare('SELECT business_date businessDate,check_in_at checkInAt,check_out_at checkOutAt,latitude,longitude,gps_accuracy_meters gpsAccuracyMeters,location_address locationAddress,location_address_status locationAddressStatus FROM attendance WHERE user_id=?').all(id),
      performance:{actual:0,target:0},summary:{expectedOrderValue:0,expectedOrderCount:0,followUpsCreated:0,productsDiscussed:0,...dailyFieldActivity(db,id,indiaBusinessDate()).summary},
      tally:{connected:false},referenceData:{customers:[],products:[]}};
  }
  const resolveAddress=createCheckInGeocoder(db,{endpoint:'https://approved-geocoder.test/reverse',fetcher:async url=>{
    const lat=new URL(url).searchParams.get('lat');
    if(lat==='24.04')return new Response('',{status:503});
    await new Promise(resolve=>setTimeout(resolve,300));
    return new Response(JSON.stringify({lat,lon:new URL(url).searchParams.get('lon'),address:{suburb:'Mock Locality',road:'Mock Road',city:'Mock City',state:'Mock State',postcode:'380009'}}));
  }});
  const app=express();app.use(cors({origin:true,credentials:true}));app.use(express.json());
  app.use('/api/admin',adminRouter);app.use('/api/pipeline',pipelineRouter);
  app.use('/api/sales',salesRouter);
  app.get('/api/auth/me',authenticate,(req,res)=>res.json({user:req.user}));
  app.get('/api/salespeople/me/my-day',authenticate,(req,res)=>res.json(buildDay(req.user.id)));
  app.use('/api/salespeople/me',createCheckInRouter({buildSalesDay:async id=>buildDay(id),resolveAddress}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch();const contexts=[];const errors=[];
  try{
    async function open(id,{mode='success',latitude=23.03,longitude=72.56,accuracy=15,mobile=false}={}){
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});contexts.push(context);
      await context.addInitScript(({id,token,mode,latitude,longitude,accuracy})=>{
        localStorage.setItem('psspl_crm_session',token);localStorage.setItem('psspl_crm_user',JSON.stringify({id,email:id+'@test.invalid',role:id==='admin'?'admin':'rm'}));
        window.__gpsCalls=0;window.__gpsWatches=0;
        const realFetch=window.fetch.bind(window);
        window.fetch=(input,init)=>{
          if(typeof input==='string'){const url=new URL(input,location.href);if(url.pathname.startsWith('/api/'))input=url.pathname+url.search;}
          return realFetch(input,init);
        };
        Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success,error,options){window.__gpsCalls++;window.__gpsOptions=options;setTimeout(()=>mode==='success'?success({coords:{latitude,longitude,accuracy},timestamp:Date.now()}):error({code:mode==='denied'?1:3}),0);},watchPosition(){window.__gpsWatches++;throw Error('Unexpected background tracking');},clearWatch(){}}});
      },{id,token:tokens[id],mode,latitude,longitude,accuracy});
      await context.route('**/api/**',route=>{const url=new URL(route.request().url());return route.continue({url:base+url.pathname+url.search});});
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto((process.env.CRM_LOCATION_FRONTEND_URL||'http://localhost:3000')+(id==='admin'?'/admin':'/sales/my-day'),{waitUntil:'domcontentloaded',timeout:60000});
      return page;
    }
    const admin=await open('admin');await expect(admin.getByRole('heading',{name:'Where the team checked in'})).toBeVisible({timeout:30000});
    const a=await open('gps-a'),b=await open('gps-b',{latitude:24.04,longitude:73.57,mobile:true});
    await expect(a.getByRole('button',{name:'Check In',exact:true})).toBeVisible({timeout:30000});
    assert.equal(await a.evaluate(()=>window.__gpsCalls),0,'no geolocation call on page load');
    await Promise.all([a.getByRole('button',{name:'Check In',exact:true}).click(),b.getByRole('button',{name:'Check In',exact:true}).click()]);
    const row=id=>admin.locator('.teammap-person').filter({has:admin.locator('strong',{hasText:new RegExp('^'+id+'$')})});
    await expect(row('gps-a')).toContainText('Mock Locality',{timeout:20000});
    await expect(row('gps-a')).toContainText('±15 meters');await expect(row('gps-b')).toContainText('Address unavailable',{timeout:20000});
    await expect(row('gps-b')).toContainText('±15 meters');
    assert.equal(new URL(await row('gps-a').getByRole('link',{name:'View Map',exact:true}).getAttribute('href')).searchParams.get('query'),'23.03,72.56');
    assert.equal(new URL(await row('gps-b').getByRole('link',{name:'View Map',exact:true}).getAttribute('href')).searchParams.get('query'),'24.04,73.57');
    for(const page of [a,b]){assert.equal(await page.evaluate(()=>window.__gpsCalls),1);assert.equal(await page.evaluate(()=>window.__gpsWatches),0);}
    const history=db.prepare("SELECT latitude,longitude,gps_accuracy_meters FROM attendance WHERE id='historical'").get();assert.equal(history.latitude,12.3);assert.equal(history.longitude,45.6);assert.equal(history.gps_accuracy_meters,null);
    const denied=await open('denied',{mode:'denied',mobile:true});await denied.getByRole('button',{name:'Check In',exact:true}).click();
    await expect(denied.getByText(/Location permission was denied/)).toBeVisible();assert.equal(db.prepare("SELECT COUNT(*) count FROM attendance WHERE user_id='denied'").get().count,0);
    const coarse=await open('coarse',{accuracy:800});await coarse.getByRole('button',{name:'Check In',exact:true}).click();
    await expect(coarse.getByRole('button',{name:/Accept low accuracy/})).toBeVisible();assert.equal(db.prepare("SELECT COUNT(*) count FROM attendance WHERE user_id='coarse'").get().count,0);
    await coarse.getByRole('button',{name:/Accept low accuracy/}).click();await expect(coarse.getByRole('button',{name:'Checked In',exact:true})).toBeVisible();
    assert.equal(db.prepare("SELECT gps_accuracy_meters FROM attendance WHERE user_id='coarse'").get().gps_accuracy_meters,800);
    const unauthorized=await fetch(base+'/api/admin/activity',{headers:{Authorization:`Bearer ${tokens['gps-a']}`}});assert.equal(unauthorized.status,403);
    const unauthenticated=await fetch(base+'/api/salespeople/me/check-in',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unauthenticated.status,401);
    const scoped=await fetch(base+'/api/salespeople/me/check-in',{method:'POST',headers:{Authorization:`Bearer ${tokens['api-scope']}`,'Content-Type':'application/json'},body:JSON.stringify({userId:'gps-a'})});assert.equal(scoped.status,200);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM attendance WHERE user_id='api-scope'").get().count,1,'client-supplied userId cannot select another RM');
    db.exec("INSERT INTO location_pings(id,user_id,latitude,longitude,accuracy,captured_at) VALUES('india-midnight','gps-a',12.4,45.7,10,'2026-09-30 20:00:00')");
    const historic=await(await fetch(base+'/api/admin/activity/movement?userId=gps-a&date=2026-10-01',{headers:{Authorization:`Bearer ${tokens.admin}`}})).json();assert.ok(historic.points.some(point=>point.latitude===12.4),'historical movement uses India business day');assert.equal(historic.attendance.latitude,12.3);
    const adminCheckIn=await fetch(base+'/api/salespeople/me/check-in',{method:'POST',headers:{Authorization:`Bearer ${tokens.admin}`,'Content-Type':'application/json'},body:'{}'});assert.equal(adminCheckIn.status,403);
    const retry=await fetch(base+'/api/salespeople/me/check-in',{method:'POST',headers:{Authorization:`Bearer ${tokens['gps-a']}`,'Content-Type':'application/json'},body:JSON.stringify({latitude:1,longitude:2,accuracy:1,capturedAt:new Date().toISOString(),userId:'gps-b'})});assert.equal(retry.status,409);
    assert.equal(db.prepare("SELECT latitude FROM attendance WHERE user_id='gps-a' AND business_date=?").get(indiaBusinessDate()).latitude,23.03);
    await a.getByRole('button',{name:'Check Out',exact:true}).click();
    await expect(a.getByRole('button',{name:'Checked Out',exact:true})).toBeDisabled();
    await expect(a.getByRole('status')).toContainText('Checked out successfully');
    await expect(a.locator('.error-banner')).toHaveCount(0);
    const withoutGps=await open('api-scope',{mode:'denied',mobile:true});
    await expect(withoutGps.getByText('No GPS check-in location was recorded')).toBeVisible();
    await withoutGps.getByRole('button',{name:'Check Out',exact:true}).click();
    await expect(withoutGps.getByRole('button',{name:'Checked Out',exact:true})).toBeDisabled();
    await expect(withoutGps.getByRole('status')).toContainText('Check-out saved without a final GPS fix.');
    await expect(withoutGps.locator('.error-banner')).toHaveCount(0);
    mkdirSync('scratch/check-in-location',{recursive:true});await admin.screenshot({path:'scratch/check-in-location/admin-mock-gps.png',fullPage:true});
    await admin.setViewportSize({width:390,height:844});
    await row('gps-a').scrollIntoViewIfNeeded();await expect(row('gps-a').getByRole('link',{name:'View Map',exact:true})).toBeVisible();
    assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,'address metadata does not overflow the mobile page');
    await admin.screenshot({path:'scratch/check-in-location/admin-mobile-mock-gps.png',fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{
    for(const context of contexts)await context.close();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    db.close();rmSync(root,{recursive:true,force:true});
  }
});
