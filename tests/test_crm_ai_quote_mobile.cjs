// Phone/browser tests use fictional in-memory records and intercepted network
// requests only. No live CRM, customer images, or OpenAI API calls are made.
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
      assert.match(await page.locator('#dlg').innerText(),/separately billed OpenAI API charges/);
      assert.match(await page.locator('#ai_photo_list').innerText(),/sample1.png/);assert.equal(await writes(page),0);
      await page.getByRole('button',{name:'Generate draft'}).click();assert.match(await page.locator('#ai_status').innerText(),/Agree/);assert.equal(calls.length,0);
      await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();
      await page.waitForSelector('#ai_result h3');await noOverflow(page,`${width} result`);
      assert.equal(calls.length,1);assert.equal(calls[0].headers.authorization,'Bearer fictional.jwt');
      const body=calls[0].body;assert.deepEqual(Object.keys(body).sort(),['consent','description','photos','rates','service']);
      assert.deepEqual(body.rates,[{id:0,name:'Mulch per yard'},{id:1,name:'Cleanup'}]);assert.equal(body.consent,true);
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

test('starter rates are not used; no data leaves before consent and unmatched prices stay blank',skip,async()=>{
  const browser=await makeBrowser();const response={summary:'Clean the property.',lines:[{description:'Cleanup',quantity:'1',rate_id:null,basis:'One flat visit described.'}],questions:[],cautions:['Inspect first.']};
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

test('disabled setup and invalid AI output never save, retry or leave consent checked',skip,async()=>{
  const browser=await makeBrowser();try{for(const mode of ['disabled','invalid']){
    const handler=route=>route.fulfill(mode==='disabled'?{status:503,contentType:'application/json',body:JSON.stringify({error:'Photo estimates are not enabled yet.',openaiAttempted:false})}:{status:200,contentType:'application/json',body:JSON.stringify({draft:{...defaultDraft(),total:1}})});
    const {context,page,errors,calls}=await setup(browser,320,handler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();
      await page.waitForFunction(()=>{const s=document.querySelector('#ai_status');return s&&/not enabled|invalid/.test(s.textContent);});
      assert.equal(await page.locator('#ai_consent').isChecked(),false);assert.equal(calls.length,1);assert.equal(await writes(page),0);
      if(mode==='disabled')assert.match(await page.locator('#ai_status').innerText(),/No OpenAI request was made/);else assert.match(await page.locator('#ai_status').innerText(),/may charge/);
      assert.equal(await page.locator('#ai_result h3').count(),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
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
  const {createHandler}=require('../frontend/lib/crm-quote');let providerBody,providerCalls=0;
  const fakeFetch=async(url,init)=>{
    if(url==='https://jvmvzfshgcekwocffdtv.supabase.co/auth/v1/user')return {ok:true,status:200,json:async()=>({id:'fictional-user',role:'authenticated',aud:'authenticated',is_anonymous:false})};
    assert.equal(url,'https://api.openai.com/v1/responses');providerCalls++;providerBody=JSON.parse(init.body);
    return {ok:true,status:200,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(defaultDraft())}]}]})};
  };
  const server=createHandler({env:{AI_QUOTES_ENABLED:'true',CRM_OPENAI_API_KEY:'fictional-secret'},fetch:fakeFetch});
  const routeHandler=async(route,call)=>{
    const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
    await server({method:'POST',headers:call.headers,body:call.body},res);
    await route.fulfill({status:res.code,headers:res.headers,contentType:'application/json',body:JSON.stringify(res.data)});
  };
  const browser=await makeBrowser();try{const {context,page,errors,calls}=await setup(browser,390,routeHandler);
    try{
      await begin(page);await page.locator('#ai_use_rates').check();await page.locator('#ai_consent').check();await page.getByRole('button',{name:'Generate draft'}).click();await page.waitForSelector('#ai_result h3');
      assert.equal(calls.length,1);assert.equal(providerCalls,1);assert.equal(providerBody.input[1].content[1].type,'input_image');
      assert.match(providerBody.input[1].content[1].image_url,/^data:image\/jpeg;base64,/);assert.equal(providerBody.store,false);
      assert.doesNotMatch(JSON.stringify(providerBody),/Fictional Road|Fictional Customer|PRIVATE CLIENT NOTE|19\.99|sample1\.png/);
      assert.equal(await page.locator('#ai_result img').count(),0);assert.equal(await writes(page),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }finally{await browser.close();}
});

test('a canceled long-notes confirmation cannot restore a stale property after client changes',skip,async()=>{
  const long={summary:'S'.repeat(800),lines:Array.from({length:8},(_,i)=>({description:`Work ${i+1}`,quantity:'1',rate_id:0,basis:'B'.repeat(250)})),questions:Array(6).fill('Q'.repeat(250)),cautions:Array(6).fill('C'.repeat(250))};
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
