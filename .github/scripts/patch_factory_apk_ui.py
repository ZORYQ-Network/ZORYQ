from pathlib import Path

p = Path('zoryq-web/launch-studio.html')
s = p.read_text()

if "const APK_BUILDER='https://accomplished-appreciation-production-6355.up.railway.app'" in s:
    print('Factory APK UI already wired')
    raise SystemExit(0)

start = s.find('async function exclusiveApk(){')
end_marker = "window.open('https://github.com/ZORYQ-Network/ZORYQ/actions/workflows/factory-app-apk.yml','_blank','noopener')}"
if start < 0:
    raise SystemExit('exclusiveApk function start not found')
end = s.find(end_marker, start)
if end < 0:
    raise SystemExit('exclusiveApk legacy end marker not found')
end += len(end_marker)

new = r'''const APK_BUILDER='https://accomplished-appreciation-production-6355.up.railway.app';
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function exclusiveApk(){
  if(!currentSpec||!currentUrl)return;
  const btn=$('exclusiveApk');btn.disabled=true;btn.textContent='Gerando APK…';
  try{
    $('msg').innerHTML='<span class="yellow">Gerando APK Android exclusivo e assinado…</span>';
    const r=await fetch(APK_BUILDER+'/factory/apk/build',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({app_name:currentSpec.name,app_id:currentSpec.id,app_slug:slugify(currentSpec.name),app_url:currentUrl})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Falha ao iniciar build Android');
    let status=null;
    for(let i=0;i<120;i++){
      await sleep(3000);
      const sr=await fetch(APK_BUILDER+j.statusUrl,{cache:'no-store'});
      status=await sr.json().catch(()=>({}));
      if(status.status==='ready'||status.status==='failed')break;
      $('msg').innerHTML='<span class="yellow">APK em compilação…</span> O Factory está assinando e verificando o pacote.';
    }
    if(!status||status.status!=='ready')throw Error(status?.error||'Build não concluiu no tempo esperado');
    const url=APK_BUILDER+status.downloadUrl;
    const a=document.createElement('a');a.href=url;a.download=`${slugify(currentSpec.name)}.apk`;document.body.appendChild(a);a.click();a.remove();
    $('apkInfo').textContent=`APK exclusivo pronto · ${status.packageId} · v${status.versionName} · assinatura permanente · SHA-256 ${status.sha256}`;
    $('msg').innerHTML='<span class="ok">APK exclusivo gerado, assinado e liberado para download.</span>';
  }catch(e){$('msg').innerHTML='<span class="bad">'+String(e.message||e)+'</span>';}
  finally{btn.disabled=false;btn.textContent='Gerar APK exclusivo'}
}'''

s = s[:start] + new + s[end:]
s = s.replace('Preparar build exclusivo', 'Gerar APK exclusivo', 1)
s = s.replace('APK exclusivo usa o workflow dedicado.', 'APK exclusivo é gerado automaticamente pelo Factory.', 1)
p.write_text(s)
print('Factory APK UI wired successfully')
