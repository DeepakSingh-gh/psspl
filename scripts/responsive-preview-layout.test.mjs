import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';

// Geometry regression for the legacy preview's fixed A4 canvas and inline flex
// layout. This tests the stylesheet; it does not claim to render report data.
test('legacy A4 canvas can pan from its left edge on phones and tablets', async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}${readFileSync(new URL('../src/app/responsive.css',import.meta.url),'utf8')}</style>
      <div class="legacy-report-preview" style="position:fixed;inset:0;display:flex;flex-direction:column">
        <div class="legacy-preview-scroll" style="flex:1;overflow-y:auto;padding:28px 16px 48px;display:flex;flex-direction:column;align-items:center">
          <div class="legacy-preview-track" style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:840px">
            <div style="width:794px;height:1122px;flex:none"></div>
          </div>
        </div>
      </div>`);
    for(const width of [320,375,390,480,639,640,680,681,768,844,1000,1024,1440,1920]) {
      await page.setViewportSize({width,height:800});
      const viewport=page.locator('.legacy-preview-scroll'),canvas=page.locator('.legacy-preview-track > div');
      await viewport.evaluate(el=>el.scrollLeft=0);
      const box=await canvas.boundingBox();
      assert.equal(Math.round(box.width),794,'export canvas remains full-size');
      assert.ok(box.x>=0,`canvas left edge reachable at ${width}px: ${box.x}`);
      await viewport.evaluate(el=>el.scrollLeft=el.scrollWidth);
      const right=await canvas.boundingBox();
      assert.ok(right.x+right.width<=width,`canvas right edge reachable at ${width}px`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
  } finally {await browser.close();}
});
