/* Shared by private source CI and the public release gate. Runs against built files. */
const {chromium}=require('playwright');const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(process.env.SITE_ROOT||'dist/runtime-root/mvp'),out=path.resolve(process.env.RESULTS_DIR||'mvp/test-results');fs.mkdirSync(out,{recursive:true});
let server,browser,page,base=process.env.BASE_URL,failures=0;const records=[];
const colors=['#eff3dc','#c8deb3','#90bb93','#4e876b','#164f47'];
async function check(name,fn){try{await fn();records.push({name,status:'passed'});console.log('PASS '+name);}catch(e){failures++;records.push({name,status:'failed',error:e.stack});console.error('FAIL '+name+'\n'+e.stack);await page?.screenshot({path:path.join(out,'failure-'+failures+'.png'),fullPage:true}).catch(()=>{});}}
async function ready(query=''){await page.goto(base+query);await page.waitForSelector('#application:not([hidden])');if(!query.includes('study=cohort'))await page.waitForSelector('path[data-municipality]');}
async function axe(name){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();fs.writeFileSync(path.join(out,'axe-'+name+'.json'),JSON.stringify(result,null,2));assert.deepEqual(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),[],name);}
const norm=s=>s.replace(/[\u00a0\u202f]/g,' ');
const value=(n,v,lang='sv')=>n===null?'—':norm(new Intl.NumberFormat(lang,{minimumFractionDigits:v.unit==='percent'?1:2,maximumFractionDigits:v.unit==='percent'?1:2}).format(n*(v.unit==='percent'?100:1)))+(v.unit==='percent'?' %':'');
async function main(){try{
 if(!base){server=http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);const p=path.resolve(root,'.'+pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.geojson':'application/geo+json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.EXPECTED_RELEASE){for(let attempt=0;attempt<45;attempt++){const response=await context.request.get(base+'release.json?check='+Date.now());if(response.ok()&&(await response.json()).release===process.env.EXPECTED_RELEASE)break;if(attempt===44)throw Error('Expected release did not propagate');await new Promise(r=>setTimeout(r,2000));}}
 await check('01 Publicering – exakt version, filhashar och inga utvecklingsfiler',async()=>{
  const response=await context.request.get(base+'release.json');assert.equal(response.status(),200);const manifest=await response.json();if(process.env.EXPECTED_RELEASE)assert.equal(manifest.release,process.env.EXPECTED_RELEASE);
  assert.equal(Object.keys(manifest.files).length,15);
  for(const [name,hash] of Object.entries(manifest.files)){
   // .nojekyll is an empty deployment marker, not a browser asset. Pages can
   // return 404 for it; stage-runtime verifies its bytes before publication.
   if(name==='.nojekyll'&&process.env.BASE_URL){assert.equal(hash,crypto.createHash('sha256').update('').digest('hex'));continue;}
   const r=await context.request.get(base+name);assert.equal(r.status(),200,name);assert.equal(crypto.createHash('sha256').update(await r.body()).digest('hex'),hash,name);}
  for(const name of ['app.mjs','model.mjs','app.js.map','tests/fixtures/survey-source.json','scripts/import_survey.py','package.json','slides.md','.git/config','data/sample.json','accessibility.html'])assert.ok([404,410].includes((await context.request.get(base+name)).status()),name);
 });
 const data=await (await context.request.get(base+'data/survey.json')).json();
 await check('02 Ingrid – karta och samtliga 162 mått visar rätt kommunvärden',async()=>{
  await ready();assert.equal(await page.locator('#category option').count(),5);assert.equal(await page.locator('path[data-municipality]').count(),53);assert.equal(await page.locator('#primary-value').textContent(),'3,18');
  for(const v of data.variables){
   for(const [key,val] of [['category',v.category],['topic',v.topic],['measure',v.measure],['sex',v.sex]])if(await page.locator('#'+key).inputValue()!==val)await page.locator('#'+key).selectOption(val);
   assert.equal(new URL(page.url()).searchParams.get('variable'),v.id);
   const actual=await page.locator('#table-body tr').evaluateAll(rows=>Object.fromEntries(rows.map(r=>[r.dataset.municipality,[r.cells[2].textContent,r.cells[5].textContent,r.cells[4].textContent]])));
   const fills=await page.locator('path[data-municipality]').evaluateAll(paths=>Object.fromEntries(paths.map(p=>[p.dataset.municipality,p.getAttribute('fill')])));
   const i=data.variables.findIndex(x=>x.id===v.id);
   for(const m of data.municipalities){const n=m.values[i];assert.equal(norm(actual[m.id][0]),value(n,v),v.id+' '+m.id);const stable=n===null?null:Math.round(n*1e10)/1e10;const b=n===null?-1:v.unit==='percent'?Math.min(4,Math.floor(stable*5)):stable<1.75?0:stable<2.5?1:stable<=3.5?2:stable<=4.25?3:4;assert.equal(fills[m.id],colors[b]||(m.statuses[i]==='review'?'#fff2d7':'#e1e4e2'),v.id+' color '+m.id);assert.equal(norm(actual[m.id][2]),n===null?'—':norm(new Intl.NumberFormat('sv',{minimumFractionDigits:v.unit==='percent'?1:2,maximumFractionDigits:v.unit==='percent'?1:2,signDisplay:'exceptZero'}).format((n-data.benchmarks.ALL.values[i])*(v.unit==='percent'?100:1)))+(v.unit==='percent'?' procentenheter':''),'overall '+v.id+' '+m.id);if(m.groups[i])for(const id of data.groups[m.groups[i]].members)assert.ok(actual[m.id][1].includes(data.municipalities.find(x=>x.id===id).name));}
  }
  assert.equal(await page.locator('[download],a[href$=".csv"]').count(),0);
 });
 await check('03 Ingrid – grupper, granskningsfall och saknade deltagare',async()=>{
  await ready('?variable=interest-d&municipality=SE-2326');assert.match(await page.locator('#group-note').textContent(),/Berg, Härjedalen/);await page.locator('#compare').selectOption('SE-2361');assert.match(await page.locator('#comparison-bars').textContent(),/Samma kommungrupp/);
  await ready('?variable=interest-e&municipality=NO-5036');assert.equal(await page.locator('#primary-value').textContent(),'—');assert.equal(await page.locator('#value-note').getAttribute('data-status'),'review');assert.equal(await page.locator('#group-note').isVisible(),false);
  await ready('?municipality=NO-5052');assert.equal(await page.locator('#value-note').getAttribute('data-status'),'no-respondents');assert.equal(await page.locator('#primary-value').textContent(),'—');
 });
 await check('04 Barbro – tangentbord, kommunsökning, fokus, sortering och landfilter',async()=>{
  await ready();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('class'),'skip');await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'results');
  await page.locator('#municipality-search').focus();await page.keyboard.type('Berg');await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#municipality-search').getAttribute('aria-activedescendant'),'option-0');await page.keyboard.press('Enter');assert.equal(await page.locator('#selected-name').textContent(),'Berg');assert.equal(await page.locator(':focus').getAttribute('id'),'results');
  await page.locator('path[data-municipality="SE-2380"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#selected-name').textContent(),'Östersund');
  await page.locator('#country').selectOption('SE');assert.equal(await page.locator('#table-body tr').count(),15);assert.equal(await page.locator('path[data-municipality]').count(),15);await page.locator('#table-search').fill('Berg');assert.equal(await page.locator('#table-body tr').count(),1);await page.locator('#table-search').fill('');await page.locator('[data-sort="value"]').click();assert.equal(await page.locator('#th-value').getAttribute('aria-sort'),'ascending');
  await page.locator('#reset').click();assert.equal(await page.locator('#table-body tr').count(),53);await page.locator('#municipality-search').fill('xyz123');assert.match(await page.locator('#search-options').textContent(),/Inga kommuner/);await page.keyboard.press('Escape');assert.equal(await page.locator('#search-options').isVisible(),false);
 });
 await check('05 Dataleverans – procent, kön, norska, delningslänk och tom kohort',async()=>{
  await ready('?variable=housing-h&municipality=SE-2326');assert.equal(await page.locator('#sex').inputValue(),'men');assert.match(await page.locator('#primary-value').textContent(),/%/);assert.match(await page.locator('#table-body tr').first().textContent(),/procentenheter/);
  await page.locator('[data-lang="nb"]').click();assert.equal(await page.locator('html').getAttribute('lang'),'nb');assert.equal(await page.locator('#sex option:checked').textContent(),'Gutter');const url=page.url();await page.reload();await page.waitForSelector('#application:not([hidden])');assert.equal(page.url(),url);assert.match(await page.locator('#legend-title').textContent(),/prosent/);
  await page.locator('[data-study="cohort"]').click();assert.equal(await page.locator('#survey-panel').isVisible(),false);assert.match(await page.locator('#cohort-panel').textContent(),/ennå ikke tilgjengelige/);await page.reload();await page.waitForSelector('#cohort-panel:not([hidden])');assert.equal(await page.locator('#survey-panel').isVisible(),false);
 });
 await check('06 Ingrid – hela kartan på laptop, mobil 320/390 px och EU-emblemets storlek',async()=>{
  for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:390,height:844},{width:320,height:740}]){await page.setViewportSize(viewport);await ready();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page overflow '+viewport.width);const map=await page.locator('#map').boundingBox();if(viewport.width>=1280){assert.ok(map.y+map.height<=viewport.height,JSON.stringify(map));const legend=await page.locator('.legend').boundingBox();assert.ok(legend.y+legend.height<=viewport.height,JSON.stringify(legend));}
   const eu=await page.locator('.eu-partner').boundingBox();for(const name of ['.miun','.nord']){const uni=await page.locator(name).boundingBox();assert.ok(uni.width<=eu.width*120/780,'EU width '+viewport.width);assert.ok(uni.height<=eu.height*80/232,'EU height');}
   await page.screenshot({path:path.join(out,`view-${viewport.width}.png`),fullPage:true});}
  await page.setViewportSize({width:1366,height:768});
 });
 await check('07 Barbro – WCAG A/AA i svenska, norska, grupp-, procent- och kohortvyer',async()=>{
  for(const [name,query] of [['sv',''],['group','?variable=interest-d&municipality=SE-2326'],['review','?variable=interest-e&municipality=NO-5036'],['nb-percent','?variable=housing-h&lang=nb'],['cohort','?study=cohort']]){await ready(query);await axe(name);}
  await page.setViewportSize({width:320,height:740});await ready();await axe('mobile');await page.setViewportSize({width:1366,height:768});
 });
 await check('08 Dokumentation – forskarnas metod fungerar utan JavaScript',async()=>{
  for(const name of ['method.html']){await page.goto(base+name);assert.equal(await page.locator('h1').count(),1);await axe(name);}
  const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.goto(base+'method.html');assert.match(await p.locator('main').textContent(),/1572|1 572/);assert.match(await p.locator('main').textContent(),/Referenser/);await c.close();
 });
 await check('09 Robusthet – kartfel bevarar tabell; trasiga data ger tydligt fel',async()=>{
  await page.route('**/data/geography.geojson',r=>r.abort());await page.goto(base);await page.waitForSelector('#map-error:not([hidden])');assert.equal(await page.locator('#table-body tr').count(),53);await page.locator('#table-body button').first().click();assert.equal(await page.locator('#selected-name').textContent(),'Berg');await page.unroute('**/data/geography.geojson');
  await page.route('**/data/survey.json',r=>r.fulfill({contentType:'application/json',body:'{"schemaVersion":0}'}));await page.goto(base);await page.waitForSelector('#fatal:not([hidden])');assert.equal(await page.locator('#application').isVisible(),false);await page.unroute('**/data/survey.json');await page.locator('#retry').click();await page.waitForSelector('#application:not([hidden])');
 });
 await check('10 Rami – ursprunglig navigation, yrkesprofil och endast efterfrågade UI-tillägg',async()=>{
  await ready();assert.equal(await page.locator('.brand svg').count(),1);assert.deepEqual(await page.locator('.site-header nav').innerText(), 'Utforska\nOm datan');
  assert.equal(await page.locator('.preview,.interpretation,.research-note,#review-summary,[href="./accessibility.html"]').count(),0);
  assert.equal(await page.locator('#th-overall').textContent(),'Mot totalen (båda länderna)');
  assert.equal(await page.locator('#selected-country').textContent(),'Sverige');assert.equal(await page.locator('#comparison-bars .primary .bar-label').textContent(),'Östersund');
  await page.locator('#compare').selectOption('SE-2281');await page.locator('#tab-table').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator(':focus').getAttribute('id'),'tab-profile');assert.equal(await page.locator('#panel-profile').isVisible(),true);assert.equal(await page.locator('.profile-item').count(),18);
  const m=data.municipalities.find(m=>m.id==='SE-2380'),other=data.municipalities.find(m=>m.id==='SE-2281');
  for(const v of data.variables.filter(v=>v.category==='interest'&&Number(v.topic.split('-')[1])<18)){const i=data.variables.indexOf(v);assert.equal(norm(await page.locator('.profile-item[data-variable="'+v.id+'"] strong').textContent()),value(m.values[i],v)+' / '+value(other.values[i],v));}
  await page.locator('.profile-item[data-variable="interest-f"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('data-variable'),'interest-f');assert.equal(new URL(page.url()).searchParams.get('variable'),'interest-f');assert.match(await page.locator('#selected-profession').textContent(),/Ingenjör/);
  await axe('restored-profile');await page.screenshot({path:path.join(out,'restored-profile.png'),fullPage:true});
  await page.locator('#tab-profile').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#panel-table').isVisible(),true);
  await page.locator('.site-header [data-method]').click();assert.equal(await page.locator('#method-dialog').isVisible(),true);assert.doesNotMatch(await page.locator('#method-dialog').textContent(),/granskningsversion|Arbetsversion|50 kommunvärden|Öppna frågor/i);await axe('restored-method-dialog');await page.keyboard.press('Escape');assert.equal(await page.locator('#method-dialog').isVisible(),false);assert.equal(await page.locator(':focus').getAttribute('data-method'),'');
  await page.goto(base+'method.html');assert.doesNotMatch(await page.locator('main').textContent(),/Arbetsversion för forskargranskning|Öppna frågor i källmaterialet|50 kommunvärden|Tolka kartan/);
 });
 await check('11 Robusthet – inga JavaScript-undantag i användarflödena',async()=>assert.deepEqual(errors,[]));
 }finally{fs.writeFileSync(path.join(out,'e2e-results.json'),JSON.stringify({base,checks:records,failures},null,2));await browser?.close();server?.close();}if(failures)process.exitCode=1;}
main().catch(e=>{console.error(e);process.exitCode=1;server?.close();});
