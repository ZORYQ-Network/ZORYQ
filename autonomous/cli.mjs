#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createCompanyPlan, simulateCompany, verifyProofPack } from './lib/core.mjs';

function parseArgs(argv) {
  const result = { command: 'plan' };
  const args = [...argv];
  if (args[0] && !args[0].startsWith('--')) result.command = args.shift();
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    result[key] = value;
    i += 1;
  }
  return result;
}

function usage() {
  console.log(`ZORYQ Autonomous Company reference CLI

Usage:
  node autonomous/cli.mjs plan \\
    --goal "Ship a verifiable developer demo" \\
    --budget 10 \\
    --controller 0x1111111111111111111111111111111111111111 \\
    --autonomy supervised \\
    --out ./autonomous-output

  node autonomous/cli.mjs simulate [same options]

Notes:
- plan proves bounded company/task/policy generation only.
- simulate executes policy checks locally and produces a simulation Proof Pack.
- neither command submits a transaction or claims payment/revenue/outcome success.
`);
}

function writeJson(directory, name, data) {
  fs.writeFileSync(path.join(directory, name), `${JSON.stringify(data, null, 2)}\n`);
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  usage();
  process.exit(2);
}

if (options.help || options.command === 'help') {
  usage();
  process.exit(0);
}

if (!['plan', 'simulate'].includes(options.command)) {
  console.error(`ERROR: command must be plan or simulate, got ${options.command}`);
  usage();
  process.exit(2);
}

const required = ['goal', 'budget', 'controller'];
for (const key of required) {
  if (!options[key]) {
    console.error(`ERROR: --${key} is required`);
    usage();
    process.exit(2);
  }
}

const out = path.resolve(options.out ?? './autonomous-output');
fs.mkdirSync(out, { recursive: true });

try {
  const bundle = createCompanyPlan({
    goal: options.goal,
    budget: options.budget,
    controller: options.controller,
    autonomy: options.autonomy ?? 'supervised',
    now: options.now ?? new Date().toISOString(),
    successCriteria: options.criterion ? [options.criterion] : undefined
  });

  writeJson(out, 'company.json', bundle.company);
  writeJson(out, 'execution-plan.json', bundle.executionPlan);

  const manifest = {
    version: '0.1',
    generatedAt: bundle.executionPlan.generatedAt,
    companyId: bundle.company.companyId,
    command: options.command,
    outputs: ['company.json', 'execution-plan.json'],
    claimBoundary: 'Reference planning is local and bounded. No onchain execution is implied.'
  };

  if (options.command === 'simulate') {
    const simulation = simulateCompany(bundle, options.now ?? bundle.executionPlan.generatedAt);
    const verification = verifyProofPack(simulation.proofPack);
    if (!verification.valid) throw new Error(`generated proof pack failed verification: ${verification.errors.join('; ')}`);
    writeJson(out, 'simulation-intents.json', simulation.simulationIntents);
    writeJson(out, 'authorization-decisions.json', simulation.authorizations);
    writeJson(out, 'proof-pack.json', simulation.proofPack);
    manifest.outputs.push('simulation-intents.json', 'authorization-decisions.json', 'proof-pack.json');
    manifest.claimBoundary = 'Simulation policy checks passed locally. No transaction was submitted and evidence-backed goal progress remains 0%.';
  }

  writeJson(out, 'manifest.json', manifest);
  console.log(`ZORYQ Autonomous ${options.command.toUpperCase()} complete`);
  console.log(`companyId=${bundle.company.companyId}`);
  console.log(`goalHash=${bundle.company.goal.goalHash}`);
  console.log(`output=${out}`);
  console.log(manifest.claimBoundary);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
