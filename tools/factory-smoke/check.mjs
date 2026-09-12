import fs from 'node:fs';
import vm from 'node:vm';

const launchPath = 'zoryq-web/launch-studio.html';
const runtimePath = 'zoryq-web/project-launch.html';
const launch = fs.readFileSync(launchPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');

function inlineScripts(html) {
  return [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((s) => s.trim());
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const [name, html] of [['launch', launch], ['runtime', runtime]]) {
  const scripts = inlineScripts(html);
  assert(scripts.length > 0, `${name}: missing inline script`);
  for (const [index, script] of scripts.entries()) {
    new vm.Script(script, { filename: `${name}-inline-${index}.js` });
  }
}

for (const token of [
  'compileRequirements',
  'zoryq-schema-runtime-v2',
  "'residents'",
  "'packages'",
  "'reservations'",
  "'incidents'",
  "'notifications'",
  'uniqueTogether',
  'evolve'
]) assert(launch.includes(token), `launch: missing ${token}`);

for (const token of [
  'renderField',
  "type==='relation'",
  'saveRecord',
  'editRecord',
  'removeRecord',
  'findReferences',
  'uniqueViolation',
  'exportData',
  'deployProof',
  'writeProof',
  'zoryq-schema-runtime-v2'
]) assert(runtime.includes(token), `runtime: missing ${token}`);

assert(!launch.includes('eval('), 'launch: eval is not allowed');
assert(!runtime.includes('eval('), 'runtime: eval is not allowed');

const evidence = {
  ok: true,
  milestone: 'factory-dynamic-multimodule-v0.1',
  checks: {
    javascriptSyntax: true,
    condominiumFiveModuleProvingCase: true,
    relationFieldsPresent: true,
    createUpdateDeleteRuntimePresent: true,
    uniquenessRulePresent: true,
    promptEvolutionPresent: true,
    webExportPresent: true,
    optionalTestnetProofPresent: true,
    evalAbsent: true
  },
  claimBoundary: 'Static smoke evidence only. This does not prove arbitrary app generation, backend/auth/database generation, independent user adoption, audited generated contracts, or production readiness.'
};

console.log(JSON.stringify(evidence, null, 2));
