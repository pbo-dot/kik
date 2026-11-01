const {chromium}=require('playwright');
// Kør: npm run build && npx vite preview --port 4173 (i et andet vindue), så: node e2e/kik.e2e.cjs
// Falsk Claude-API: ingen nøgle eller penge. Skærmbilleder i e2e/out/.
const path=require('path');const SP=path.join(__dirname,'out');require('fs').mkdirSync(SP,{recursive:true});
(async()=>{
const b=await chromium.launch();
for (const scheme of ['light','dark']) {
const ctx=await b.newContext({viewport:{width:412,height:880},deviceScaleFactor:2,geolocation:{latitude:55.6814,longitude:12.5758},permissions:['geolocation'],colorScheme:scheme});
const p=await ctx.newPage();
const calls=[];
p.on('console',m=>{if(m.type()==='error')console.log('console:',m.text())});
await p.route('https://api.anthropic.com/**',async r=>{
  const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
  if(r.request().method()==='OPTIONS') return r.fulfill({status:204,headers:H});
  const body=JSON.parse(r.request().postData());calls.push(body);
  let text;
  if(body.output_config?.format) text=JSON.stringify({kategori:'Bygning',navn:'Rundetårn',svar:'Bygget af Christian 4. i 1642 som stjernetårn. Der er ingen trapper: man går op ad en 209 meter lang snoet gang, som en russisk zar efter sigende red op ad.',sikker:true,bedOm:'',sted:true});
  else if(body.tools) text= body.messages.length>1||/spørgsmål/.test(JSON.stringify(body.messages))?'Ja, det kan du. Entréen er 40 kr for voksne, og der er åbent til kl. 21 i aften.':'Tårnet er stadig Europas ældste fungerende observatorium. Øverst er der udsigt over hele indre by.\n\nÅbent i dag 10–21. Entré 40 kr.';
  else text='I dag gik jeg en tur i indre by og kiggede op på Rundetårn.';
  const content=[{type:'text',text}];
  if(body.tools) content.unshift({type:'web_search_tool_result',tool_use_id:'x',content:[{type:'web_search_result',url:'https://www.rundetaarn.dk/',title:'Rundetaarn – officiel side',encrypted_content:'',page_age:null}]});
  await r.fulfill({status:200,headers:H,body:JSON.stringify({id:'msg_1',type:'message',role:'assistant',model:body.model,content,stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1800,output_tokens:180,server_tool_use:body.tools?{web_search_requests:1}:undefined}})});
});
await p.goto('http://localhost:4173/');
await p.evaluate(()=>localStorage.setItem('kik.claudeKey','sk-ant-test'));
await p.reload();await p.waitForTimeout(500);
await p.screenshot({path:`${SP}/1-kik-${scheme}.png`});
await p.locator('input[capture]').setInputFiles(path.join(__dirname,'foto.png'));
await p.waitForSelector('h2');await p.waitForTimeout(400);
await p.screenshot({path:`${SP}/2-svar-${scheme}.png`});
await p.getByText('Fortæl mere').click();await p.waitForSelector('text=Rundetaarn');
await p.locator('.askbar input').fill('Kan man komme op med barnevogn?');
await p.locator('.askbar button[aria-label=Send]').click();await p.waitForSelector('text=Entréen er 40 kr');await p.waitForTimeout(300);
await p.screenshot({path:`${SP}/3-mere-${scheme}.png`,fullPage:true});
await p.goto('http://localhost:4173/#/');await p.waitForTimeout(300);
await p.locator('.askbar input').fill('Hvad er det for en kirke her?');await p.locator('.askbar button[aria-label=Send]').click();
await p.waitForSelector('.bubble.it:not(.loading)');
await p.goto('http://localhost:4173/#/dage');await p.waitForTimeout(300);
await p.locator('a.row').first().click();await p.waitForTimeout(300);
await p.getByText('Skriv dagen').click();await p.waitForSelector('text=I dag gik jeg');
await p.screenshot({path:`${SP}/4-dag-${scheme}.png`,fullPage:true});
await p.goto('http://localhost:4173/#/mere');await p.waitForTimeout(300);
await p.screenshot({path:`${SP}/5-mere-${scheme}.png`,fullPage:true});
console.log(scheme,'calls:',calls.map(c=>`${c.model} ${c.output_config?.format?'format':''} ${c.tools?'web':''} fb=${c.fallbacks}`).join(' | '));
await ctx.close();}
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
