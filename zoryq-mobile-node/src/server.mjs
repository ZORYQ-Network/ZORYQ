import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RegistrationEngine } from './registration-engine.js';
import { FileRegistrationStore } from './registration-store.js';
import { ProofEngine } from './proof-engine.js';
import { FileXpLedger } from './xp-ledger.js';
import { createMobileNodeApi } from './api-server.js';
import { witnessRound } from './witness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.PORT || '8080', 10);
const dataDir = path.resolve(process.env.ZORYQ_MOBILE_NODE_DATA_DIR || '/data/mobile-node');
const registrationSecret = process.env.ZORYQ_MOBILE_NODE_REGISTRATION_SECRET || '';
const proofSecret = process.env.ZORYQ_MOBILE_NODE_PROOF_SECRET || '';
const rpcEndpoints = [...new Set((process.env.ZORYQ_MOBILE_NODE_RPC_ENDPOINTS || '').split(',').map(v => v.trim()).filter(Boolean))];

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
if (registrationSecret.length < 32) throw new Error('ZORYQ_MOBILE_NODE_REGISTRATION_SECRET must be at least 32 characters');
if (proofSecret.length < 32) throw new Error('ZORYQ_MOBILE_NODE_PROOF_SECRET must be at least 32 characters');
if (rpcEndpoints.length < 2) throw new Error('At least two unique server RPC endpoints are required before XP service can start');
for (const endpoint of rpcEndpoints) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error(`RPC endpoint must use HTTPS: ${endpoint}`);
  }
}

const registrationStore = new FileRegistrationStore(path.join(dataDir, 'registrations.jsonl'));
const xpLedger = new FileXpLedger(path.join(dataDir, 'xp-ledger.jsonl'));
const registrationEngine = new RegistrationEngine({ secret: registrationSecret, store: registrationStore });

async function verifyWitnessServerSide({ witness }) {
  const round = await witnessRound(rpcEndpoints);
  if (!round.independentAgreement || !round.agreement) return false;
  return round.bestBlock === witness.bestBlock
    && round.agreement.checkpoint === witness.agreement.checkpoint
    && round.agreement.votes >= 2;
}

const proofEngine = new ProofEngine({
  secret: proofSecret,
  ledger: xpLedger,
  verifyWitness: verifyWitnessServerSide,
});

const server = createMobileNodeApi({ registrationEngine, proofEngine });
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({
    event: 'zoryq-mobile-node-api-started',
    port,
    chainId: 5919065,
    rpcEndpointCount: rpcEndpoints.length,
    dataDir,
    pid: process.pid,
    cwd: process.cwd(),
    source: here,
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ event: 'shutdown', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
