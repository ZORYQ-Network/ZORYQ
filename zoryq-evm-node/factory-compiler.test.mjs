import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFactoryPrompt,compilerStatus} from './factory-compiler.mjs';

const cases=[
 ['condomínio com moradores, encomendas, reservas e ocorrências',['residents','packages','reservations','incidents']],
 ['clínica com pacientes, consultas, financeiro e notificações',['patients','appointments','invoices','notifications']],
 ['loja ecommerce com produtos, estoque, clientes e pedidos',['products','inventory','clients','orders']],
 ['transportadora com frota, manutenção, clientes e pedidos',['vehicles','maintenance','clients','orders']],
 ['construtora para obras, tarefas, fornecedores, contratos e documentos',['projects','tasks','suppliers','contracts','documents']],
 ['agência de marketing com clientes, projetos, tarefas e conteúdo',['clients','projects','tasks','content']],
 ['helpdesk de TI com clientes, chamados, tarefas e projetos',['clients','tickets','tasks','projects']]
];

for(const [prompt,expected] of cases)test(`compile: ${prompt}`,()=>{
  const spec=compileFactoryPrompt(`Crie um sistema para ${prompt}`);
  const ids=new Set(spec.modules.map(m=>m.id));
  for(const id of expected)assert.equal(ids.has(id),true,`missing ${id}`);
  assert.equal(spec.v,3);
  assert.equal(spec.cloud,true);
  assert.equal(spec.capabilities.crud,true);
});

test('unknown domain gets useful generic fallback instead of failing',()=>{
 const spec=compileFactoryPrompt('Crie um aplicativo para controlar colmeias, apiários e inspeções de campo');
 assert.ok(spec.modules.length>=1);
 assert.ok(spec.modules.some(m=>m.generatedFallback));
});

test('evolution preserves modules and adds requested capability/module/field',()=>{
 const base=compileFactoryPrompt('Crie um sistema para clínica com pacientes e consultas',{chain:false,cloud:false});
 const next=compileFactoryPrompt('Adicione financeiro, ative cloud e adicione o campo convênio em Pacientes',{baseSpec:base});
 assert.equal(next.version,2);
 assert.equal(next.cloud,true);
 assert.ok(next.modules.some(m=>m.id==='invoices'));
 const patients=next.modules.find(m=>m.id==='patients');
 assert.ok(patients.fields.some(f=>f.id==='convenio'));
});

test('evolution can remove module and enable blockchain',()=>{
 const base=compileFactoryPrompt('Crie loja com produtos, estoque e pedidos',{chain:false});
 const next=compileFactoryPrompt('Remova estoque e ative blockchain',{baseSpec:base});
 assert.equal(next.modules.some(m=>m.id==='inventory'),false);
 assert.equal(next.chain,true);
});

test('compiler publishes explicit evidence boundary',()=>{
 const s=compilerStatus();
 assert.equal(s.ok,true);
 assert.ok(s.catalogModules>=20);
 assert.match(s.claimBoundary,/not arbitrary/i);
});
