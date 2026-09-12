import {
  createIntentEnvelope,
  authorizeIntent,
  recordExecution,
  verifyOutcome,
  ObepLedger,
  exportProofPack,
} from './obep.mjs';

const executor = '0x1111111111111111111111111111111111111111';
const verifier = '0x2222222222222222222222222222222222222222';
const treasury = '0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33';

const intent = createIntentEnvelope({
  companyId: 'company:public-proof:001',
  goal: 'Produce a deterministic verifiable result',
  task: { type: 'DETERMINISTIC_FIXTURE', input: { a: 2, b: 3 }, expected: 5 },
  executor,
  verifier,
  treasury,
  budget: '1990000',
  chainId: 5919065,
  nonce: 'public-proof-1',
  validFrom: 100,
  validUntil: 1000,
  policy: { maxPayment: '1990000', asset: 'USDC_TEST', capability: 'DETERMINISTIC_FIXTURE' },
});

const authorization = authorizeIntent(intent, { authorizer: treasury, issuedAt: 110 });
const execution = recordExecution(intent, authorization, {
  executor,
  output: { result: 5, method: '2+3' },
  startedAt: 120,
  completedAt: 130,
});
const outcome = verifyOutcome(intent, execution, {
  verifier,
  accepted: execution.output.result === 5,
  reason: 'deterministic expected value matched',
  verifiedAt: 140,
});
const ledger = new ObepLedger();
ledger.register(intent);
const receipt = ledger.settle(intent, authorization, execution, outcome, {
  txHash: '0x' + 'ab'.repeat(32),
  from: treasury,
  to: executor,
  amount: '1990000',
  chainId: 5919065,
  status: 'SUCCESS',
});
const accounting = ledger.reconcile(intent, receipt);
const pack = exportProofPack({ intent, authorization, execution, outcome, receipt, accounting });
process.stdout.write(JSON.stringify(pack, null, 2) + '\n');
