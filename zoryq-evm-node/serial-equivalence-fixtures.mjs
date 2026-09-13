import crypto from 'node:crypto';

export const FIXTURE_VERSION = '1.0.0';

export const fixtures = Object.freeze([
  { id: 'independent-transfers', kind: 'transfer', txs: [
    { from: 'alice', to: 'bob', value: 11n },
    { from: 'carol', to: 'dave', value: 17n },
  ]},
  { id: 'same-sender-nonce-chain', kind: 'transfer', txs: [
    { from: 'alice', to: 'bob', value: 3n },
    { from: 'alice', to: 'carol', value: 5n },
    { from: 'alice', to: 'dave', value: 7n },
  ]},
  { id: 'hot-receiver', kind: 'transfer', txs: [
    { from: 'alice', to: 'hot', value: 2n },
    { from: 'bob', to: 'hot', value: 3n },
    { from: 'carol', to: 'hot', value: 5n },
  ]},
  { id: 'independent-storage', kind: 'storage', txs: [
    { actor: 'alice', slot: 'a', op: 'write', value: 11n },
    { actor: 'bob', slot: 'b', op: 'write', value: 13n },
  ]},
  { id: 'same-slot-write-write', kind: 'storage', txs: [
    { actor: 'alice', slot: 'shared', op: 'write', value: 19n },
    { actor: 'bob', slot: 'shared', op: 'write', value: 23n },
  ]},
  { id: 'read-after-write', kind: 'storage', txs: [
    { actor: 'alice', slot: 'shared', op: 'write', value: 29n },
    { actor: 'bob', slot: 'shared', op: 'read' },
  ]},
  { id: 'write-after-read', kind: 'storage', txs: [
    { actor: 'alice', slot: 'shared', op: 'read' },
    { actor: 'bob', slot: 'shared', op: 'write', value: 31n },
  ]},
  { id: 'revert-mixed', kind: 'storage', txs: [
    { actor: 'alice', slot: 'x', op: 'write', value: 37n },
    { actor: 'bob', slot: 'x', op: 'revert-write', value: 41n },
    { actor: 'carol', slot: 'y', op: 'write', value: 43n },
  ]},
]);

const json = (value) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
export const fixtureDigest = crypto.createHash('sha256').update(json(fixtures)).digest('hex');
export const stableJson = json;
