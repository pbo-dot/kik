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
await p.getByText('Start spor').click();await p.waitForSelector('text=Spor kører');
for (const [lat,lon] of walk.slice(1)) { await ctx.setGeolocation({latitude:lat,longitude:lon,accuracy:8}); await p.waitForTimeout(250); }
await p.waitForTimeout(300);
await p.screenshot({path:`${SP}/8-spor-${scheme}.png`});
console.log(scheme,'kort:',(await p.locator('.track .big').innerText()));
await p.getByText('Find retur').click();await p.waitForSelector('.way .big');await p.waitForTimeout(800);
console.log(scheme,'retur:',(await p.locator('.way').innerText()).replace(/\n/g,' | '));
await p.screenshot({path:`${SP}/9-retur-${scheme}.png`});
// Genåbn appen: sporet skal stadig være der
await p.reload();await p.waitForSelector('.way .big');
console.log(scheme,'efter genindlæsning: ok');
await ctx.close();}
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
