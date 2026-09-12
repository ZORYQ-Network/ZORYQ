const F=(id,label,type='text',extra={})=>({id,label,type,...extra});
const M=(id,label,icon,fields,extra={})=>({id,label,icon,fields,...extra});
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const slug=s=>norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'module';
const title=s=>String(s||'App ZORYQ').trim().replace(/\s+/g,' ').split(' ').slice(0,8).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');

const CATALOG={
 residents:{aliases:['morador','moradores','residente','residentes','condomino','condominos'],module:M('residents','Moradores','👤',[F('name','Nome completo','text',{required:true}),F('unit','Unidade','text',{required:true}),F('phone','Telefone','tel'),F('email','E-mail','email'),F('status','Status','select',{options:['Ativo','Inativo']})],{titleField:'name',subtitleFields:['unit','phone']})},
 packages:{aliases:['encomenda','encomendas','pacote','pacotes','entrega','entregas'],module:M('packages','Encomendas','📦',[F('recipient','Destinatário','text',{required:true}),F('carrier','Transportadora','text'),F('code','Código','text'),F('receivedAt','Recebida em','datetime-local'),F('status','Status','select',{options:['Aguardando','Entregue']})],{titleField:'recipient',subtitleFields:['carrier','status']})},
 reservations:{aliases:['reserva','reservas','agendamento','agendamentos','agenda'],module:M('reservations','Reservas','📅',[F('person','Responsável','text',{required:true}),F('resource','Recurso / local','text',{required:true}),F('date','Data','date',{required:true}),F('time','Horário','time'),F('status','Status','select',{options:['Pendente','Confirmada','Cancelada']})],{titleField:'resource',subtitleFields:['date','time']})},
 clients:{aliases:['cliente','clientes','crm','lead','leads','prospect','prospects'],module:M('clients','Clientes','🤝',[F('name','Nome','text',{required:true}),F('phone','Telefone','tel'),F('email','E-mail','email'),F('stage','Etapa','select',{options:['Novo','Contato','Proposta','Ativo','Concluído']}),F('notes','Observações','textarea')],{titleField:'name',subtitleFields:['stage','phone']})},
 products:{aliases:['produto','produtos','catalogo','catálogo'],module:M('products','Produtos','🛍️',[F('name','Produto','text',{required:true}),F('sku','SKU','text'),F('price','Preço','number',{min:0,step:'0.01'}),F('category','Categoria','text'),F('status','Status','select',{options:['Ativo','Inativo']})],{titleField:'name',subtitleFields:['sku','price']})},
 inventory:{aliases:['estoque','inventario','inventário'],module:M('inventory','Estoque','📦',[F('name','Item','text',{required:true}),F('sku','SKU','text'),F('qty','Quantidade','number',{required:true,min:0}),F('minQty','Estoque mínimo','number',{min:0}),F('location','Localização','text')],{titleField:'name',subtitleFields:['qty','location']})},
 orders:{aliases:['pedido','pedidos','venda','vendas','order','orders'],module:M('orders','Pedidos','🧾',[F('number','Número','text',{required:true}),F('customer','Cliente','text',{required:true}),F('total','Total','number',{min:0,step:'0.01'}),F('date','Data','date'),F('status','Status','select',{options:['Novo','Pago','Separação','Enviado','Concluído','Cancelado']})],{titleField:'number',subtitleFields:['customer','status']})},
 invoices:{aliases:['fatura','faturas','cobranca','cobrança','financeiro','recebimento','recebimentos'],module:M('invoices','Financeiro','💳',[F('description','Descrição','text',{required:true}),F('amount','Valor','number',{required:true,step:'0.01'}),F('dueDate','Vencimento','date'),F('kind','Tipo','select',{options:['Receita','Despesa']}),F('status','Status','select',{options:['Aberto','Pago','Vencido','Cancelado']})],{titleField:'description',subtitleFields:['amount','status']})},
 budget:{aliases:['orcamento','orçamento','budget','previsao financeira','previsão financeira'],module:M('budget','Orçamento','💰',[F('name','Período / cenário','text',{required:true}),F('income','Receita','number'),F('fixed','Despesas fixas','number'),F('variable','Despesas variáveis','number'),F('reserve','Reserva','number')],{titleField:'name',subtitleFields:['income','fixed']})},
 tasks:{aliases:['tarefa','tarefas','kanban','to-do','todo'],module:M('tasks','Tarefas','✅',[F('title','Tarefa','text',{required:true}),F('owner','Responsável','text'),F('priority','Prioridade','select',{options:['Baixa','Média','Alta','Crítica']}),F('due','Prazo','date'),F('status','Status','select',{options:['Aberta','Em andamento','Bloqueada','Concluída']})],{titleField:'title',subtitleFields:['priority','status']})},
 projects:{aliases:['projeto','projetos','obra','obras'],module:M('projects','Projetos','🏗️',[F('name','Projeto','text',{required:true}),F('owner','Responsável','text'),F('startDate','Início','date'),F('endDate','Fim previsto','date'),F('budget','Orçamento','number',{min:0}),F('status','Status','select',{options:['Planejamento','Em andamento','Pausado','Concluído']})],{titleField:'name',subtitleFields:['status','endDate']})},
 tickets:{aliases:['chamado','chamados','ticket','tickets','suporte','helpdesk','atendimento'],module:M('tickets','Chamados','🎫',[F('title','Assunto','text',{required:true}),F('requester','Solicitante','text'),F('category','Categoria','text'),F('priority','Prioridade','select',{options:['Baixa','Média','Alta','Crítica']}),F('status','Status','select',{options:['Aberto','Em atendimento','Aguardando','Resolvido']})],{titleField:'title',subtitleFields:['priority','status']})},
 patients:{aliases:['paciente','pacientes','clinica','clínica','consultorio','consultório'],module:M('patients','Pacientes','🩺',[F('name','Nome','text',{required:true}),F('phone','Telefone','tel'),F('email','E-mail','email'),F('birthDate','Nascimento','date'),F('notes','Observações','textarea')],{titleField:'name',subtitleFields:['phone','birthDate']})},
 appointments:{aliases:['consulta','consultas','sessao','sessão','sessoes','sessões'],module:M('appointments','Atendimentos','🗓️',[F('person','Pessoa / paciente','text',{required:true}),F('professional','Profissional','text'),F('date','Data','date',{required:true}),F('time','Horário','time'),F('status','Status','select',{options:['Agendado','Confirmado','Realizado','Cancelado']})],{titleField:'person',subtitleFields:['date','status']})},
 students:{aliases:['aluno','alunos','estudante','estudantes','escola','curso','cursos'],module:M('students','Alunos','🎓',[F('name','Nome','text',{required:true}),F('class','Turma / curso','text'),F('guardian','Responsável','text'),F('phone','Telefone','tel'),F('status','Status','select',{options:['Ativo','Trancado','Concluído']})],{titleField:'name',subtitleFields:['class','status']})},
 vehicles:{aliases:['veiculo','veículo','veiculos','veículos','frota','carro','carros'],module:M('vehicles','Veículos','🚗',[F('plate','Placa','text',{required:true}),F('model','Modelo','text'),F('owner','Responsável','text'),F('mileage','Quilometragem','number',{min:0}),F('status','Status','select',{options:['Ativo','Manutenção','Inativo']})],{titleField:'plate',subtitleFields:['model','status']})},
 maintenance:{aliases:['manutencao','manutenção','manutencoes','manutenções','preventiva','corretiva'],module:M('maintenance','Manutenções','🛠️',[F('asset','Ativo / equipamento','text',{required:true}),F('kind','Tipo','select',{options:['Preventiva','Corretiva','Inspeção']}),F('scheduled','Data prevista','date'),F('cost','Custo','number',{min:0,step:'0.01'}),F('status','Status','select',{options:['Planejada','Em execução','Concluída']})],{titleField:'asset',subtitleFields:['kind','status']})},
 suppliers:{aliases:['fornecedor','fornecedores','supplier','suppliers'],module:M('suppliers','Fornecedores','🏢',[F('name','Fornecedor','text',{required:true}),F('contact','Contato','text'),F('phone','Telefone','tel'),F('email','E-mail','email'),F('category','Categoria','text')],{titleField:'name',subtitleFields:['category','phone']})},
 contracts:{aliases:['contrato','contratos'],module:M('contracts','Contratos','📄',[F('title','Contrato','text',{required:true}),F('party','Contraparte','text'),F('startDate','Início','date'),F('endDate','Fim','date'),F('value','Valor','number',{step:'0.01'}),F('status','Status','select',{options:['Rascunho','Vigente','Encerrado']})],{titleField:'title',subtitleFields:['party','status']})},
 documents:{aliases:['documento','documentos','arquivo','arquivos'],module:M('documents','Documentos','🗂️',[F('title','Título','text',{required:true}),F('category','Categoria','text'),F('url','URL / referência','url'),F('date','Data','date'),F('notes','Observações','textarea')],{titleField:'title',subtitleFields:['category','date']})},
 notifications:{aliases:['notificacao','notificação','notificacoes','notificações','aviso','avisos','mensagem','mensagens'],module:M('notifications','Notificações','🔔',[F('title','Título','text',{required:true}),F('message','Mensagem','textarea',{required:true}),F('audience','Público','text'),F('status','Status','select',{options:['Rascunho','Pronta','Enviada']})],{titleField:'title',subtitleFields:['audience','status']})},
 content:{aliases:['post','posts','conteudo','conteúdo','conteudos','conteúdos','publicacao','publicação'],module:M('content','Conteúdo','✍️',[F('title','Título','text',{required:true}),F('body','Conteúdo','textarea'),F('channel','Canal','text'),F('publishAt','Publicar em','datetime-local'),F('status','Status','select',{options:['Ideia','Rascunho','Aprovado','Publicado']})],{titleField:'title',subtitleFields:['channel','status']})},
 incidents:{aliases:['ocorrencia','ocorrência','ocorrencias','ocorrências','incidente','incidentes'],module:M('incidents','Ocorrências','⚠️',[F('category','Categoria','text',{required:true}),F('description','Descrição','textarea',{required:true}),F('date','Data','date'),F('responsible','Responsável','text'),F('status','Status','select',{options:['Aberta','Em análise','Resolvida']})],{titleField:'category',subtitleFields:['status','date']})}
};

const DOMAIN_PRESETS=[
 {match:['condominio','condomínio'],ids:['residents','packages','reservations','incidents','notifications','vehicles']},
 {match:['clinica','clínica','consultorio','consultório'],ids:['patients','appointments','invoices','notifications']},
 {match:['escola','curso','academia de ensino'],ids:['students','appointments','invoices','notifications']},
 {match:['loja','ecommerce','e-commerce','comercio','comércio'],ids:['products','inventory','clients','orders','invoices']},
 {match:['restaurante','lanchonete','bar'],ids:['products','inventory','orders','suppliers','invoices']},
 {match:['transportadora','logistica','logística','frota'],ids:['vehicles','maintenance','clients','orders','suppliers']},
 {match:['construtora','obra','obras'],ids:['projects','tasks','suppliers','contracts','invoices','documents']},
 {match:['agencia','agência','marketing'],ids:['clients','projects','tasks','content','invoices']},
 {match:['suporte','helpdesk','ti ','software house'],ids:['clients','tickets','tasks','projects']}
];

function cloneModule(id){return JSON.parse(JSON.stringify(CATALOG[id].module));}
function detectModules(text){const n=norm(text),ids=new Set();
 for(const p of DOMAIN_PRESETS)if(p.match.some(x=>n.includes(norm(x))))p.ids.forEach(x=>ids.add(x));
 for(const [id,c] of Object.entries(CATALOG))if(c.aliases.some(a=>n.includes(norm(a))))ids.add(id);
 return [...ids];
}
function genericModules(text){const n=norm(text);const chunks=n.split(/[,;\n]|\be\b|\bcom\b/).map(x=>x.trim()).filter(Boolean);const stop=new Set(['crie','criar','sistema','aplicativo','app','para','de','um','uma','meu','minha','gestao','gestão','controle','cadastro']);const out=[];
 for(const chunk of chunks){const words=chunk.split(/\s+/).filter(w=>w.length>3&&!stop.has(w));if(!words.length)continue;const label=title(words.slice(-2).join(' '));const id=slug(label);if(out.some(m=>m.id===id)||CATALOG[id])continue;out.push(M(id,label,'🧩',[F('title','Título','text',{required:true}),F('status','Status','select',{options:['Novo','Em andamento','Concluído']}),F('date','Data','date'),F('notes','Observações','textarea')],{titleField:'title',subtitleFields:['status','date'],generatedFallback:true}));if(out.length>=8)break;
 }
 return out;
}
function inferName(prompt){const m=String(prompt).match(/(?:chamad[oa]|nome(?:ado)?|app\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ -]{2,50})/i);if(m)return title(m[1]);const domain=DOMAIN_PRESETS.find(p=>p.match.some(x=>norm(prompt).includes(norm(x))));return domain?`ZORYQ ${title(domain.match[0])}`:'ZORYQ Generated App';}
function applyEvolution(base,prompt){const next=JSON.parse(JSON.stringify(base));const n=norm(prompt);next.version=Math.max(2,Number(next.version||1)+1);next.prompt=`${base.prompt||''}\nEVOLVE: ${prompt}`.trim();
 const rename=String(prompt).match(/(?:renome(?:ie|ar)|mude o nome para|nome para)\s+["']?([^"'.,;]{2,60})/i);if(rename)next.name=title(rename[1]);
 for(const [id,c] of Object.entries(CATALOG)){
  const mentioned=c.aliases.some(a=>n.includes(norm(a)));
  if(!mentioned)continue;
  if(/\b(remova|remover|exclua|excluir|sem)\b/.test(n))next.modules=(next.modules||[]).filter(m=>m.id!==id);
  else if(!next.modules.some(m=>m.id===id))next.modules.push(cloneModule(id));
 }
 if(/\b(ativar|ative|adicionar|adicione)\b.*\b(blockchain|onchain|on-chain)\b/.test(n))next.chain=true;
 if(/\b(desativar|remover|sem)\b.*\b(blockchain|onchain|on-chain)\b/.test(n))next.chain=false;
 if(/\b(ativar|ative|adicionar|adicione)\b.*\b(cloud|nuvem|login|usuarios|usuários)\b/.test(n))next.cloud=true;
 const addField=String(prompt).match(/(?:adicione|adicionar|inclua|incluir)\s+(?:o\s+)?campo\s+["']?([^"',.;]{2,40})["']?(?:\s+(?:em|no|na)\s+([^.,;]{2,40}))?/i);
 if(addField&&next.modules.length){const target=addField[2]?next.modules.find(m=>norm(m.label).includes(norm(addField[2]))||norm(m.id).includes(slug(addField[2]))):next.modules[0];if(target){target.fields ||= [];const id=slug(addField[1]).replace(/-/g,'_');if(!target.fields.some(f=>f.id===id))target.fields.push(F(id,title(addField[1]),'text'));}}
 next.capabilities=capabilities(next);return next;
}
function capabilities(spec){const modules=spec.modules||[];return {crud:true,search:true,relations:true,validation:true,roles:!!spec.cloud,cloudPersistence:!!spec.cloud,offlineCache:true,evolution:true,export:true,androidBuild:true,onchainProof:!!spec.chain,moduleCount:modules.length,genericFallbackModules:modules.filter(m=>m.generatedFallback).length};}

export function compileFactoryPrompt(prompt,{baseSpec=null,chain=true,cloud=true}={}){
 const clean=String(prompt||'').trim();if(clean.length<3)throw Error('prompt_too_short');if(clean.length>8000)throw Error('prompt_too_long');
 if(baseSpec)return applyEvolution(baseSpec,clean);
 let ids=detectModules(clean);let modules=ids.map(cloneModule);if(!modules.length)modules=genericModules(clean);if(!modules.length)modules=[M('records','Registros','🧩',[F('title','Título','text',{required:true}),F('value','Valor','text'),F('notes','Observações','textarea')],{titleField:'title',subtitleFields:['value'],generatedFallback:true})];
 const spec={v:3,version:1,id:`app-${slug(inferName(clean))}-${Math.random().toString(36).slice(2,8)}`,name:inferName(clean),description:clean.slice(0,280),prompt:clean,domain:'generalized',modules:modules.slice(0,24),chain:Boolean(chain),cloud:Boolean(cloud),runtime:'zoryq-schema-runtime-v3',status:'experimental-generalized'};spec.capabilities=capabilities(spec);return spec;
}

export function compilerStatus(){return {ok:true,version:'0.3',catalogModules:Object.keys(CATALOG).length,presets:DOMAIN_PRESETS.length,maxModules:24,fallback:'generic-schema-module',supportsEvolution:true,claimBoundary:'Generalized schema compilation for common CRUD/workflow applications; not arbitrary Turing-complete software synthesis or audited production code generation.'};}
