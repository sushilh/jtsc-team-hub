const {chromium}=require('/Users/sushil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8767/');
 await page.screenshot({path:'/Users/sushil/Documents/JTSC/meet-guide/qa/html-desktop.png'});
 for(let i=0;i<8;i++){
  await page.locator(`[data-step="${i}"]`).click();
  if(await page.locator('.heat-card:visible').count()!==1)throw Error('Instruction visibility');
  if(await page.locator('.heat-card:visible .eyebrow').textContent()!==`Instruction ${i+1} of 8 · ${i<2?'Before the start':i<4?'During the race':'After the finish'}`)throw Error('Wrong instruction');
 }
 await page.locator('#next').click();
 if(!await page.locator('#previous').isDisabled())throw Error('Restart failed');
 await page.locator('#heat').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/Users/sushil/Documents/JTSC/meet-guide/qa/html-heat.png'});
 for(const input of await page.locator('.check-group input').all())await input.check();
 if(await page.locator('#check-progress').getAttribute('value')!=='16')throw Error('Check count failed');
 await page.locator('#reset-heat').click();
 if(await page.locator('.check-group input:checked').count()!==9)throw Error('Heat reset failed');
 await page.locator('#undo-reset').click();
 if(await page.locator('.check-group input:checked').count()!==16)throw Error('Undo failed');
 await page.locator('#reset-all').click();
 if(await page.locator('.check-group input:checked').count())throw Error('Reset failed');
 for(const item of await page.locator('.trouble summary').all()){await item.click();if(!await item.locator('..').getAttribute('open')===null)throw Error('Disclosure failed');}
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8767/');
 await page.screenshot({path:'/Users/sushil/Documents/JTSC/meet-guide/qa/html-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Mobile overflow');
 await page.locator('.nav a[href="#heat"]').click();
 await page.locator('#next').click();
 await page.screenshot({path:'/Users/sushil/Documents/JTSC/meet-guide/qa/html-mobile-heat.png'});
 await page.locator('#next').focus();await page.keyboard.press('Enter');
 if(!(await page.locator('#step-count').textContent()).includes('3 of 8'))throw Error('Keyboard activation failed');
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 if(await page.locator('.heat-card:visible').count()!==8)throw Error('Print missing instructions');
 await page.pdf({path:'/Users/sushil/Documents/JTSC/meet-guide/qa/html-print.pdf',format:'Letter',printBackground:true});
 await page.emulateMedia({media:'screen',reducedMotion:'reduce'});
 await page.goto('file:///Users/sushil/Documents/JTSC/meet-guide/Quantum_Swimming_Team_Guide.html');
 await page.locator('#next').click();
 if(!(await page.locator('#step-count').textContent()).includes('2 of 8'))throw Error('Offline file failed');
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('PASS: eight heat steps, restart, 16 checks, selective reset, undo, disclosures, mobile overflow, keyboard, print, local-file behavior; no JS errors.');
})().catch(e=>{console.error(e);process.exit(1)});
