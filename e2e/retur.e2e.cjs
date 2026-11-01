const {chromium}=require('playwright');
// Find retur: start spor, gå en tur (falsk GPS), åbn kortet. Kør med npx vite preview --port 4173.
const path=require('path');const fs=require('fs');const SP=path.join(__dirname,'out');fs.mkdirSync(SP,{recursive:true});
const tile=fs.readFileSync(path.join(__dirname,'tile.png'));
// Tisvilde: fra P-pladsen ned til stranden og mod sydvest langs vandet
const walk=[[56.0560,12.0860],[56.0563,12.0848],[56.0566,12.0834],[56.0570,12.0820],[56.0568,12.0802],[56.0562,12.0786],[56.0553,12.0770],[56.0543,12.0756],[56.0532,12.0744],[56.0520,12.0733]];
(async()=>{
const b=await chromium.launch();
for (const scheme of ['light','dark']) {
const ctx=await b.newContext({viewport:{width:412,height:880},deviceScaleFactor:2,geolocation:{latitude:walk[0][0],longitude:walk[0][1],accuracy:8},permissions:['geolocation'],colorScheme:scheme,serviceWorkers:'block'});
const p=await ctx.newPage();
p.on('pageerror',e=>console.log('fejl:',e.message));
await p.route('https://tile.openstreetmap.org/**',r=>r.fulfill({status:200,contentType:'image/png',body:tile}));
await p.goto('http://localhost:4173/');await p.waitForTimeout(400);
// Uden spor: Kort viser, hvor du er
await p.locator('a.btn',{hasText:'Kort'}).click();await p.waitForSelector('.me-dot');
await p.getByText('Start spor').click();await p.waitForSelector('.stats');
for (const [lat,lon] of walk.slice(1)) { await ctx.setGeolocation({latitude:lat,longitude:lon,accuracy:8}); await p.waitForTimeout(250); }
await p.waitForTimeout(500);
console.log(scheme,'gået:',(await p.locator('.stats').innerText()).replace(/\n/g,' '));
await p.screenshot({path:`${SP}/9-kort-${scheme}.png`});
// Følger kortet med? Prikken skal være nær midten
const mid=await p.evaluate(()=>{const m=document.querySelector('.map').getBoundingClientRect();const d=document.querySelector('.me-dot').getBoundingClientRect();return [Math.round(d.x+d.width/2-m.x-m.width/2),Math.round(d.y+d.height/2-m.y-m.height/2)]});
console.log(scheme,'prik fra midten (px):',mid);
const box=await p.locator('.map').boundingBox();await p.mouse.move(box.x+150,box.y+150);await p.mouse.down();await p.mouse.move(box.x+60,box.y+90,{steps:5});await p.mouse.up();
console.log(scheme,'flyttet selv, knap vist:',await p.locator('.fab').isVisible());
await p.getByText('Find retur').click();await p.waitForSelector('.way .big');await p.waitForTimeout(500);
console.log(scheme,'retur:',(await p.locator('.way').innerText()).replace(/\n/g,' | '));
await p.screenshot({path:`${SP}/10-retur-${scheme}.png`});
const startVis=await p.evaluate(()=>{const m=document.querySelector('.map').getBoundingClientRect();const d=document.querySelector('.start-dot').getBoundingClientRect();return d.x>=m.x&&d.right<=m.right&&d.y>=m.y&&d.bottom<=m.bottom});
console.log(scheme,'start synlig ved retur:',startVis);
await p.locator('.fab').click();await p.waitForTimeout(400);
console.log(scheme,'følg mig igen, knap væk:',!(await p.locator('.fab').count()));
await p.getByText('Skjul pil').click();await p.waitForSelector('.stats');
await p.goto('http://localhost:4173/#/');await p.waitForSelector('text=Spor kører');
await p.screenshot({path:`${SP}/8-spor-${scheme}.png`});
// Genåbn appen: sporet skal stadig være der
await p.reload();await p.waitForSelector('text=Spor kører');
console.log(scheme,'efter genindlæsning: ok');
await ctx.close();}
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
