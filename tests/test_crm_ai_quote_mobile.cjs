// Phone/browser tests use fictional in-memory records and intercepted network
// requests only. No live CRM, customer images, or Gemini API calls are made.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright, chromium;
try { playwright = require('playwright-core'); chromium = require('@sparticuz/chromium').default; } catch (_) {}
const html = fs.readFileSync(path.join(__dirname, '../frontend/public/crm.html'), 'utf8');
const week = fs.readFileSync(path.join(__dirname, '../frontend/public/crm-week.js'), 'utf8');
const canRun = !!(playwright && chromium);
const skip = { skip: !canRun && 'Install browser dependencies externally' };

function fakeCRM() {
  const clients = [
    { id:'c1', name:'Fictional Customer', stage:'Lead', type:'Homeowner', props:'123 Fictional Road', notes:'PRIVATE CLIENT NOTE' },
    { id:'c2', name:'Other Fictional Customer', stage:'Lead', type:'Homeowner', props:'456 Fictional Road', notes:'' },
  ];
  const rows = new Map(clients.map(data => [`clients/${data.id}`, { coll:'clients', id:data.id, data }]));
  let signedIn = false;
  window.__mock = { rows, writes:[] };
  const client = {
    auth: {
      getSession: async()=>({ data:{ session:signedIn?{ access_token:'fictional.jwt' }:null } }),
      signInWithPassword: async()=>{ signedIn=true; return { data:{session:{access_token:'fictional.jwt'}},error:null }; },
      signOut: async()=>{signedIn=false;return {error:null};},
    },
    from:()=>({
      select:async()=>({data:[...rows.values()].map(row=>JSON.parse(JSON.stringify(row))),error:null}),
      upsert:async row=>{const saved=JSON.parse(JSON.stringify(row));rows.set(`${row.coll}/${row.id}`,saved);window.__mock.writes.push(saved);return {error:null};},
      delete(){let coll;return {eq(k,v){if(k==='coll'){coll=v;return this;}rows.delete(`${coll}/${v}`);window.__mock.writes.push({coll,id:v,deleted:true});return Promise.resolve({error:null});}};},
    }),
    channel:()=>({on(_e,_f,fn){window.__mock.listener=fn;return this;},subscribe(fn){setTimeout(()=>fn('SUBSCRIBED'),0);return this;}}),
  };
  window.supabase={createClient:()=>client};
}
async function makeBrowser() {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath=await chromium.executablePath(); process.env.LD_LIBRARY_PATH=`/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH||''}`;
  for(let attempt=0;;attempt++)try{return await playwright.chromium.launch({executablePath,args:chromium.args.filter(a=>a!=='--single-process'),headless:true});}
  catch(e){if(attempt>=2||!String(e).includes('SIGSEGV'))throw e;}
}
const defaultDraft = () => ({
  summary:'Spread mulch and clean up.',
  ballpark:{low:'100.00',high:'240.00',basis:'Fictional estimate; confirm access and disposal.'},
  lines:[
    {description:'Install mulch <fictional>',quantity:'2.5',rate_id:0,basis:'2.5 yards were described.'},
    {description:'Remove debris',quantity:null,rate_id:null,basis:'Amount is unknown.'},
  ],
  questions:['Confirm the bed depth.'],cautions:['Hidden conditions may affect the scope.'],
});
async function setup(browser,width,handler,dialogPolicy=()=>true) {
  const context=await browser.newContext({viewport:{width,height:760},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await context.addInitScript(fakeCRM);
  const page=await context.newPage(), errors=[], calls=[], dialogs=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());return dialogPolicy(d.message())?d.accept():d.dismiss();});
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url==='https://crm.test/crm.html')return route.fulfill({status:200,contentType:'text/html',body:html});
    if(url==='https://crm.test/crm-week.js')return route.fulfill({status:200,contentType:'application/javascript',body:week});
    if(url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/'))return route.fulfill({status:200,contentType:'application/javascript',body:'// mocked'});
    if(url==='https://crm.test/api/crm-quote'){
      const call={headers:route.request().headers(),body:route.request().postDataJSON()};calls.push(call);
      if(handler)return handler(route,call,calls);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});
    }
    errors.push(`Unexpected network request: ${url}`);return route.abort();
  });
  await page.goto('https://crm.test/crm.html');await page.locator('#em').fill('fictional@example.invalid');await page.locator('#pw').fill('not-a-real-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices');
  return {context,page,errors,calls,dialogs};
}
async function photo(page, count=1){
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=80;const x=c.getContext('2d');x.fillStyle='#2b8a3e';x.fillRect(0,0,100,80);return c.toDataURL('image/png').split(',')[1];});
  // Extra bytes represent private input metadata; canvas must not copy them.
  const buffer=Buffer.concat([Buffer.from(png,'base64'),Buffer.from('FICTIONAL-METADATA-MARKER')]);
  await page.locator('#ai_photos').setInputFiles(Array.from({length:count},(_,i)=>({name:`sample${i+1}.png`,mimeType:'image/png',buffer})));
}
async function begin(page,{rates=true}={}){
  if(rates)await page.evaluate(()=>{S.meta.rates='Mulch per yard | 19.99\nCleanup | 10.00';});
  await page.getByRole('button',{name:'Estimates',exact:true}).click();await page.getByRole('button',{name:'Photo estimate with AI'}).click();
  await page.locator('#ai_client').selectOption('c1');await page.locator('#ai_property').fill('123 Fictional Road');
  await page.locator('#ai_service').selectOption('Mulch / bed refresh');await page.locator('#ai_description').fill('Install 2.5 yards of mulch near the garden.');await photo(page);
}
async function noOverflow(page,label){const d=await page.evaluate(()=>{const dlg=document.querySelector('#dlg');return {view:innerWidth,body:document.documentElement.scrollWidth,dialog:dlg.open?dlg.scrollWidth:0,width:dlg.open?dlg.clientWidth:0};});assert.ok(d.body<=d.view&&d.dialog<=d.width,`${label}: ${JSON.stringify(d)}`);}
const writes = page => page.evaluate(()=>__mock.writes.length);

test('phone photo estimate sends only consented data; review and complete every line before saving',skip,async()=>{
  const browser=await makeBrowser();try{for(const width of [320,390]){
    const {context,page,errors,calls}=await setup(browser,width);
    try{
      await begin(page);await noOverflow(page,`${width} input`);
      const disclosure=await page.locator('#dlg').innerText();
      assert.match(disclosure,/sent through Vercel to Google Gemini/);assert.match(disclosure,/Gemini API Free-tier project/);
      assert.match(disclosure,/cannot verify its tier or prevent charges/);assert.match(disclosure,/people may review them/);
      assert.match(disclosure,/not to send sensitive, confidential or personal information/);
      assert.match(await page.locator('label:has(#ai_consent)').innerText(),/confirm.*no personal, sensitive or confidential information/i);
      assert.equal(await page.locator('#dlg a[href="https://ai.google.dev/gemini-api/terms#unpaid-services"]').count(),1);
      assert.match(await page.locator('#ai_photo_list').innerText(),/sample1.png/);assert.equal(await writes(page),0);
      await page.getByRole('button',{name:'Generate draft'}).click();assert.match(await page.locator('#ai_status').innerText(),/Agree/);assert.equal(calls.length,0);
      await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();
      await page.waitForSelector('#ai_result h3');await noOverflow(page,`${width} result`);
      assert.equal(calls.length,1);assert.equal(calls[0].headers.authorization,'Bearer fictional.jwt');
      const body=calls[0].body;assert.deepEqual(Object.keys(body).sort(),['answers','consent','description','disclosure','extra','model','photos','provider','rates','service']);
      assert.deepEqual(body.rates,[{id:0,name:'Mulch per yard'},{id:1,name:'Cleanup'}]);assert.equal(body.consent,true);assert.equal(body.provider,'gemini');assert.equal(body.disclosure,'gemini-free-v2');assert.equal(body.model,'gemini-3.8-flash');assert.deepEqual(body.answers,[]);assert.equal(body.extra,'');
      assert.doesNotMatch(JSON.stringify(body),/Fictional Customer|Fictional Road|PRIVATE CLIENT NOTE|19\.99|10\.00|sample1\.png/);
      assert.match(body.photos[0],/^data:image\/jpeg;base64,/);const jpeg=Buffer.from(body.photos[0].split(',')[1],'base64');
      assert.ok(jpeg.length<=750000);assert.equal(jpeg.includes(Buffer.from('FICTIONAL-METADATA-MARKER')),false);
      assert.equal(await writes(page),0);assert.equal(await page.evaluate(()=>Object.keys(S.estimates).length),0);
      assert.match(await page.locator('#ai_result').innerText(),/Confirm the bed depth/);
      assert.match(await page.locator('#ai_result').innerText(),/Needs review \/ measurement/);
      await page.getByRole('button',{name:'Review in estimate editor'}).click();await noOverflow(page,`${width} editor`);
      assert.equal(await page.locator('#es_client').inputValue(),'c1');assert.equal(await page.locator('#es_property').inputValue(),'123 Fictional Road');
      assert.equal(await page.locator('#es_status').inputValue(),'Draft');
      const lines=page.locator('#es_lines .estimate-line');assert.equal(await lines.nth(0).locator('[data-field=quantity]').inputValue(),'2.5');assert.equal(await lines.nth(0).locator('[data-field=rate]').inputValue(),'19.99');
      assert.equal(await lines.nth(1).locator('[data-field=quantity]').inputValue(),'');assert.equal(await lines.nth(1).locator('[data-field=rate]').inputValue(),'');
      await page.getByRole('button',{name:'Save estimate'}).click();assert.match(await page.locator('#es_error').innerText(),/check the review box/);assert.equal(await writes(page),0);
      await page.locator('#es_ai_review').check();await page.getByRole('button',{name:'Save estimate'}).click();assert.match(await page.locator('#es_error').innerText(),/quantity/);assert.equal(await writes(page),0);
      await lines.nth(1).locator('[data-field=quantity]').fill('1');await lines.nth(1).locator('[data-field=rate]').fill('3.25');
      assert.match(await page.locator('#es_total').innerText(),/\$53\.23/);await page.getByRole('button',{name:'Save estimate'}).click();
      assert.match(await page.locator('#es_error').innerText(),/draft changed after review/i);assert.equal(await writes(page),0);
      await page.locator('#es_ai_review').check();await page.getByRole('button',{name:'Save estimate'}).click();
      await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices');
      const e=await page.evaluate(()=>Object.values(S.estimates)[0]);assert.equal(e.status,'Draft');assert.equal(e.totalCents,5323);assert.match(e.teamNotes,/Confirm the bed depth/);
      assert.deepEqual(Object.keys(e).sort(),['client','clientName','date','id','lines','notes','property','service','status','teamNotes','totalCents']);
      await page.locator('#est_saved').getByRole('button',{name:'View',exact:true}).click();
      assert.match(await page.locator('#doc').innerText(),/Install mulch <fictional>/);assert.doesNotMatch(await page.locator('#doc').innerText(),/Confirm the bed depth/);
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }}finally{await browser.close();}
});

test('follow-up answers are explicitly sent with the same photos, and a ballpark becomes an editable flat draft',skip,async()=>{
  const browser=await makeBrowser();
  const initial={...defaultDraft(),lines:defaultDraft().lines.map(line=>({...line,rate_id:null}))};
  const updated={...initial,summary:'Updated fictional scope.',ballpark:{low:'140.00',high:'220.00',basis:'Access still needs confirmation.'},questions:['Is the path clear?']};
  const last={...updated,summary:'Revised fictional scope.',ballpark:{low:'160.00',high:'220.01',basis:'Confirm all details.'},questions:[]};
  const handler=(route,_call,calls)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:calls.length===1?initial:calls.length===2?updated:last})});
  try{const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page,{rates:false});await photo(page,3);await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      assert.match(await page.locator('#ai_result').innerText(),/Total AI ballpark: \$100\.00 – \$240\.00/);
      assert.match(await page.locator('#ai_result').innerText(),/unverified AI guess/);assert.equal(calls.length,1);assert.equal(await writes(page),0);await noOverflow(page,'320 initial follow-up');
      assert.match(await page.locator('#ai_followup_form').innerText(),/Google may use them to improve its products and people may review them/);
      assert.match(await page.locator('label:has(#ai_followup_consent)').innerText(),/no personal, sensitive or confidential information/);
      assert.equal(await page.evaluate(()=>{const d=document.querySelector('#dlg').getBoundingClientRect(),h=document.querySelector('#ai_result h3').getBoundingClientRect();return h.top>=d.top&&h.top<d.bottom;}),true);
      await page.locator('#ai_answer_0').fill('2 inches deep');await page.locator('#ai_extra').fill('The path is clear.');
      await page.locator('#ai_flat').click();assert.match(await page.locator('#ai_review_status').innerText(),/new or changed answers/i);assert.equal(await page.locator('#es_lines').count(),0);
      await page.locator('#ai_update').click();assert.match(await page.locator('#ai_followup_status').innerText(),/agree to send/i);assert.equal(calls.length,1);
      await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await page.waitForFunction(()=>document.querySelector('#ai_result').textContent.includes('Updated fictional scope.'));
      assert.equal(calls.length,2);assert.deepEqual(calls[1].body.photos,calls[0].body.photos);assert.equal(calls[1].body.consent,true);assert.equal(calls[1].body.provider,'gemini');assert.equal(calls[1].body.disclosure,'gemini-free-v2');assert.equal(calls[1].body.model,'gemini-3.8-flash');
      assert.deepEqual(calls[1].body.answers,[{question:'Confirm the bed depth.',answer:'2 inches deep'}]);assert.equal(calls[1].body.extra,'The path is clear.');
      assert.doesNotMatch(JSON.stringify(calls[1].body),/Fictional Customer|Fictional Road|PRIVATE CLIENT NOTE|sample1\.png/);
      assert.equal(await page.locator('#ai_answer_0').inputValue(),'2 inches deep');assert.equal(await page.locator('#ai_extra').inputValue(),'The path is clear.');
      assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);assert.match(await page.locator('#ai_result').innerText(),/\$140\.00 – \$220\.00/);await noOverflow(page,'320 updated follow-up');
      await page.locator('#ai_update').click();assert.match(await page.locator('#ai_status').innerText(),/enter or change/i);assert.equal(calls.length,2);
      await page.locator('#ai_answer_0').fill('3 inches deep');await page.locator('#ai_answer_1').fill('Yes');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();
      await page.waitForFunction(()=>document.querySelector('#ai_result').textContent.includes('Revised fictional scope.'));
      assert.equal(calls.length,3);assert.deepEqual(calls[2].body.answers,[{question:'Confirm the bed depth.',answer:'3 inches deep'},{question:'Is the path clear?',answer:'Yes'}]);
      assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);assert.equal(await writes(page),0);
      await page.locator('#ai_flat').click();await noOverflow(page,'320 flat editor');
      assert.equal(await page.locator('#es_lines .estimate-line').count(),1);assert.equal(await page.locator('[data-field=quantity]').inputValue(),'1');
      assert.equal(await page.locator('[data-field=description]').inputValue(),'Flat estimate — Revised fictional scope.');
      assert.equal(await page.locator('[data-field=rate]').inputValue(),'190.01');assert.match(await page.locator('#dlg').innerText(),/midpoint of an unverified AI guess/i);
      assert.match(await page.locator('#es_team_notes').inputValue(),/3 inches deep/);assert.match(await page.locator('#es_team_notes').inputValue(),/\$160\.00 – \$220\.01/);
      await page.getByRole('button',{name:'Save estimate'}).click();assert.match(await page.locator('#es_error').innerText(),/review box/i);assert.equal(await writes(page),0);
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('an unavailable ballpark or failed follow-up never produces a fake price or automatic retry',skip,async()=>{
  const browser=await makeBrowser(),missing={...defaultDraft(),lines:defaultDraft().lines.map(line=>({...line,rate_id:null})),ballpark:{low:null,high:null,basis:'Need measurements.'}};
  const handler=(route,_call,calls)=>calls.length===1?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:missing})}):route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'Gemini is busy or its allowance was reached.',providerAttempted:true})});
  try{const {context,page,errors,calls}=await setup(browser,390,handler);
    try{
      await begin(page,{rates:false});await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      assert.match(await page.locator('#ai_result').innerText(),/No useful total ballpark yet/);assert.equal(await page.locator('#ai_flat').count(),0);
      await page.locator('#ai_answer_0').fill('Unknown');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();
      await page.waitForFunction(()=>document.querySelector('#ai_status').textContent.includes('allowance'));
      assert.equal(calls.length,2);assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);assert.equal(await page.locator('#ai_answer_0').inputValue(),'Unknown');
      const message=await page.locator('#ai_status').innerText();assert.equal(await page.locator('#ai_followup_status').innerText(),message);
      assert.equal((message.match(/No estimate was saved\./g)||[]).length,1);assert.match(message,/may have used allowance/);
      assert.match(await page.locator('#ai_result').innerText(),/No useful total ballpark yet/);assert.equal(await page.locator('#ai_previous_flat').count(),0);
      await page.locator('#ai_previous_items').click();assert.equal(await page.locator('[data-field=rate]').first().inputValue(),'');
      assert.match(await page.locator('#es_team_notes').inputValue(),/New or changed answer not applied to this draft.*Unknown/);
      assert.match(await page.locator('#dlg').innerText(),/revise the previous scope and price manually/i);assert.equal(calls.length,2);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('after a 503 the person can deliberately select Flash-Lite, with fresh consent and no automatic fallback',skip,async()=>{
  const handler=(route,_call,calls)=>calls.length===1?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Gemini is temporarily unavailable (G_HTTP_503).',providerAttempted:true})}):route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:{...defaultDraft(),summary:'Fictional Lite result.'}})});
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();assert.equal(await page.locator('#ai_model').inputValue(),'gemini-3.8-flash');
      assert.match(await page.locator('#dlg').innerText(),/Flash-Lite.*may be less detailed or unavailable/i);await noOverflow(page,'320 model selection');
      await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForFunction(()=>document.querySelector('#ai_status').textContent.includes('G_HTTP_503'));
      assert.equal(calls.length,1);assert.equal(calls[0].body.model,'gemini-3.8-flash');assert.equal(await page.locator('#ai_consent').isChecked(),false);
      assert.match(await page.locator('#ai_photo_list').innerText(),/sample1.png/);assert.match(await page.locator('#ai_description').inputValue(),/2.5 yards/);
      await page.locator('#ai_consent').check();await page.locator('#ai_model').selectOption('gemini-3.5-flash-lite');
      assert.equal(await page.locator('#ai_consent').isChecked(),false);assert.equal(calls.length,1);await page.getByRole('button',{name:'Generate draft'}).click();
      assert.match(await page.locator('#ai_status').innerText(),/Agree/);assert.equal(calls.length,1);
      await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForFunction(()=>document.querySelector('#ai_result').textContent.includes('Fictional Lite result.'));
      assert.equal(calls.length,2);assert.equal(calls[1].body.model,'gemini-3.5-flash-lite');assert.equal(calls[1].body.disclosure,'gemini-free-v2');
      assert.match(await page.locator('#ai_result').innerText(),/Model used for this draft: Gemini 3.5 Flash-Lite/);assert.equal(await page.locator('#ai_followup_model').inputValue(),'gemini-3.5-flash-lite');
      await noOverflow(page,'320 Lite result');await page.locator('#ai_items').click();assert.match(await page.locator('#es_team_notes').inputValue(),/AI photo draft \(Gemini 3\.5 Flash-Lite\)/);
      assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('a manually selected follow-up model needs new consent and a failed update retains the previous model and answers',skip,async()=>{
  const handler=(route,_call,calls)=>calls.length===1?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Gemini is temporarily unavailable (G_HTTP_503).',providerAttempted:true})});
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_followup_consent').check();await page.locator('#ai_followup_model').selectOption('gemini-3.5-flash-lite');
      assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);await page.locator('#ai_update').click();assert.match(await page.locator('#ai_followup_status').innerText(),/Agree to send/i);assert.equal(calls.length,1);
      await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await page.waitForFunction(()=>document.querySelector('#ai_followup_status').textContent.includes('G_HTTP_503'));
      assert.equal(calls.length,2);assert.equal(calls[1].body.model,'gemini-3.5-flash-lite');assert.deepEqual(calls[1].body.photos,calls[0].body.photos);
      assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);assert.match(await page.locator('#ai_result').innerText(),/Model used for this draft: Gemini 3.8 Flash/);
      await page.locator('#ai_previous_items').click();const notes=await page.locator('#es_team_notes').inputValue();assert.match(notes,/Gemini 3\.8 Flash/);assert.match(notes,/not applied to this draft.*3 inches/);
      assert.equal(await page.locator('#es_ai_review').isChecked(),false);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('the person can request the other model without inventing an answer, and the result identifies it',skip,async()=>{
  const handler=(route,_call,calls)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:{...defaultDraft(),summary:calls.length===1?'First result.':'New model result.'}})});
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,390,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_followup_model').selectOption('gemini-3.5-flash-lite');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();
      await page.waitForFunction(()=>document.querySelector('#ai_result').textContent.includes('New model result.'));
      assert.equal(calls.length,2);assert.equal(calls[1].body.model,'gemini-3.5-flash-lite');assert.deepEqual(calls[1].body.answers,[]);
      assert.match(await page.locator('#ai_status').innerText(),/updated using your selected model/i);assert.match(await page.locator('#ai_result').innerText(),/Model used for this draft: Gemini 3.5 Flash-Lite/);
      assert.equal(await page.locator('#ai_followup_model').inputValue(),'gemini-3.5-flash-lite');assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);
      assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('starter rates are not used; no data leaves before consent and unmatched prices stay blank',skip,async()=>{
  const browser=await makeBrowser();const response={summary:'Clean the property.',ballpark:{low:'80.00',high:'120.00',basis:'Rough fictional cleanup price.'},lines:[{description:'Cleanup',quantity:'1',rate_id:null,basis:'One flat visit described.'}],questions:[],cautions:['Inspect first.']};
  try{const {context,page,errors,calls}=await setup(browser,320,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:response})}));
    try{
      await begin(page,{rates:false});assert.equal(await page.locator('#ai_use_rates').isDisabled(),true);assert.match(await page.locator('#dlg').innerText(),/Starter rates are placeholders/);
      await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      assert.deepEqual(calls[0].body.rates,[]);assert.equal(await writes(page),0);
      await page.getByRole('button',{name:'Review in estimate editor'}).click();assert.equal(await page.locator('[data-field=rate]').inputValue(),'');
      await page.locator('#es_ai_review').check();await page.getByRole('button',{name:'Save estimate'}).click();assert.match(await page.locator('#es_error').innerText(),/rate/);assert.equal(await writes(page),0);
      await page.locator('#dlg').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('changed rate card never silently transfers outdated prices, even after draft is displayed',skip,async()=>{
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,320);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.evaluate(()=>{S.meta.rates='Mulch per yard | 80.00';});await page.getByRole('button',{name:'Review in estimate editor'}).click();
      assert.equal(await page.locator('#es_lines .estimate-line').first().locator('[data-field=rate]').inputValue(),'');
      assert.match(await page.locator('#dlg').innerText(),/rate card changed; matching prices were left blank/i);
      assert.equal(calls.length,1);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('closing an in-flight request cannot contaminate a new estimate or start an automatic retry',skip,async()=>{
  const browser=await makeBrowser();let start,release;const started=new Promise(r=>start=r),wait=new Promise(r=>release=r);
  try{const {context,page,errors,calls}=await setup(browser,320,async route=>{start();await wait;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});}catch(_){} });
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await started;
      assert.equal(await page.locator('#ai_generate').isDisabled(),true);await page.getByRole('button',{name:'Cancel / close'}).click();
      await page.getByRole('button',{name:'+ New estimate'}).click();release();await page.waitForTimeout(100);
      assert.equal(await page.locator('#es_lines .estimate-line').count(),1);assert.equal(await page.locator('[data-field=description]').inputValue(),'');
      assert.equal(calls.length,1);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{release();await context.close();}
  }finally{await browser.close();}
});

test('closing an in-flight follow-up does not overwrite a new editor or retry',skip,async()=>{
  const browser=await makeBrowser();let start,release;const started=new Promise(r=>start=r),wait=new Promise(r=>release=r);
  const handler=async(route,_call,calls)=>{if(calls.length===1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});start();await wait;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});}catch(_){} };
  try{const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await started;
      assert.equal(await page.locator('#ai_update').isDisabled(),true);await page.getByRole('button',{name:'Cancel / close'}).click();await page.getByRole('button',{name:'+ New estimate'}).click();release();await page.waitForTimeout(100);
      assert.equal(await page.locator('#es_lines .estimate-line').count(),1);assert.equal(await page.locator('[data-field=description]').inputValue(),'');
      assert.equal(calls.length,2);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{release();await context.close();}
  }finally{await browser.close();}
});

test('closing an in-flight follow-up and immediately reopening keeps the new form usable',skip,async()=>{
  const browser=await makeBrowser();let start,release;const started=new Promise(r=>start=r),wait=new Promise(r=>release=r);
  const handler=async(route,_call,calls)=>{
    if(calls.length===1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});
    if(calls.length===2){start();await wait;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});}catch(_){}return;}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});
  };
  try{const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await started;
      // A close event can be queued after a new dialog opens. Exercise that
      // ordering explicitly instead of relying on timing between clicks.
      await page.evaluate(()=>{closeD();openAIQuote();});await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>!!aiQuote),true,'the old close event must not destroy the new form state');
      await page.locator('#ai_client').selectOption('c1');await page.locator('#ai_service').selectOption('Mulch / bed refresh');
      await page.locator('#ai_description').fill('Install 2.5 yards of mulch.');await photo(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();
      await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');release();
      assert.equal(calls.length,3);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{release();await context.close();}
  }finally{await browser.close();}
});

test('a slow follow-up can be stopped and the previous draft reviewed with clearly marked new answers',skip,async()=>{
  const browser=await makeBrowser();let start,release,allowPrevious=false;const started=new Promise(r=>start=r),wait=new Promise(r=>release=r);
  const policy=message=>message.includes('answers were NOT used')?allowPrevious:true;
  const handler=async(route,_call,calls)=>{
    if(calls.length===1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});
    start();await wait;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:{...defaultDraft(),summary:'Late response.'}})});}catch(_){}
  };
  try{const {context,page,errors,calls,dialogs}=await setup(browser,320,handler,policy);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_extra').fill('The path is clear.');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await started;
      assert.equal(await page.locator('#ai_stop').isVisible(),true);assert.equal(await page.locator('#ai_flat').isDisabled(),true);assert.match(await page.locator('#ai_stop_info').innerText(),/closing it discards the unsaved draft/i);await noOverflow(page,'320 waiting');
      await page.locator('#ai_stop').click();assert.match(dialogs[0],/may still process/);assert.match(await page.locator('#ai_followup_status').innerText(),/last completed draft is unchanged/i);
      assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);assert.equal(await page.locator('#ai_previous').isVisible(),true);
await page.locator('#ai_flat').click();assert.match(await page.locator('#ai_review_status').innerText(),/new or changed answers/i);
      await page.locator('#ai_previous_flat').click();assert.equal(await page.locator('#ai_update').isVisible(),true);assert.equal(await writes(page),0);
      allowPrevious=true;await page.locator('#ai_previous_flat').click();
      assert.equal(await page.locator('#es_lines .estimate-line').count(),1);assert.equal(await page.locator('[data-field=rate]').inputValue(),'170.00');
      const notes=await page.locator('#es_team_notes').inputValue();assert.match(notes,/NOT used to update this AI scope or ballpark/);assert.match(notes,/New or changed answer not applied to this draft.*3 inches/);assert.match(notes,/New or changed additional details not applied to this draft: The path is clear/);
      assert.match(await page.locator('#dlg').innerText(),/new or changed answers were not applied to this completed AI draft/i);assert.equal(await page.locator('#es_ai_review').isChecked(),false);
      release();await page.waitForTimeout(100);assert.equal(await page.locator('#es_lines .estimate-line').count(),1);assert.equal(calls.length,2);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{release();await context.close();}
  }finally{await browser.close();}
});

test('reviewing a previous itemized draft distinguishes changed and cleared details from earlier answers',skip,async()=>{
  const first={...defaultDraft(),questions:['Confirm the bed depth.','Is the path clear?']};
  const second={...first,summary:'Earlier completed scope.'};
  const handler=(route,_call,calls)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:calls.length===1?first:second})});
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_answer_1').fill('No');await page.locator('#ai_extra').fill('Earlier details.');
      await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await page.waitForFunction(()=>document.querySelector('#ai_result').textContent.includes('Earlier completed scope.'));
      await page.locator('#ai_answer_0').fill('');await page.locator('#ai_answer_1').fill('Yes');await page.locator('#ai_extra').fill('');
      await page.locator('#ai_items').click();assert.equal(await page.locator('#ai_previous').isVisible(),true);await page.locator('#ai_previous_items').click();
      assert.equal(await page.locator('#es_lines .estimate-line').count(),2);assert.equal(await page.locator('[data-field=rate]').first().inputValue(),'19.99');
      const notes=await page.locator('#es_team_notes').inputValue();
      assert.match(notes,/New or changed answer not applied to this draft — Is the path clear\?: Yes/);assert.match(notes,/Answer cleared since this draft — Confirm the bed depth/);
      assert.match(notes,/Additional details cleared since this draft/);assert.match(notes,/Answer submitted for this draft: Confirm the bed depth\.: 3 inches/);
      assert.match(notes,/Answer submitted for this draft: Is the path clear\?: No/);assert.match(notes,/Additional details submitted for this draft: Earlier details/);
      assert.equal(await page.locator('#es_ai_review').isChecked(),false);assert.equal(calls.length,2);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('changes during the previous-draft confirmation require review again',skip,async()=>{
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,320);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_items').click();
      await page.evaluate(()=>{window.__nativeConfirm=window.confirm;window.confirm=message=>{if(message.includes('answers were NOT used'))document.querySelector('#ai_answer_0').value='4 inches';return true;}});
      await page.locator('#ai_previous_items').click();assert.match(await page.locator('#ai_review_status').innerText(),/draft or answers changed/i);assert.equal(await page.locator('#es_lines').count(),0);
      await page.evaluate(()=>{window.confirm=window.__nativeConfirm});await page.locator('#ai_previous_items').click();
      assert.match(await page.locator('#es_team_notes').inputValue(),/not applied to this draft.*4 inches/);assert.equal(calls.length,1);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('a stopped update cannot overwrite a newer update or re-enable it early',skip,async()=>{
  const browser=await makeBrowser();let firstStarted,secondStarted,releaseFirst,releaseSecond;
  const first=new Promise(r=>firstStarted=r),second=new Promise(r=>secondStarted=r),waitFirst=new Promise(r=>releaseFirst=r),waitSecond=new Promise(r=>releaseSecond=r);
  const handler=async(route,_call,calls)=>{
    if(calls.length===1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});
    const old=calls.length===2;if(old){firstStarted();await waitFirst}else{secondStarted();await waitSecond}
    try{return await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:{...defaultDraft(),summary:old?'Obsolete response.':'New completed response.'}})});}catch(_){}
  };
  try{const {context,page,errors,calls}=await setup(browser,390,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await first;
      await page.locator('#ai_stop').click();assert.equal(await page.locator('#ai_followup_consent').isChecked(),false);
      await page.locator('#ai_followup_model').selectOption('gemini-3.5-flash-lite');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();await second;releaseFirst();await page.waitForTimeout(100);
      assert.equal(await page.locator('#ai_update').isDisabled(),true);assert.match(await page.locator('#ai_followup_status').innerText(),/Waiting for Gemini/);
      assert.doesNotMatch(await page.locator('#ai_result').innerText(),/Obsolete response/);releaseSecond();
      await page.waitForFunction(()=>document.querySelector('#ai_result').textContent.includes('New completed response.'));
      assert.match(await page.locator('#ai_result h3').first().innerText(),/Updated draft/);assert.match(await page.locator('#ai_status').innerText(),/updated with your answers/i);
      assert.match(await page.locator('#ai_result').innerText(),/Model used for this draft: Gemini 3.5 Flash-Lite/);assert.equal(calls[1].body.model,'gemini-3.8-flash');assert.equal(calls[2].body.model,'gemini-3.5-flash-lite');
      assert.equal(calls.length,3);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{releaseFirst();releaseSecond();await context.close();}
  }finally{await browser.close();}
});

test('stopping while the CRM session is pending prevents a later provider request',skip,async()=>{
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,320);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.evaluate(()=>{sb.auth.getSession=()=>new Promise(resolve=>{window.__releaseAISession=resolve})});
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();
      await page.waitForFunction(()=>typeof window.__releaseAISession==='function');assert.match(await page.locator('#ai_followup_status').innerText(),/Checking your CRM session/);
      await page.locator('#ai_stop').click();assert.match(await page.locator('#ai_followup_status').innerText(),/No Gemini request was sent/);
      await page.evaluate(()=>window.__releaseAISession({data:{session:{access_token:'fictional.jwt'}}}));await page.waitForTimeout(100);
      assert.equal(calls.length,1);assert.equal(await page.locator('#ai_previous').isVisible(),true);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('browser and session stalls eventually show a safe error and preserve the last draft',skip,async()=>{
  const browser=await makeBrowser();try{for(const mode of ['session','network']){
    let start,release;const started=new Promise(r=>start=r),wait=new Promise(r=>release=r);
    const handler=async(route,_call,calls)=>{
      if(calls.length===1)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});
      start();await wait;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:defaultDraft()})});}catch(_){}
    };
    const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.evaluate(kind=>{const real=window.setTimeout;window.setTimeout=(fn,ms,...args)=>real(fn,(kind==='session'&&ms===10000)||(kind==='network'&&ms===165000)?100:ms,...args);if(kind==='session')sb.auth.getSession=()=>new Promise(()=>{});},mode);
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();if(mode==='network')await started;
      const expected=mode==='session'?'APP_SESSION_TIMEOUT':'APP_TIMEOUT';await page.waitForFunction(code=>document.querySelector('#ai_followup_status').textContent.includes(code),expected);
      const message=await page.locator('#ai_followup_status').innerText();assert.match(message,mode==='session'?/No request was sent/:/may have used allowance/);
      assert.equal(await page.locator('#ai_previous').isVisible(),true);assert.equal(await page.locator('#ai_update').isDisabled(),false);
      assert.equal(calls.length,mode==='session'?1:2);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{release();await context.close();}
  }}finally{await browser.close();}
});

test('a rapid close and reopen does not erase the new estimate editor state; Escape still closes safely',skip,async()=>{
  const browser=await makeBrowser();try{const {context,page,errors}=await setup(browser,320);
    try{
      await page.getByRole('button',{name:'Estimates',exact:true}).click();await page.getByRole('button',{name:'+ New estimate'}).click();
      await page.evaluate(()=>{closeD();openEstimate()});await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>!!estimateDraft),true);await page.locator('[data-field=description]').fill('Fictional work');
      assert.equal(await page.evaluate(()=>estimateDraft.rows[0].description),'Fictional work');
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#dlg').open);
      assert.equal(await page.evaluate(()=>estimateDraft),null);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('disabled setup, quota and invalid AI output never save, retry or leave consent checked',skip,async()=>{
  const browser=await makeBrowser();try{for(const mode of ['disabled','quota','invalid']){
    const handler=route=>route.fulfill(mode==='disabled'?{status:503,contentType:'application/json',body:JSON.stringify({error:'Photo estimates are not enabled yet.',providerAttempted:false})}:
      mode==='quota'?{status:429,contentType:'application/json',body:JSON.stringify({error:'Gemini is busy or its allowance or rate limit was reached.',providerAttempted:true})}:
      {status:200,contentType:'application/json',body:JSON.stringify({draft:{...defaultDraft(),total:1}})});
    const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();
      await page.waitForFunction(()=>{const s=document.querySelector('#ai_status');return s&&/not enabled|invalid|allowance/.test(s.textContent);});
      assert.equal(await page.locator('#ai_consent').isChecked(),false);assert.equal(calls.length,1);assert.equal(await writes(page),0);
      if(mode==='disabled')assert.match(await page.locator('#ai_status').innerText(),/No Gemini request was made/);else assert.match(await page.locator('#ai_status').innerText(),/may have used allowance/);
      assert.equal(await page.locator('#ai_result h3').count(),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }}finally{await browser.close();}
});

test('waiting status and safe diagnostics distinguish timeout, server connection and browser connection',skip,async()=>{
  const browser=await makeBrowser();
  try{for(const mode of ['timeout','connection','browser','unreadable']){
    let start,release;const started=new Promise(r=>start=r),wait=new Promise(r=>release=r);
    const handler=async route=>{
      start();await wait;
      if(mode==='browser')return route.abort('failed');
      if(mode==='unreadable')return route.fulfill({status:504,contentType:'text/html',body:'Unavailable'});
      return route.fulfill({status:mode==='timeout'?504:503,contentType:'application/json',body:JSON.stringify({
        error:mode==='timeout'?'Gemini did not finish within the time limit (G_TIMEOUT).':'The connection to Gemini was interrupted (G_CONNECTION_RESET).',providerAttempted:true,
      })});
    };
    const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await started;
      assert.match(await page.locator('#ai_status').innerText(),/up to about 2 minutes/);assert.equal(await page.locator('#ai_generate').isDisabled(),true);
      release();const expected={timeout:'G_TIMEOUT',connection:'G_CONNECTION_RESET',browser:'APP_CONNECTION',unreadable:'APP_BAD_RESPONSE'}[mode];
      await page.waitForFunction(code=>document.querySelector('#ai_status').textContent.includes(code),expected);
      const message=await page.locator('#ai_status').innerText();assert.equal((message.match(/No estimate was saved\./g)||[]).length,1);
      assert.equal((message.match(/check usage before retrying/gi)||[]).length,1);assert.match(message,/may have used allowance.*charges on a paid account/);
      assert.equal(await page.locator('#ai_consent').isChecked(),false);assert.equal(calls.length,1);assert.equal(await writes(page),0);
      assert.equal(await page.locator('#ai_result h3').count(),0);await noOverflow(page,`320 ${mode} diagnostic`);assert.deepEqual(errors,[]);
    }finally{release();await context.close();}
  }}finally{await browser.close();}
});

test('too many or unsupported photos are rejected locally; changed client requires review',skip,async()=>{
  const browser=await makeBrowser();try{const {context,page,errors,calls,dialogs}=await setup(browser,390);
    try{
      await begin(page);await photo(page,4);assert.match(await page.locator('#ai_status').innerText(),/no more than 3/);assert.equal(calls.length,0);
      await photo(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.evaluate(()=>{S.clients.c1.name='Updated Fictional Customer';});await page.getByRole('button',{name:'Review in estimate editor'}).click();
      assert.match(dialogs.at(-1),/selected client changed/);assert.equal(await page.locator('#es_property').inputValue(),'');
      assert.equal(await page.locator('#es_client').inputValue(),'c1');assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('review must be repeated after edits or a changed rate card in the estimate editor',skip,async()=>{
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,320);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.getByRole('button',{name:'Review in estimate editor'}).click();const lines=page.locator('#es_lines .estimate-line');
      await lines.nth(1).locator('[data-field=quantity]').fill('1');await lines.nth(1).locator('[data-field=rate]').fill('3.25');await page.locator('#es_ai_review').check();
      await page.evaluate(()=>{S.meta.rates='Mulch per yard | 50.00';});await page.getByRole('button',{name:'Save estimate'}).click();
      assert.match(await page.locator('#es_error').innerText(),/rate card changed/i);assert.equal(await page.locator('#es_ai_review').isChecked(),false);assert.equal(await writes(page),0);
      await lines.nth(0).locator('[data-field=rate]').fill('50.00');await page.locator('#es_ai_review').check();await page.locator('#es_notes').fill('Updated after review');
      await page.getByRole('button',{name:'Save estimate'}).click();assert.match(await page.locator('#es_error').innerText(),/draft changed after review/i);assert.equal(await page.locator('#es_ai_review').isChecked(),false);
      await page.locator('#es_ai_review').check();await page.getByRole('button',{name:'Save estimate'}).click();await page.waitForFunction(()=>Object.keys(S.estimates).length===1);
      assert.equal(await page.evaluate(()=>Object.values(S.estimates)[0].totalCents),12825);assert.equal(calls.length,1);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('changing the client in an AI estimate clears the old property and requires a fresh review',skip,async()=>{
  const browser=await makeBrowser();try{const {context,page,errors}=await setup(browser,320);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.getByRole('button',{name:'Review in estimate editor'}).click();await page.locator('#es_ai_review').check();await page.locator('#es_client').selectOption('c2');
      assert.equal(await page.locator('#es_property').inputValue(),'');assert.equal(await page.locator('#es_ai_review').isChecked(),false);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('browser and server contracts work together with only fictional JPEGs and mocked providers',skip,async()=>{
  const {createHandler}=require('../frontend/lib/crm-quote');let providerBody,providerCalls=0;const providerUrls=[];
  const fakeFetch=async(url,init)=>{
    if(url==='https://jvmvzfshgcekwocffdtv.supabase.co/auth/v1/user')return {ok:true,status:200,json:async()=>({id:'fictional-user',role:'authenticated',aud:'authenticated',is_anonymous:false})};
    assert.ok(['https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent','https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'].includes(url));providerUrls.push(url);providerCalls++;providerBody=JSON.parse(init.body);
    assert.equal(init.headers['x-goog-api-key'],'fictional-secret');
    const request=JSON.parse(providerBody.contents[0].parts[0].text);
    const response=request.answers.length?{...defaultDraft(),summary:'Revised from supplied answers.',lines:[{description:'Measure bed',quantity:'3',rate_id:null,basis:'The answer says 3 inches.'}]}:defaultDraft();
    return {ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(response)}]}}]})};
  };
  const server=createHandler({env:{AI_QUOTES_ENABLED:'true',CRM_GEMINI_FREE_TIER_CONFIRMED:'true',CRM_GEMINI_API_KEY:'fictional-secret'},fetch:fakeFetch});
  const routeHandler=async(route,call)=>{
    const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
    await server({method:'POST',headers:call.headers,body:call.body},res);
    await route.fulfill({status:res.code,headers:res.headers,contentType:'application/json',body:JSON.stringify(res.data)});
  };
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,390,routeHandler);
    try{
      await begin(page);await photo(page,3);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      assert.equal(calls.length,1);assert.equal(providerCalls,1);assert.equal(providerBody.contents[0].parts.length,4);
      for(const image of providerBody.contents[0].parts.slice(1)){assert.equal(image.inlineData.mimeType,'image/jpeg');assert.match(image.inlineData.data,/^[A-Za-z0-9+/]+=*$/);}
      assert.equal(providerBody.tools,undefined);assert.equal(providerBody.cachedContent,undefined);
      assert.doesNotMatch(JSON.stringify(providerBody),/Fictional Road|Fictional Customer|PRIVATE CLIENT NOTE|19\.99|sample1\.png/);
      await page.locator('#ai_answer_0').fill('3 inches');await page.locator('#ai_followup_model').selectOption('gemini-3.5-flash-lite');await page.locator('#ai_followup_consent').check();await page.locator('#ai_update').click();
      await page.waitForFunction(()=>document.querySelector('#ai_result').textContent.includes('Revised from supplied answers.'));
      assert.equal(calls.length,2);assert.equal(providerCalls,2);assert.deepEqual(providerUrls,['https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent','https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent']);assert.deepEqual(calls[1].body.photos,calls[0].body.photos);
      assert.deepEqual(JSON.parse(providerBody.contents[0].parts[0].text).answers,[{question:'Confirm the bed depth.',answer:'3 inches'}]);
      assert.match(await page.locator('#ai_result').innerText(),/Quantity: 3/);
      assert.equal(await page.locator('#ai_result img').count(),0);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('a canceled long-notes confirmation cannot restore a stale property after client changes',skip,async()=>{
  const long={summary:'S'.repeat(800),ballpark:{low:'100.00',high:'200.00',basis:'Unknown conditions.'},lines:Array.from({length:8},(_,i)=>({description:`Work ${i+1}`,quantity:'1',rate_id:0,basis:'B'.repeat(250)})),questions:Array(6).fill('Q'.repeat(250)),cautions:Array(6).fill('C'.repeat(250))};
  let shortenChecks=0;const policy=message=>message.includes('5,000 characters')?++shortenChecks>1:true;
  const handler=route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:long})});
  const browser=await makeBrowser();try{const {context,page,errors,dialogs}=await setup(browser,320,handler,policy);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      await page.evaluate(()=>{S.clients.c1.name='Changed Fictional Customer';});await page.getByRole('button',{name:'Review in estimate editor'}).click();
      assert.equal(await page.locator('#ai_result').isVisible(),true);assert.equal(shortenChecks,1);assert.match(dialogs[0],/selected client changed/);
      await page.getByRole('button',{name:'Review in estimate editor'}).click();assert.equal(shortenChecks,2);
      assert.equal(await page.locator('#es_property').inputValue(),'');assert.match(await page.locator('#dlg').innerText(),/property was cleared/);
      assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});
