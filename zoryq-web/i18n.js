(()=>{
  const SUPPORTED=['en','pt-BR','es','fr','de','zh-CN','ja','ko'];
  const NAMES={'en':'English','pt-BR':'Português (Brasil)','es':'Español','fr':'Français','de':'Deutsch','zh-CN':'简体中文','ja':'日本語','ko':'한국어'};
  const aliases={'pt':'pt-BR','pt-br':'pt-BR','es-es':'es','es-mx':'es','fr-fr':'fr','de-de':'de','zh':'zh-CN','zh-cn':'zh-CN','ja-jp':'ja','ko-kr':'ko','en-us':'en','en-gb':'en'};
  function normalize(v){if(!v)return null;const raw=String(v).trim();if(SUPPORTED.includes(raw))return raw;const low=raw.toLowerCase();if(aliases[low])return aliases[low];const base=low.split('-')[0];return aliases[base]||SUPPORTED.find(x=>x.toLowerCase()===low)||null}
  function detect(){const q=normalize(new URL(location.href).searchParams.get('lang'));if(q)return q;const saved=normalize(localStorage.getItem('zoryq.lang'));if(saved)return saved;for(const l of navigator.languages||[navigator.language]){const n=normalize(l);if(n)return n}return 'en'}
  let current=detect();
  document.documentElement.lang=current;
  function setLanguage(lang,{reload=true}={}){const n=normalize(lang)||'en';localStorage.setItem('zoryq.lang',n);current=n;document.documentElement.lang=n;window.dispatchEvent(new CustomEvent('zoryq:language',{detail:{language:n}}));if(reload)location.reload()}
  function mountSelector(target){const host=typeof target==='string'?document.querySelector(target):target;if(!host)return null;const select=document.createElement('select');select.setAttribute('aria-label','Language');select.className='zoryq-language-select';for(const code of SUPPORTED){const o=document.createElement('option');o.value=code;o.textContent=NAMES[code];o.selected=code===current;select.appendChild(o)}select.onchange=()=>setLanguage(select.value);host.appendChild(select);return select}
  window.ZORYQI18N={supported:SUPPORTED,names:NAMES,language:()=>current,normalize,detect,setLanguage,mountSelector};
})();
