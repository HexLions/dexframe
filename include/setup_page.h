// DexFrame — setup / rescue page, embedded in the firmware so it works even with
// an empty LittleFS: Wi-Fi, firmware update (OTA) and web UI files upload.
#pragma once
#include <pgmspace.h>

static const char SETUP_PAGE[] PROGMEM = R"HTML(<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DexFrame setup</title>
<style>
:root{--bg:#f4f4f2;--fg:#1b1b1b;--mu:#666;--card:#fff;--ln:#ddd;--acc:#2a6fdb}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--mu:#999;--card:#1e1e1e;--ln:#333;--acc:#5b93f0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif}
main{max-width:560px;margin:0 auto;padding:16px}h1{font-size:20px;margin:0 0 12px}
section{background:var(--card);border:1px solid var(--ln);border-radius:8px;padding:12px;margin-bottom:12px}
h2{font-size:15px;margin:0 0 8px}label{display:flex;flex-direction:column;font-size:12px;color:var(--mu);gap:2px;margin-bottom:8px}
input,select,button{font:inherit;padding:8px;border:1px solid var(--ln);border-radius:6px;background:var(--bg);color:var(--fg);width:100%}
button{cursor:pointer;width:auto}.p{background:var(--acc);color:#fff;border-color:var(--acc)}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.m{font-size:13px;color:var(--mu)}progress{width:100%}
#nets button{display:flex;justify-content:space-between;width:100%;margin-bottom:4px;text-align:left}
</style></head><body><main>
<h1>DexFrame</h1>
<section><h2 data-t="wifi"></h2>
<div class="row"><button id="scan" data-t="scan"></button><span class="m" id="cur"></span></div>
<div id="nets" style="margin-top:8px"></div>
<label><span data-t="ssid"></span><input id="ssid" autocomplete="off"></label>
<label><span data-t="pass"></span><input id="pass" type="password" autocomplete="off"></label>
<label><span data-t="host"></span><input id="host" autocomplete="off"></label>
<button class="p" id="save" data-t="save"></button> <span class="m" id="wst"></span></section>
<section><h2 data-t="fw"></h2><p class="m" data-t="fwi"></p>
<input type="file" id="fw" accept=".bin"><progress id="fwp" max="1" value="0" hidden></progress><span class="m" id="fst"></span></section>
<section><h2 data-t="ui"></h2><p class="m" data-t="uii"></p>
<input type="file" id="www" webkitdirectory multiple><progress id="uip" max="1" value="0" hidden></progress><span class="m" id="ust"></span></section>
<section><h2 data-t="adm"></h2><p class="m" data-t="admi"></p>
<label><span data-t="key"></span><input id="key" type="password" autocomplete="off"></label>
<label><span data-t="nkey"></span><input id="nkey" type="password" autocomplete="off"></label>
<div class="row"><button id="newkey" data-t="setkey"></button><button id="forget" data-t="forget"></button><a href="/" data-t="open"></a></div>
<span class="m" id="ast"></span></section>
</main><script>
const T={it:{wifi:'Rete Wi-Fi',scan:'Cerca reti',ssid:'Nome rete (SSID)',pass:'Password',host:'Nome del display (http://NOME.local)',save:'Salva e riavvia',
fw:'Aggiorna firmware',fwi:'File dexframe-…-ota.bin (o .pio/build/<env>/firmware.bin). Le pagine e i dati restano.',
ui:'Carica interfaccia web',uii:'Scegli la cartella data/www del progetto: i file vengono copiati uno per uno, pagine e dati restano.',
adm:'Sicurezza',admi:'Chiave opzionale: se impostata, ogni modifica (pagine, aggiornamenti, Wi-Fi) la richiede. Per azzerare Wi-Fi e chiave tieni premuto il tasto (GPIO33, o BOOT) per 8 secondi.',
key:'Chiave attuale (se impostata)',nkey:'Nuova chiave (vuota = nessuna)',setkey:'Cambia chiave',forget:'Dimentica Wi-Fi',open:'Apri DexFrame →',saved:'Salvato, riavvio…',done:'Fatto',err:'Errore: ',
scanning:'Ricerca…',conn:'Connesso a: ',ap:'Modalità configurazione',sending:'Invio ',reboot:'Aggiornato, riavvio…'},
en:{wifi:'Wi-Fi network',scan:'Scan',ssid:'Network name (SSID)',pass:'Password',host:'Display name (http://NAME.local)',save:'Save and restart',
fw:'Update firmware',fwi:'File dexframe-…-ota.bin (or .pio/build/<env>/firmware.bin). Pages and data are kept.',
ui:'Upload web interface',uii:'Pick the project data/www folder: files are copied one by one, pages and data are kept.',
adm:'Security',admi:'Optional key: when set, every change (pages, updates, Wi-Fi) requires it. To clear Wi-Fi and key, hold the button (GPIO33, or BOOT) for 8 seconds.',
key:'Current key (if set)',nkey:'New key (empty = none)',setkey:'Change key',forget:'Forget Wi-Fi',open:'Open DexFrame →',saved:'Saved, restarting…',done:'Done',err:'Error: ',
scanning:'Scanning…',conn:'Connected to: ',ap:'Setup mode',sending:'Sending ',reboot:'Updated, restarting…'}};
const L=T[(navigator.language||'en').slice(0,2)]||T.en,$=i=>document.getElementById(i);
document.querySelectorAll('[data-t]').forEach(e=>e.textContent=L[e.dataset.t]);
let key='';try{key=localStorage.getItem('dexframe-key')||''}catch{}$('key').value=key;
$('key').oninput=()=>{key=$('key').value;try{localStorage.setItem('dexframe-key',key)}catch{}};
const q=(p,o={})=>{const u=new URLSearchParams(o);if(key)u.set('key',key);return p+'?'+u};
const up=(url,file,name,bar)=>new Promise((res,rej)=>{const x=new XMLHttpRequest(),fd=new FormData();fd.append(name,file,file.name);
x.open('POST',url);if(bar){bar.hidden=false;x.upload.onprogress=e=>{bar.value=e.loaded/(e.total||1)}}
x.onload=()=>x.status<300?res(x.responseText):rej(new Error(x.status+' '+x.responseText));x.onerror=()=>rej(new Error('rete/network'));x.send(fd)});
fetch('/api/info').then(r=>r.json()).then(i=>{$('cur').textContent=i.ap?L.ap:L.conn+(i.ssid||'');$('ssid').value=i.ssid||'';$('host').value=i.host||'dexframe'}).catch(()=>{});
$('scan').onclick=async()=>{$('nets').textContent=L.scanning;try{const n=await(await fetch('/api/wifi/scan')).json();
$('nets').replaceChildren(...n.map(w=>{const b=document.createElement('button');b.type='button';b.innerHTML='<span></span><span class="m"></span>';
b.firstChild.textContent=w.ssid;b.lastChild.textContent=(w.secure?'🔒 ':'')+w.rssi+' dBm';b.onclick=()=>{$('ssid').value=w.ssid;$('pass').focus()};return b}))}catch(e){$('nets').textContent=L.err+e.message}};
$('save').onclick=async()=>{const r=await fetch(q('/api/wifi',{ssid:$('ssid').value,pass:$('pass').value,host:$('host').value}),{method:'POST'});$('wst').textContent=r.ok?L.saved:L.err+r.status};
$('forget').onclick=async()=>{const r=await fetch(q('/api/wifi/forget'),{method:'POST'});$('ast').textContent=r.ok?L.saved:L.err+r.status};
$('newkey').onclick=async()=>{const nk=$('nkey').value;const r=await fetch(q('/api/key',{new:nk}),{method:'POST'});
if(r.ok){key=nk;$('key').value=nk;$('nkey').value='';try{localStorage.setItem('dexframe-key',nk)}catch{}}$('ast').textContent=r.ok?L.done:L.err+r.status};
$('fw').onchange=async e=>{const f=e.target.files[0];if(!f)return;$('fst').textContent=L.sending+f.name;
try{await up(q('/api/ota'),f,'firmware',$('fwp'));$('fst').textContent=L.reboot;setTimeout(()=>location.reload(),9000)}catch(x){$('fst').textContent=L.err+x.message}};
$('www').onchange=async e=>{const fs=[...e.target.files].filter(f=>!/(^|\/)\./.test(f.webkitRelativePath));let i=0;$('uip').hidden=false;
try{for(const f of fs){const rel=f.webkitRelativePath.split('/').slice(1).join('/');$('ust').textContent=L.sending+(++i)+'/'+fs.length+' '+rel;
await up(q('/api/fs',{path:'/www/'+rel}),f,'file');$('uip').value=i/fs.length}$('ust').textContent=L.done+' ('+fs.length+')'}catch(x){$('ust').textContent=L.err+x.message}};
</script></body></html>)HTML";
