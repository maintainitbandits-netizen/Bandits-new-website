// Mobile work-category tests use fictional in-memory data and intercept every
// browser request. They never connect to or change live CRM records.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright, chromium;
try { playwright = require('playwright-core'); chromium = require('@sparticuz/chromium').default; } catch (_) {}
const html = fs.readFileSync(path.join(__dirname, '../frontend/public/crm.html'), 'utf8');
const week = fs.readFileSync(path.join(__dirname, '../frontend/public/crm-week.js'), 'utf8');
const canRun = !!(playwright && chromium);

function fakeCRM() {
  const client = { id:'c1', name:'Fictional Client', stage:'Lead', type:'Homeowner', props:'100 Example Road', notes:'' };
  const job = (id, prop, service, status, category) => ({
    id, client:'c1', prop, service, status, date:'2026-11-04', repeat:'One-time', items:'', price:50, notes:'',
    ...(category ? { workCategory:category } : {}),
  });
  const jobs = [
    job('old-trim','111 Legacy Trim Example','Trim / prune','Scheduled'),
    job('old-clean','222 Legacy Cleanup Example','Make-ready cleanup','Done'),
    job('tree','333 Tree Example','Tree Trimming','Scheduled','Tree Trimming'),
    job('clean','444 Clean Example','Cleaning','Scheduled','Cleaning'),
    job('clean-paid','555 Paid Clean Example','Cleaning','Paid','Cleaning'),
    job('maintenance-paid','666 Paid Maintenance Example','Maintenance','Paid','Maintenance'),
  ];
  jobs[1].sourceAppfolio = { manager:'Fictional Manager', number:'250-1' };
  jobs[1].workDescription = 'Fictional private work description';
  const rows = new Map([[`clients/${client.id}`, { coll:'clients', id:client.id, data:client }]]);
  jobs.forEach(data => rows.set(`jobs/${data.id}`, { coll:'jobs', id:data.id, data }));
  let signedIn = false;
  window.__mock = { rows, writes:[] };
  const db = {
    auth: {
      getSession: async () => ({ data:{ session:signedIn ? { access_token:'fictional.jwt' } : null } }),
      signInWithPassword: async () => { signedIn = true; return { data:{ session:{ access_token:'fictional.jwt' } }, error:null }; },
      signOut: async () => { signedIn = false; return { error:null }; },
    },
    from: () => ({
      select: async () => ({ data:[...rows.values()].map(r => JSON.parse(JSON.stringify(r))), error:null }),
      upsert: async row => { const saved=JSON.parse(JSON.stringify(row)); rows.set(`${row.coll}/${row.id}`, saved); window.__mock.writes.push(saved); return { error:null }; },
      delete() { let coll; return { eq(k,v) { if(k==='coll'){coll=v;return this} rows.delete(`${coll}/${v}`); window.__mock.writes.push({coll,id:v,deleted:true}); return Promise.resolve({error:null}); } }; },
    }),
    channel: () => ({ on() { return this; }, subscribe(fn) { setTimeout(() => fn('SUBSCRIBED'),0); return this; } }),
  };
  window.supabase = { createClient: () => db };
}
async function makeBrowser() {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH || ''}`;
  for (let attempt=0;;attempt++) {
    try { return await playwright.chromium.launch({ executablePath, args:chromium.args.filter(a=>a!=='--single-process'), headless:true }); }
    catch (error) { if(attempt>=2 || !String(error).includes('SIGSEGV')) throw error; }
  }
}
async function setup(browser,width) {
  const context=await browser.newContext({viewport:{width,height:760},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await context.addInitScript(fakeCRM);
  const page=await context.newPage(),errors=[],dialogs=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>{dialogs.push(d.message());return d.accept()});
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url==='https://crm.test/crm.html')return route.fulfill({status:200,contentType:'text/html',body:html});
    if(url==='https://crm.test/crm-week.js')return route.fulfill({status:200,contentType:'application/javascript',body:week});
    if(url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/'))return route.fulfill({status:200,contentType:'application/javascript',body:'// mocked'});
    errors.push(`Unexpected network request: ${url}`);return route.abort();
  });
  await page.goto('https://crm.test/crm.html');
  await page.locator('#em').fill('fictional@example.invalid');await page.locator('#pw').fill('not-a-real-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices');
  return {context,page,errors,dialogs};
}
async function noOverflow(page,label) {
  const d=await page.evaluate(()=>{const dialog=document.querySelector('#dlg');return {viewport:innerWidth,body:document.documentElement.scrollWidth,dialog:dialog.open?dialog.scrollWidth:0,dialogWidth:dialog.open?dialog.clientWidth:0}});
  assert.ok(d.body<=d.viewport && d.dialog<=d.dialogWidth,`${label} overflow: ${JSON.stringify(d)}`);
}
async function saved(page,id,category) {
  await page.waitForFunction(([id,category])=>{
    const row=__mock.rows.get(`jobs/${id}`);
    return row && (row.data.workCategory||'')===category && document.querySelector('#st').textContent==='Synced across devices';
  },[id,category]);
}

test('phones can find category tabs, assign, move and clear existing jobs, and create categorized jobs', {skip:!canRun&&'Install browser dependencies externally'},async()=>{
  const browser=await makeBrowser();
  try {
    for(const width of [320,390]){
      const {context,page,errors}=await setup(browser,width);
      try {
        await page.getByRole('button',{name:'Jobs',exact:true}).click();
        await page.locator('#job_filter').selectOption('All');await noOverflow(page,`${width} all jobs`);
        assert.equal(await page.locator('#main .card[data-job]').count(),6);
        assert.match(await page.locator('#main').innerText(),/111 Legacy Trim Example/);
        assert.match(await page.locator('#main').innerText(),/666 Paid Maintenance Example/);
        await page.getByRole('button',{name:'Tree Trimming',exact:true}).click();await noOverflow(page,`${width} tree tab`);
        const activeVisible=await page.evaluate(()=>{const bar=document.querySelector('#tabs').getBoundingClientRect(),button=document.querySelector('#tabs .on').getBoundingClientRect();return button.left>=bar.left&&button.right<=bar.right});
        assert.equal(activeVisible,true,'the selected section stays visible in the scrollable tab bar');
        assert.match(await page.locator('#main').innerText(),/333 Tree Example/);
        assert.doesNotMatch(await page.locator('#main').innerText(),/111 Legacy Trim Example|222 Legacy Cleanup Example|444 Clean Example/);
        await page.getByRole('button',{name:'Cleaning',exact:true}).click();
        assert.match(await page.locator('#main').innerText(),/444 Clean Example/);
        assert.doesNotMatch(await page.locator('#main').innerText(),/222 Legacy Cleanup Example|555 Paid Clean Example/);
        await page.getByRole('button',{name:'Maintenance',exact:true}).click();
        assert.match(await page.locator('#main').innerText(),/No jobs match this category and status/);
        await page.locator('#category_job_filter').selectOption('All');
        assert.match(await page.locator('#main').innerText(),/666 Paid Maintenance Example/);
        assert.equal(await page.evaluate(()=>__mock.writes.length),0,'just opening tabs must not reclassify any old records');
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/old-clean').data.workCategory),undefined);

        await page.getByRole('button',{name:'Jobs',exact:true}).click();
        assert.equal(await page.locator('#job_filter').inputValue(),'All');
        await page.locator('#main .card[data-job="old-trim"]').getByRole('button',{name:'Edit job',exact:true}).click();await noOverflow(page,`${width} edit`);
        assert.equal(await page.locator('#j_category').inputValue(),'');
        assert.equal(await page.locator('#j_service').inputValue(),'Trim / prune');
        await page.locator('#j_category').selectOption('Tree Trimming');
        await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();await saved(page,'old-trim','Tree Trimming');
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/old-trim').data.service),'Trim / prune');
        await page.getByRole('button',{name:'Tree Trimming',exact:true}).click();
        assert.match(await page.locator('#main').innerText(),/111 Legacy Trim Example/);
        await page.locator('#main .card[data-job="old-trim"]').getByRole('button',{name:'Edit job',exact:true}).click();
        await page.locator('#j_category').selectOption('Cleaning');
        await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();await saved(page,'old-trim','Cleaning');
        assert.doesNotMatch(await page.locator('#main').innerText(),/111 Legacy Trim Example/);
        await page.getByRole('button',{name:'Cleaning',exact:true}).click();
        assert.match(await page.locator('#main').innerText(),/111 Legacy Trim Example/);
        await page.locator('#main .card[data-job="old-trim"]').getByRole('button',{name:'Edit job',exact:true}).click();
        await page.locator('#j_category').selectOption('');
        await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();await saved(page,'old-trim','');
        assert.doesNotMatch(await page.locator('#main').innerText(),/111 Legacy Trim Example/);

        await page.getByRole('button',{name:'Maintenance',exact:true}).click();
        assert.equal(await page.locator('#category_job_filter').inputValue(),'All','category filters remain independent');
        await page.getByRole('button',{name:'+ Maintenance job',exact:true}).click();await noOverflow(page,`${width} new categorized job`);
        assert.equal(await page.locator('#j_category').inputValue(),'Maintenance');
        assert.equal(await page.locator('#j_service').inputValue(),'Maintenance');
        await page.locator('#j_prop').fill('777 New Fictional Example');
        await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
        await page.waitForFunction(()=>[...__mock.rows.values()].some(r=>r.coll==='jobs'&&r.data.prop==='777 New Fictional Example'));
        const created=await page.evaluate(()=>[...__mock.rows.values()].find(r=>r.coll==='jobs'&&r.data.prop==='777 New Fictional Example').data);
        assert.equal(created.workCategory,'Maintenance');assert.equal(created.service,'Maintenance');
        assert.match(await page.locator('#main').innerText(),/777 New Fictional Example/);
        await noOverflow(page,`${width} category after save`);
        assert.deepEqual(errors,[]);
      } finally {await context.close()}
    }
  } finally {await browser.close()}
});

test('phone category bulk selection excludes other categories and preserves hidden-selection warning', {skip:!canRun&&'Install browser dependencies externally'},async()=>{
  const browser=await makeBrowser();
  try {
    for(const width of [320,390]){
      const {context,page,errors,dialogs}=await setup(browser,width);
      try {
        await page.getByRole('button',{name:'Cleaning',exact:true}).click();
        await page.getByRole('button',{name:'Select Cleaning jobs to delete',exact:true}).click();await noOverflow(page,`${width} scoped picker`);
        assert.match(await page.locator('#dlg').innerText(),/Only Cleaning jobs are selectable here/);
        assert.equal(await page.locator('#bulk_filter').inputValue(),'Open');
        assert.match(await page.locator('#bulk_list').innerText(),/444 Clean Example/);
        assert.doesNotMatch(await page.locator('#bulk_list').innerText(),/555 Paid Clean Example|333 Tree Example|111 Legacy Trim Example|666 Paid Maintenance Example/);
        await page.getByRole('button',{name:'Select shown',exact:true}).click();
        assert.match(await page.locator('#bulk_count').innerText(),/1 selected/);
        await page.locator('#bulk_filter').selectOption('All');await page.getByRole('button',{name:'Select shown',exact:true}).click();
        assert.match(await page.locator('#bulk_count').innerText(),/2 selected/);
        await page.locator('#bulk_filter').selectOption('Scheduled');
        assert.match(await page.locator('#bulk_count').innerText(),/1 hidden by filters/);
        await page.locator('#bulk_review_title').click();await noOverflow(page,`${width} selected review`);
        assert.match(await page.locator('#bulk_review_list').innerText(),/555 Paid Clean Example/);
        await page.getByRole('button',{name:'Delete selected Cleaning jobs',exact:true}).click();
        await page.waitForFunction(()=>!__mock.rows.has('jobs/clean')&&!__mock.rows.has('jobs/clean-paid'));
        assert.match(dialogs.at(-1),/Delete 2 selected jobs/);assert.match(dialogs.at(-1),/hidden by the current filters/);
        const remaining=await page.evaluate(()=>[...__mock.rows.keys()]);
        assert.ok(remaining.includes('jobs/tree')&&remaining.includes('jobs/old-trim')&&remaining.includes('jobs/old-clean')&&remaining.includes('jobs/maintenance-paid'));
        assert.deepEqual(errors,[]);
      } finally {await context.close()}
    }
  } finally {await browser.close()}
});

test('job category editing safely handles unusual IDs and unrecognized category text', {skip:!canRun&&'Install browser dependencies externally'},async()=>{
  const browser=await makeBrowser();
  try {
    const {context,page,errors}=await setup(browser,320);
    try {
      const id=`odd'\"><img src=x onerror=window.__bad=1>`;
      await page.evaluate(id=>{
        const data={id,client:'c1',service:'Other',workCategory:'<future category>',prop:'888 Unusual Example',date:'2026-11-04',status:'Scheduled',repeat:'One-time',items:'',price:50,notes:''};
        S.jobs[id]=data;__mock.rows.set(`jobs/${id}`,{coll:'jobs',id,data:JSON.parse(JSON.stringify(data))});
      },id);
      await page.getByRole('button',{name:'Jobs',exact:true}).click();await page.locator('#job_filter').selectOption('All');
      const job=page.locator('#main .card',{hasText:'888 Unusual Example'});
      assert.match(await job.innerText(),/Unrecognized category/);
      assert.equal(await page.locator('#main img').count(),0);
      await job.getByRole('button',{name:'Edit job',exact:true}).click();
      assert.equal(await page.locator('#j_category').inputValue(),'<future category>');
      assert.match(await page.locator('#j_category').innerText(),/Unrecognized category: <future category>/);
      await page.locator('#j_category').selectOption('Maintenance');
      await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();await saved(page,id,'Maintenance');
      assert.equal(await page.evaluate(()=>window.__bad),undefined);assert.deepEqual(errors,[]);
    } finally {await context.close()}
  } finally {await browser.close()}
});

test('phone bulk category assignment searches, reviews hidden jobs, confirms, moves and clears without changing other fields', {skip:!canRun&&'Install browser dependencies externally'},async()=>{
  const browser=await makeBrowser();
  try{
    for(const width of [320,390]){
      const {context,page,errors,dialogs}=await setup(browser,width);
      let accept=false;
      page.removeAllListeners('dialog');page.on('dialog',dialog=>{dialogs.push(dialog.message());return accept?dialog.accept():dialog.dismiss()});
      try{
        const before=await page.evaluate(()=>Object.fromEntries([...__mock.rows.entries()].filter(([key])=>key.startsWith('jobs/')).map(([key,row])=>[key,JSON.parse(JSON.stringify(row.data))])));
        await page.getByRole('button',{name:'Jobs',exact:true}).click();
        await page.getByRole('button',{name:'Assign categories to jobs',exact:true}).click();await noOverflow(page,`${width} category assignment`);
        assert.equal(await page.locator('#bca_status_filter').inputValue(),'Open');
        assert.equal(await page.locator('#bca_category_filter').inputValue(),'__uncategorized__');
        assert.equal(await page.locator('#bca_target').inputValue(),'');
        assert.equal(await page.locator('#bca_apply').isEnabled(),false);
        assert.match(await page.locator('#bca_list').innerText(),/111 Legacy Trim Example/);
        assert.match(await page.locator('#bca_list').innerText(),/222 Legacy Cleanup Example/);
        assert.doesNotMatch(await page.locator('#bca_list').innerText(),/333 Tree Example|444 Clean Example|555 Paid/);

        await page.locator('#bca_search').fill('Legacy Trim');
        await page.getByRole('button',{name:'Select shown',exact:true}).click();
        await page.locator('#bca_search').fill('private work description');
        assert.match(await page.locator('#bca_list').innerText(),/Team-only work description: Fictional private work description/);
        assert.match(await page.locator('#bca_list').innerText(),/222 Legacy Cleanup Example/);
        await page.locator('#bca_search').fill('250-1');
        assert.match(await page.locator('#bca_list').innerText(),/222 Legacy Cleanup Example/);
        await page.locator('#bca_list label').getByRole('checkbox').check();
        assert.match(await page.locator('#bca_count').innerText(),/2 selected.*1 hidden by filters/);
        await page.locator('#bca_review_title').click();await noOverflow(page,`${width} hidden selections`);
        assert.match(await page.locator('#bca_review_list').innerText(),/111 Legacy Trim Example/);
        assert.match(await page.locator('#bca_review_list').innerText(),/222 Legacy Cleanup Example/);
        await page.locator('#bca_review_list li',{hasText:'111 Legacy Trim Example'}).getByRole('button',{name:/Remove/}).click();
        assert.match(await page.locator('#bca_count').innerText(),/1 selected/);
        await page.locator('#bca_search').fill('Legacy Trim');await page.getByRole('button',{name:'Select shown',exact:true}).click();
        assert.match(await page.locator('#bca_count').innerText(),/2 selected.*1 hidden/);
        await page.locator('#bca_target').selectOption('Cleaning');assert.equal(await page.locator('#bca_apply').isEnabled(),true);
        await page.locator('#bca_apply').click();
        assert.match(dialogs.at(-1),/Change the work category for 2 jobs to Cleaning/);
        assert.match(dialogs.at(-1),/1 selected job hidden/);
        assert.equal(await page.evaluate(()=>__mock.writes.length),0,'canceling confirmation must not write');
        accept=true;await page.locator('#bca_apply').click();
        await saved(page,'old-trim','Cleaning');await saved(page,'old-clean','Cleaning');
        assert.match(await page.locator('#bca_result').innerText(),/Updated 2 jobs/);
        assert.equal(await page.locator('#bca_apply').isEnabled(),false);
        for(const id of ['old-trim','old-clean']){
          const after=await page.evaluate(id=>__mock.rows.get(`jobs/${id}`).data,id);
          assert.deepEqual(after,{...before[`jobs/${id}`],workCategory:'Cleaning'});
        }
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/tree').data.workCategory),'Tree Trimming');
        await page.locator('#dlg').getByRole('button',{name:'Close',exact:true}).click();

        await page.getByRole('button',{name:'Tree Trimming',exact:true}).click();
        await page.getByRole('button',{name:'Assign jobs to Tree Trimming',exact:true}).click();await noOverflow(page,`${width} category shortcut`);
        assert.equal(await page.locator('#bca_target').inputValue(),'Tree Trimming');
        await page.locator('#bca_category_filter').selectOption('Cleaning');
        await page.locator('#bca_search').fill('Legacy Trim');
        await page.getByRole('button',{name:'Select shown',exact:true}).click();
        await page.locator('#bca_apply').click();await saved(page,'old-trim','Tree Trimming');
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/old-trim').data.service),'Trim / prune');
        await page.locator('#dlg').getByRole('button',{name:'Close',exact:true}).click();
        assert.match(await page.locator('#main').innerText(),/111 Legacy Trim Example/);

        await page.getByRole('button',{name:'Assign jobs to Tree Trimming',exact:true}).click();
        await page.locator('#bca_category_filter').selectOption('Tree Trimming');
        await page.locator('#bca_search').fill('Legacy Trim');
        await page.getByRole('button',{name:'Select shown',exact:true}).click();
        await page.locator('#bca_target').selectOption('__uncategorized__');
        await page.locator('#bca_apply').click();await saved(page,'old-trim','');
        assert.equal(await page.evaluate(()=>Object.hasOwn(__mock.rows.get('jobs/old-trim').data,'workCategory')),false);
        await page.locator('#dlg').getByRole('button',{name:'Close',exact:true}).click();
        assert.doesNotMatch(await page.locator('#main').innerText(),/111 Legacy Trim Example/);
        assert.deepEqual(errors,[]);
      }finally{await context.close()}
    }
  }finally{await browser.close()}
});

test('phone category picker includes paid jobs only with All or Paid and skips already-assigned selections', {skip:!canRun&&'Install browser dependencies externally'},async()=>{
  const browser=await makeBrowser();
  try{
    const {context,page,errors,dialogs}=await setup(browser,320);
    try{
      await page.getByRole('button',{name:'Cleaning',exact:true}).click();
      await page.getByRole('button',{name:'Assign jobs to Cleaning',exact:true}).click();
      await page.locator('#bca_category_filter').selectOption('Cleaning');
      assert.match(await page.locator('#bca_list').innerText(),/444 Clean Example/);
      assert.doesNotMatch(await page.locator('#bca_list').innerText(),/555 Paid Clean/);
      await page.locator('#bca_status_filter').selectOption('All');
      assert.match(await page.locator('#bca_list').innerText(),/555 Paid Clean/);
      await page.getByRole('button',{name:'Select shown',exact:true}).click();
      assert.match(await page.locator('#bca_count').innerText(),/2 selected.*0 will change.*2 already/);
      await page.locator('#bca_apply').click();
      assert.match(await page.locator('#bca_result').innerText(),/already in that category.*No changes/i);
      assert.equal(dialogs.length,0);assert.equal(await page.evaluate(()=>__mock.writes.length),0);
      await page.locator('#bca_status_filter').selectOption('Paid');
      await page.locator('#bca_target').selectOption('Maintenance');
      assert.match(await page.locator('#bca_count').innerText(),/2 selected.*1 hidden/);
      await page.getByRole('button',{name:'Clear selection',exact:true}).click();
      await page.getByRole('button',{name:'Select shown',exact:true}).click();
      await page.locator('#bca_apply').click();await saved(page,'clean-paid','Maintenance');
      assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/clean').data.workCategory),'Cleaning');
      assert.deepEqual(errors,[]);
    }finally{await context.close()}
  }finally{await browser.close()}
});
