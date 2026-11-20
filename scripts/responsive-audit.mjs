// Read-only browser audit against an isolated snapshot of the existing CRM.
// Run with the local Next dev server running: node scripts/responsive-audit.mjs
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const root = process.cwd();
const apiPort=process.env.PSSPL_RESPONSIVE_API_PORT||'4401';
const apiBase=`http://127.0.0.1:${apiPort}`;
const evidence = resolve('docs/uat/responsive-2026-11-20');
mkdirSync(evidence, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'psspl-responsive-'));
const source = new DatabaseSync(resolve('data/crm.sqlite'), { readOnly: true });
const database = join(scratch, 'audit.sqlite');
await backup(source, database);
source.close();
const db = new DatabaseSync(database);
const users = {};
for (const role of ['admin', 'rm', 'salesperson']) {
  const user = db.prepare('SELECT id,email,role FROM users WHERE active=1 AND role=? ORDER BY id LIMIT 1').get(role);
  assert.ok(user, `Existing ${role} account required`);
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'), user.id, new Date(Date.now()+3600000).toISOString());
  users[role] = { ...user, token };
}
let manager = users.rm.id;
db.close();
const env = { ...process.env, NODE_ENV: 'test', CRM_DATABASE_PATH: database, CRM_TEST_DATABASE_ROOT: scratch, CRM_DISABLE_BASELINE_RESTORE: 'true', CRM_ENABLE_REPORT_SCHEDULER: 'false', CRM_ENABLE_WEBINAR_DEMO_DATA: 'false', WHATSAPP_DELIVERY_ENABLED: 'false', HOST: '127.0.0.1', PORT:apiPort };
for (const key of Object.keys(env)) if (/OPENAI|GEMINI|ANTHROPIC|CLAUDE|SMTP|RESEND|SUPABASE|DATABASE_URL|DIRECT_URL|CRM_ADMIN|WHATSAPP_(?!DELIVERY_ENABLED)/i.test(key)) delete env[key];
const api = spawn(process.execPath, ['server/app.mjs'], { cwd: root, env, stdio: ['ignore','pipe','pipe'], windowsHide: true });
let serverLog = '';
api.stdout.on('data', data => serverLog += data);
api.stderr.on('data', data => serverLog += data);
let browser;
const results = { mode: process.argv.includes('--navigation') ? 'navigation' : process.argv.includes('--interactions') ? 'interactions' : 'full', started: new Date().toISOString(), data: 'Temporary snapshot of existing local records; sessions created only in snapshot.', routes: [], navigation: [], interactions: [], errors: [] };
const base = process.env.PSSPL_RESPONSIVE_URL || 'http://localhost:3000';
const widths = [320,375,390,768,1024,1440,1920];
try {
  let ready = false;
  for (let n=0;n<100;n++) {
    if (api.exitCode !== null) throw new Error(`Audit API exited: ${serverLog}`);
    try { if ((await fetch(`${apiBase}/api/health`)).ok) { ready=true;break; } } catch {}
    await new Promise(r=>setTimeout(r,200));
  }
  assert.ok(ready, 'Isolated API must become ready');
  const team = await fetch(`${apiBase}/api/admin/team`, { headers:{Authorization:`Bearer ${users.admin.token}`} }).then(response=>response.json());
  manager = (team.members?.find(member=>/anil jena/i.test(member.name)) ?? team.members?.[0])?.id ?? manager;
  browser = await chromium.launch({ headless: true });
  async function contextFor(role, touch=false) {
    const context = await browser.newContext({ viewport: { width:390,height:844 }, hasTouch:touch });
    await context.addInitScript(({token,user}) => { localStorage.setItem('psspl_crm_session', token); localStorage.setItem('psspl_crm_user', JSON.stringify(user)); }, { token:users[role].token,user:users[role] });
    await context.addInitScript(()=>{
      window.__responsiveUnhandled=[];
      window.addEventListener('unhandledrejection',event=>{
        const reason=event.reason;
        window.__responsiveUnhandled.push({type:reason?.type,name:reason?.constructor?.name,message:reason?.message,target:reason?.target?.outerHTML,stack:reason?.stack});
      });
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) return route.abort();
        // EventSource is deliberately excluded: route.fetch buffers streams forever.
        // Polling/read endpoints still provide actual attendance data in this audit.
        if (/\/stream(?:\/|$)/.test(url.pathname)) return route.abort();
        try {
          const response = await route.fetch({ url:`${apiBase}${url.pathname}${url.search}`, timeout:90000 });
          if(response.status()>=400) console.log(`API ${response.status()} ${url.pathname}`);
          return await route.fulfill({ response });
        }
        catch { return route.fulfill({status:502,json:{error:'Isolated audit API request failed'}}); }
      }
      // Permit the app's existing public font assets. Aborting an @import rejects
      // React's stylesheet-loading promise with an otherwise opaque Error Event.
      return ['localhost','127.0.0.1','fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname) || ['data:','blob:'].includes(url.protocol) ? route.continue() : route.abort();
    });
    return context;
  }
  async function settle(page) {
    // Attendance long polling is intentional; network-idle is not UI readiness.
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(250);
    await page.waitForFunction(()=> Boolean(document.querySelector('h1,h2,.feedback-print-canvas,.login-page')) && !Array.from(document.querySelectorAll('.admin-placeholder,.status-screen,.admin-gate')).some(el=>el.getBoundingClientRect().height>0 && /loading|generating|checking/i.test(el.textContent)), undefined, {timeout:30000});
  }
  for (const [role,path] of (process.env.PSSPL_RESPONSIVE_ROUTE_FILTER?[]:[['admin','/admin'],['rm','/rm/customers'],['rm','/rm/team'],['salesperson','/sales/my-day']])) {
    const context = await contextFor(role), page = await context.newPage();
    const entry={role,path,passed:false};
    try {
      await page.goto(base+path); await settle(page);
      const opener=page.getByRole('button',{name:'Open navigation',exact:true});
      await opener.click({timeout:6000});
      const drawer=page.locator('[data-mobile-navigation]');
      await drawer.getByRole('button',{name:'Close navigation',exact:true}).waitFor({timeout:3000});
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','drawer locks body');
      assert.equal(await page.locator('[data-navigation-content]').evaluate(el=>el.inert),true,'background is inert');
      assert.equal(await page.locator('.page-refresh-button').evaluate(el=>el.inert),true,'global refresh control is inert');
      if(role==='admin') {
        await page.keyboard.press('Control+k');
        assert.equal(await page.locator('.askai-overlay').count(),0,'global shortcut cannot open a second modal over navigation');
      }
      assert.equal(await drawer.evaluate(el=>el.contains(document.activeElement)),true,'focus enters drawer');
      await page.keyboard.press('Escape');
      assert.equal(await opener.evaluate(el=>el===document.activeElement),true,'focus returns to opener');
      assert.equal(await drawer.evaluate(el=>el.inert),true,'closed drawer is inert');
      if(role==='admin') {
        await page.keyboard.press('Control+k');await page.locator('.askai-modal').waitFor();
        await page.keyboard.press('Escape');await page.locator('.askai-modal').waitFor({state:'hidden'});
      }
      await opener.click();
      const links = drawer.locator('a[href]');
      await links.last().focus(); await page.keyboard.press('Tab');
      assert.equal(await drawer.evaluate(el=>el.contains(document.activeElement)),true,'Tab stays inside drawer');
      await page.setViewportSize({width:1440,height:900}); await page.waitForTimeout(200);
      assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden','desktop releases scroll lock');
      assert.equal(await drawer.evaluate(el=>el.inert),false,'desktop links are accessible');
      await page.setViewportSize({width:390,height:844});
      await opener.click(); await links.first().click(); await settle(page);
      assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden','navigation releases scroll lock');
      entry.passed=true;
    } catch(error) {entry.error=error.message;}
    results.navigation.push(entry);
    await context.close();
  }
  if (results.mode === 'interactions') {
    for (const role of ['admin','rm','salesperson']) {
      const context=await contextFor(role),page=await context.newPage();
      page.on('pageerror',error=>results.errors.push({role,path:new URL(page.url()).pathname,error:error.message}));
      const visit=async path=>{await page.setViewportSize({width:320,height:640});await page.goto(base+path);await settle(page);};
      async function check(name,action,selector,close) {
        const entry={role,name,passed:false};
        try {
          await action();const surface=page.locator(selector).first();await surface.waitFor({timeout:15000});
          for(const viewport of [{width:320,height:640},{width:844,height:390},{width:1440,height:900}]) {
            await page.setViewportSize(viewport);await page.waitForTimeout(180);
            if(selector==='[role=tooltip]') {
              const point=page.locator('[data-sales-month]').first();await point.scrollIntoViewIfNeeded();await point.focus();await surface.waitFor();
            }
            const box=await surface.boundingBox();assert.ok(box&&box.x>=-1&&box.x+box.width<=viewport.width+1,`${name} fits width ${viewport.width}`);
            assert.ok(box.y>=-1&&box.y+box.height<=viewport.height+1,`${name} fits height ${viewport.height}`);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${name} does not overflow page`);
            if(selector!== '[role=tooltip]') {
              const controls=surface.locator('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
              assert.ok(await controls.count()>0,`${name} has usable controls`);
              for(const control of [controls.first(),controls.last()]) {
                await control.scrollIntoViewIfNeeded();const rect=await control.boundingBox();
                assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=viewport.height+1,`${name} controls can be reached at ${viewport.width}x${viewport.height}`);
              }
            }
          }
          await page.setViewportSize({width:320,height:640});
          await page.screenshot({path:join(evidence,`interaction-${role}-${name.replace(/[^a-z0-9]+/gi,'_')}.png`)});
          if(close)await close();entry.passed=true;
        }catch(error){entry.error=error.message;await page.keyboard.press('Escape').catch(()=>{});}
        results.interactions.push(entry);console.log(JSON.stringify(entry));
      }
      if(role==='admin') {
        for(const path of ['/admin/customers','/admin/products']) {
          await visit(path);
          await check(path,()=>page.getByRole('button',{name:'Open',exact:true}).first().click(),'.admin-drawer-panel',()=>page.locator('.admin-drawer-panel').getByRole('button',{name:'Close',exact:true}).click());
        }
        await visit('/admin/users');
        await check('add-user',()=>page.getByRole('button',{name:'Add user',exact:true}).click(),'.admin-drawer-panel',()=>page.locator('.admin-drawer-panel').getByRole('button',{name:'Close',exact:true}).click());
        await visit('/admin');
        await check('ask-ai',()=>page.getByRole('button',{name:'Open Ask AI command palette'}).click(),'.askai-modal',()=>page.locator('.askai-modal').getByRole('button',{name:'Close',exact:true}).click());
        await visit('/admin/trends');
        await check('monthly-chart-tooltip',async()=>{await page.locator('[data-sales-month]').first().focus();},'[role=tooltip]',async()=>page.keyboard.press('Escape'));
        const touchContext=await contextFor('admin',true),touchPage=await touchContext.newPage();
        try {
          await touchPage.goto(base+'/admin/trends');await settle(touchPage);
          const point=touchPage.locator('[data-sales-month]').nth(1);await point.scrollIntoViewIfNeeded();await point.tap();
          const tooltip=touchPage.getByRole('tooltip');await tooltip.waitFor();
          assert.match(await tooltip.innerText(),/May 2026/);
          const box=await tooltip.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
          await touchPage.screenshot({path:join(evidence,'interaction-touch-chart.png')});
          results.interactions.push({role,name:'touch chart comparison',passed:true});
        }catch(error){results.interactions.push({role,name:'touch chart comparison',passed:false,error:error.message});}
        finally {await touchContext.close();}
        for(const path of ['/admin/activity','/admin/alerts','/admin/reports','/admin/management-reports']) {
          await visit(path);
          if(path==='/admin/reports') {
            const grouping=page.locator('.report-view-bar select');await grouping.waitFor();
            for(const option of ['monthly','product','salesperson','region','customer']) {
              try {await grouping.selectOption(option);await settle(page);assert.equal(await grouping.inputValue(),option);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);results.interactions.push({role,name:`${path}: ${option}`,passed:true});}
              catch(error){results.interactions.push({role,name:`${path}: ${option}`,passed:false,error:error.message});}
            }
            continue;
          }
          const sections=path==='/admin/activity'?['Activity','Alerts']:[null];
          for(const section of sections) {
            if(section){await page.locator('.section-switch').getByRole('tab',{name:section,exact:true}).click();await settle(page);}
            const labels=await page.locator('.admin-tabs button').allTextContents();assert.ok(labels.length,`${path} exposes its views`);
            for(const label of labels) {
              try {const tab=page.locator('.admin-tabs button').filter({hasText:label}).first();await tab.click();await settle(page);assert.ok((await tab.getAttribute('class'))?.includes('active'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);results.interactions.push({role,name:`${path}: ${section??''} ${label}`,passed:true});}
              catch(error){results.interactions.push({role,name:`${path}: ${section??''} ${label}`,passed:false,error:error.message});}
            }
          }
        }
      }
      if(role==='rm') {
        await visit('/rm/report-card');
        await check('pdf-preview',()=>page.getByRole('button',{name:'Download PDF',exact:true}).click(),'.rm-v2-preview',async()=>{
          await page.locator('#rm-report-render-target[data-pagination-ready=true]').waitFor();
          const pdf=page.locator('.rm-v2-preview-scroll [data-rm-report-page]').first();
          assert.equal(Math.round((await pdf.boundingBox()).width),794,'A4 export width remains fixed');
          const scroll=page.locator('.rm-v2-preview-scroll');
          assert.ok((await pdf.boundingBox()).x>=0,'left edge of PDF is reachable');
          await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
          assert.ok(await scroll.evaluate(el=>el.scrollLeft>0),'PDF can pan horizontally');
          await page.locator('.rm-v2-preview').getByRole('button',{name:'Close',exact:true}).click();
        });
        await page.getByRole('button',{name:'View Detailed Attendance',exact:true}).click();
        await check('attendance-dialog',async()=>{},'.rm-v4-attendance-dialog',async()=>page.keyboard.press('Escape'));
      }
      if(role==='salesperson') {
        await visit('/sales/my-day');
        await check('unplanned-visit',()=>page.getByRole('button',{name:'+ Add unplanned visit',exact:true}).click(),'.visit-modal',()=>page.getByRole('button',{name:'Close dialog',exact:true}).click());
        await check('new-follow-up',()=>page.getByRole('button',{name:'+ Schedule New Follow-up',exact:true}).click(),'.visit-modal',()=>page.getByRole('button',{name:'Close dialog',exact:true}).click());
        await visit('/sales/hub');
        for(const label of ['Customer DB','Pipeline','Requests','Alerts','Reports']) {
          try {
            await page.locator('.hub-tabs').getByRole('button',{name:label,exact:true}).click();await settle(page);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
            await page.screenshot({path:join(evidence,`interaction-sales-tab-${label.replaceAll(' ','_')}.png`),fullPage:true});
            results.interactions.push({role,name:`hub ${label}`,passed:true});
          }catch(error){results.interactions.push({role,name:`hub ${label}`,passed:false,error:error.message});}
        }
      }
      await context.close();
    }
  }
  if (results.mode === 'full') {
    const groups = {
      admin:['/admin','/admin/team',`/admin/team/${manager}`,'/admin/customers','/admin/products','/admin/trends','/admin/activity','/admin/alerts','/admin/ask-ai','/admin/users','/admin/team-structure','/admin/archived-employees','/admin/tally','/admin/audit','/admin/reports','/admin/management-reports','/admin/rm-feedback',`/admin/team/${manager}/print`,`/rm-report/${manager}`,'/profile'],
      rm:['/rm','/rm/team','/rm/report-card','/rm/customers','/rm/products','/rm/alerts','/rm/print-report'],
      salesperson:['/sales/my-day','/sales/hub'],
      account:['/','/login','/activate-account','/forgot-password','/reset-password'],
    };
    for (const [group,paths] of Object.entries(groups)) {
      const context=await contextFor(group==='account'?'salesperson':group);
      if(group==='account') await context.addInitScript(()=>localStorage.clear());
      const page=await context.newPage();
      page.on('pageerror',error=>results.errors.push({group,path:new URL(page.url()).pathname,error:error.message,stack:error.stack}));
      for (const path of paths) {
        if(process.env.PSSPL_RESPONSIVE_ROUTE_FILTER&&!process.env.PSSPL_RESPONSIVE_ROUTE_FILTER.split(',').includes(path))continue;
        console.log(`Audit ${group} ${path}`);
        await page.goto(base+path,{timeout:90000,waitUntil:'domcontentloaded'});
        let readinessError;
        try {await settle(page);}catch(error){readinessError=error.message;}
        const route={group,path,actualPath:new URL(page.url()).pathname,heading:await page.locator('h1,h2').allTextContents(),state:(await page.locator('body').innerText()).slice(0,2400),viewports:[]};
        route.unhandled=await page.evaluate(()=>window.__responsiveUnhandled);
        route.expectedPath=path==='/'?'/login':path==='/rm'?'/sales/my-day':path;
        route.ready=route.actualPath===route.expectedPath && (route.heading.some(text=>text.trim()) || path==='/rm/print-report'&&await page.locator('.feedback-print-canvas table').count()===7);
        route.visibleErrors=await page.locator('.admin-error,.status-screen,.admin-gate').allInnerTexts();
        route.loading=await page.locator('.admin-placeholder').allInnerTexts().then(texts=>texts.some(text=>/loading|generating|checking/i.test(text)));
        route.readinessError=readinessError;
        route.ready=route.ready&&!route.visibleErrors.length&&!route.loading&&!readinessError;
        route.accountState=['/activate-account','/reset-password'].includes(path)?'Token-missing state deliberately checked; no account tokens issued.':undefined;
        for (const width of widths) {
          await page.setViewportSize({width,height:width<768?844:1000});await page.waitForTimeout(120);
          const measured=await page.evaluate(()=>{
            const outside=[];
            for(const el of document.querySelectorAll('body *')) {
              const s=getComputedStyle(el),r=el.getBoundingClientRect();
              if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none'||el.closest('[inert],.rm-v2-pdf-measure'))continue;
              if(r.right>innerWidth+2||r.left< -2) {
                let p=el.parentElement,contained=false;
                while(p && p!==document.body) { const ps=getComputedStyle(p); if(['auto','scroll','hidden'].includes(ps.overflowX)){contained=true;break;} p=p.parentElement; }
                if(!contained) outside.push({tag:el.tagName,class:typeof el.className==='string'?el.className:'svg',left:Math.round(r.left),right:Math.round(r.right)});
              }
            }
            return {documentWidth:document.documentElement.scrollWidth,innerWidth, outside:outside.slice(0,15)};
          });
          route.viewports.push({width,...measured});
          if([320,1440].includes(width)) await page.screenshot({path:join(evidence,`${group}-${path.replace(/[^a-z0-9]+/gi,'_')}-${width}.png`),fullPage:true});
        }
        // Short landscape checks expose dialogs/toolbars that depend on viewport height.
        await page.setViewportSize({width:844,height:390});await page.waitForTimeout(100);
        route.landscape=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth}));
        results.routes.push(route);
        writeFileSync(join(evidence,process.env.PSSPL_RESPONSIVE_ROUTE_FILTER?'focused-results.json':'results.json'),JSON.stringify(results,null,2));
      }
      await context.close();
    }
  }
} finally {
  await browser?.close();api.kill();
  writeFileSync(join(evidence,results.mode==='full'?(process.env.PSSPL_RESPONSIVE_ROUTE_FILTER?'focused-results.json':'results.json'):`${results.mode}.json`),JSON.stringify(results,null,2));
  writeFileSync(join(scratch,'server.log'),serverLog);
}
console.log(JSON.stringify({navigation:results.navigation,interactions:results.interactions,routes:results.routes.length,overflow:results.routes.flatMap(r=>r.viewports.filter(v=>v.documentWidth>v.width+2||v.outside.length).map(v=>({path:r.path,...v}))),errors:results.errors},null,2));
if(results.navigation.some(r=>!r.passed)||results.interactions.some(r=>!r.passed)||results.errors.length||results.routes.some(r=>!r.ready||r.landscape.documentWidth>r.landscape.width+2||r.viewports.some(v=>v.documentWidth>v.width+2||v.outside.length))) process.exitCode=1;
