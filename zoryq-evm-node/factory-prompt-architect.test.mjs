import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicPrompt, promptArchitectStatus, refineFactoryRequirement } from './factory-prompt-architect.mjs';

test('deterministic architect expands a short finance requirement',async()=>{
  const req='Crie um aplicativo de despesas e finanças com receitas de entrada e saída.';
  const prompt=deterministicPrompt(req);
  assert.match(prompt,/OBJETIVO/);
  assert.match(prompt,/Receitas/);
  assert.match(prompt,/Despesas/);
  assert.match(prompt,/CRITÉRIOS DE ACEITAÇÃO/);
  assert.ok(prompt.length>700);
});

test('refinement returns an implementation-ready prompt without claiming AI when not configured',async()=>{
  const result=await refineFactoryRequirement({requirement:'Crie um sistema de estoque com produtos e relatórios.'});
  assert.equal(result.ok,true);
  assert.ok(['ai','fallback','deterministic'].includes(result.source));
  assert.ok(result.refinedPrompt.length>500);
  if(!promptArchitectStatus().aiConfigured)assert.equal(result.source,'deterministic');
});

test('short requirements are rejected',()=>{
  assert.throws(()=>deterministicPrompt('app'),/requirement_too_short/);
});
