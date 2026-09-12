const OPENAI_API_KEY=String(process.env.OPENAI_API_KEY||'').trim();
const AI_API_URL=String(process.env.ZORYQ_AI_API_URL||'https://api.openai.com/v1/responses').trim();
const AI_MODEL=String(process.env.ZORYQ_FACTORY_AI_MODEL||process.env.ZORYQ_AI_MODEL||'').trim();
const MAX_REQ=6000;

function clean(v,max=MAX_REQ){return String(v||'').trim().slice(0,max)}
function extractOutputText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text;
  for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&typeof part.text==='string')return part.text;
  throw Error('ai_response_missing_output_text');
}

const DOMAIN_HINTS=[
  ['condominio',['condomínio','condominio','morador','encomenda','reserva','portaria']],
  ['financas',['finanças','financas','despesa','receita','gasto','orçamento','orcamento']],
  ['clinica',['clínica','clinica','paciente','consulta','médico','medico']],
  ['crm',['crm','cliente','lead','venda','pipeline']],
  ['estoque',['estoque','produto','inventário','inventario']],
  ['projetos',['projeto','tarefa','equipe','sprint']],
  ['loja',['loja','pedido','carrinho','produto','cliente']],
  ['escola',['escola','aluno','turma','professor','matrícula','matricula']]
];
function inferDomain(req){const l=req.toLowerCase();for(const [name,words] of DOMAIN_HINTS)if(words.some(w=>l.includes(w)))return name;return 'aplicação de gestão';}
function inferModules(req){
  const l=req.toLowerCase();
  const map=[
    ['Usuários e perfis',['usuário','usuario','login','perfil','acesso']],
    ['Receitas',['receita','entrada','recebimento']],
    ['Despesas',['despesa','saída','saida','gasto']],
    ['Categorias',['categoria']],
    ['Relatórios',['relatório','relatorio','gráfico','grafico']],
    ['Moradores',['morador','residente']],['Encomendas',['encomenda','pacote']],['Reservas',['reserva']],['Ocorrências',['ocorrência','ocorrencia']],['Notificações',['notificação','notificacao']],
    ['Clientes',['cliente']],['Leads',['lead']],['Vendas',['venda']],['Produtos',['produto']],['Estoque',['estoque']],['Pedidos',['pedido']],
    ['Pacientes',['paciente']],['Consultas',['consulta']],['Financeiro',['financeiro']],['Documentos',['documento']],['Tarefas',['tarefa']],['Projetos',['projeto']],['Agenda',['agenda']]
  ];
  const out=[];for(const [label,words] of map)if(words.some(w=>l.includes(w))&&!out.includes(label))out.push(label);
  return out.length?out:['Registros principais','Categorias/Status','Relatórios básicos'];
}

export function deterministicPrompt(requirement){
  const req=clean(requirement);if(req.length<8)throw Error('requirement_too_short');
  const domain=inferDomain(req),modules=inferModules(req);
  return `Crie uma aplicação utilizável para ${domain}, baseada neste requisito original: "${req}".\n\nOBJETIVO\nTransformar o requisito em software funcional para Web/PC e Android, priorizando simplicidade, clareza e uso real.\n\nMÓDULOS PRINCIPAIS\n${modules.map((m,i)=>`${i+1}. ${m}`).join('\n')}\n\nREGRAS DE PRODUTO\n- Gerar navegação específica para os módulos necessários.\n- Cada módulo deve ter cadastro, listagem, edição, exclusão quando aplicável, busca e validações.\n- Criar campos coerentes com o domínio e usar relações entre módulos quando fizer sentido.\n- Persistir dados localmente e, se Cloud estiver ativo, usar o backend persistente com login e perfis.\n- Usar permissões por função quando houver mais de um tipo de usuário.\n- Exibir estados vazios, mensagens de sucesso/erro e confirmação em ações destrutivas.\n- Manter layout responsivo para desktop e Android.\n- Permitir exportação dos dados quando útil.\n\nEXPERIÊNCIA\n- O usuário deve conseguir entender o sistema sem conhecimento técnico.\n- O resultado principal deve ser o aplicativo funcionando; código deve ficar apenas na área avançada.\n- Criar uma tela inicial/dashboard com os indicadores mais úteis ao objetivo.\n- Não inventar funções que contradigam o requisito original.\n\nBLOCKCHAIN ZORYQ\n- Integrar ZORYQ apenas se a opção on-chain estiver habilitada e houver valor claro em prova, recibo, pagamento, identidade ou registro verificável.\n- Não armazenar dados pessoais sensíveis on-chain; registrar somente hashes/provas quando necessário.\n\nCRITÉRIOS DE ACEITAÇÃO\n- Aplicação abre e é navegável.\n- Os fluxos principais podem ser executados do início ao fim.\n- Dados persistem após recarregar.\n- Evoluções futuras por prompt preservam o app e os dados compatíveis.\n- Web e experiência Android permanecem utilizáveis.\n\nRequisito original preservado: ${req}`;
}

export function promptArchitectStatus(){
  const aiConfigured=OPENAI_API_KEY.length>20&&AI_MODEL.length>2;
  return {ok:true,version:'0.4',aiConfigured,mode:aiConfigured?'llm-with-deterministic-fallback':'deterministic-architect-fallback',model:aiConfigured?AI_MODEL:null,claimBoundary:aiConfigured?'LLM refines requirements; compiler and security gates remain authoritative.':'No external LLM credentials are configured; refinement uses a deterministic requirements architect and is not represented as AI-generated.'};
}

async function requestAi(requirement){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
  const system=[
    'You are the ZORYQ AI App Factory Prompt Architect.',
    'Turn a short user requirement into a detailed, implementation-ready product prompt for a no-code/AI application generator.',
    'Preserve the user intent. Add sensible modules, fields, workflows, validation, roles, persistence, UX and acceptance criteria without inventing unrelated scope.',
    'Prefer usable software over code output.',
    'Treat blockchain as optional and value-driven; never put personal sensitive data onchain.',
    'The result must be in Portuguese, clear, structured and directly usable by the downstream compiler.',
    'Return plain text only.'
  ].join(' ');
  try{
    const r=await fetch(AI_API_URL,{method:'POST',headers:{authorization:`Bearer ${OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:AI_MODEL,input:[{role:'system',content:system},{role:'user',content:`Requisito do usuário:\n${requirement}`}],max_output_tokens:1800}),signal:controller.signal});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(`ai_provider_error:${data?.error?.message||r.status}`);
    const text=clean(extractOutputText(data),12000);if(text.length<80)throw Error('ai_prompt_too_short');return text;
  }finally{clearTimeout(timer)}
}

export async function refineFactoryRequirement(input={}){
  const requirement=clean(input.requirement);if(requirement.length<8)throw Error('requirement_too_short');
  const status=promptArchitectStatus();
  if(status.aiConfigured){
    try{return {ok:true,requirement,refinedPrompt:await requestAi(requirement),source:'ai',model:AI_MODEL,warning:null};}
    catch(e){return {ok:true,requirement,refinedPrompt:deterministicPrompt(requirement),source:'fallback',model:null,warning:String(e.message||e).slice(0,240)};}
  }
  return {ok:true,requirement,refinedPrompt:deterministicPrompt(requirement),source:'deterministic',model:null,warning:'external_llm_not_configured'};
}
