const {chromium}=require('playwright');
// "Hvor er jeg?" og hele Kik på engelsk. Kør med npx vite preview --port 4173.
const path=require('path');const SP=path.join(__dirname,'out');require('fs').mkdirSync(SP,{recursive:true});
(async()=>{
const b=await chromium.launch();
for (const scheme of ['light','dark']) {
const ctx=await b.newContext({viewport:{width:412,height:880},deviceScaleFactor:2,geolocation:{latitude:55.6786,longitude:12.5719},permissions:['geolocation'],colorScheme:scheme});
const p=await ctx.newPage();const calls=[];
p.on('pageerror',e=>console.log('fejl:',e.message));
await p.route('https://api.anthropic.com/**',async r=>{
  const H={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
  if(r.request().method()==='OPTIONS') return r.fulfill({status:204,headers:H});
  const body=JSON.parse(r.request().postData());calls.push(body);
  const en=/English/.test(JSON.stringify(body.system));
  const text=JSON.stringify(en
    ?{kategori:'Place',navn:'Nytorv, Copenhagen',svar:'You are standing on Nytorv with the Courthouse behind you. Strøget runs to the left towards City Hall Square.',sikker:true,bedOm:'',sted:true,hvor:'Indre By, Copenhagen'}
    :{kategori:'Sted',navn:'Nytorv, København',svar:'Du står på Nytorv med Domhuset bag dig. Strøget går til venstre mod Rådhuspladsen.',sikker:true,bedOm:'',sted:true,hvor:'Indre By, København'});
  await r.fulfill({status:200,headers:H,body:JSON.stringify({id:'m',type:'message',role:'assistant',model:body.model,content:[{type:'text',text}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1500,output_tokens:150}})});
});
await p.goto('http://localhost:4173/');
await p.evaluate(()=>localStorage.setItem('kik.claudeKey','sk-ant-test'));await p.reload();await p.waitForTimeout(300);
// Hvor er jeg? på dansk
await p.getByRole('radio',{name:'Hvor er jeg?'}).click();
console.log(scheme,'knap:',await p.locator('.shoot span').innerText());
await p.locator('input[capture]').setInputFiles(path.join(__dirname,'foto.png'));
await p.waitForSelector('h2');await p.waitForTimeout(300);
console.log(scheme,'svar:',await p.locator('h2').innerText(),'| kort-knap:',await p.locator('a.btn',{hasText:'Kort'}).count());
await p.screenshot({path:`${SP}/12-hvor-${scheme}.png`});
// Skift til engelsk med globusknappen
await p.goto('http://localhost:4173/#/');await p.waitForTimeout(300);
await p.locator('header .round[aria-label="Dansk / English"]').click();await p.waitForTimeout(300);
console.log(scheme,'forside:',await p.locator('.sub').innerText(),'|',await p.locator('.shoot span').innerText(),'|',(await p.locator('.tabbar').innerText()).replace(/\n/g,' '));
await p.screenshot({path:`${SP}/13-en-forside-${scheme}.png`});
await p.locator('input[capture]').setInputFiles(path.join(__dirname,'foto.png'));
await p.waitForSelector('h2');await p.waitForTimeout(300);
console.log(scheme,'engelsk svar:',await p.locator('h2').innerText(),'| system beder om engelsk:',/English/.test(JSON.stringify(calls.at(-1).system)));
await p.screenshot({path:`${SP}/14-en-svar-${scheme}.png`});
await p.goto('http://localhost:4173/#/mere');await p.waitForTimeout(300);
console.log(scheme,'mere:',(await p.locator('h3').allInnerTexts()).join(', '));
await p.screenshot({path:`${SP}/15-en-mere-${scheme}.png`,fullPage:true});
await p.getByRole('button',{name:'Dansk',exact:true}).click();await p.waitForTimeout(300);
console.log(scheme,'tilbage til dansk:',(await p.locator('h1').innerText()));
await ctx.close();}
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
