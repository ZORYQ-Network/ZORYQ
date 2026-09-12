import fs from 'node:fs';
import path from 'node:path';

const STORE_VERSION = 1;

function validateRecord(record) {
  if (record?.v !== STORE_VERSION || record?.type !== 'node-registration') throw new Error('Invalid registration store record');
  if (!/^[0-9a-f]{64}$/.test(record.nodeId || '')) throw new Error('Registration store requires valid nodeId');
  if (!record.publicKeyBase64 || typeof record.publicKeyBase64 !== 'string') throw new Error('Registration store requires public key');
  if (!record.nonce || typeof record.nonce !== 'string') throw new Error('Registration store requires nonce');
  if (record.chainId !== 5919065) throw new Error('Registration store wrong chain');
  if (record.protocolVersion !== 1) throw new Error('Registration store unsupported protocol version');
  if (!record.registeredAt || Number.isNaN(Date.parse(record.registeredAt))) throw new Error('Registration store requires timestamp');
}

export class MemoryRegistrationStore {
  constructor() {
    this.byNode = new Map();
    this.nonces = new Set();
  }

  hasNonce(nonce) { return this.nonces.has(nonce); }
  get(nodeId) { return this.byNode.get(nodeId) || null; }

  append(record) {
    validateRecord(record);
    if (this.nonces.has(record.nonce)) return false;
    const existing = this.byNode.get(record.nodeId);
    if (existing && existing.publicKeyBase64 !== record.publicKeyBase64) throw new Error('Node ID already registered to another public key');
    this.nonces.add(record.nonce);
    this.byNode.set(record.nodeId, Object.freeze({ ...record }));
    return true;
  }
}

export class FileRegistrationStore extends MemoryRegistrationStore {
  constructor(filePath) {
    super();
    if (!filePath) throw new Error('Registration store file path is required');
    this.filePath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    if (fs.existsSync(this.filePath)) this.#load();
  }

  #load() {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    if (!raw) return;
    const lines = raw.split('\n');
    if (lines.at(-1) === '') lines.pop();
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].trim()) throw new Error(`Corrupt registration store at line ${index + 1}`);
      let record;
      try {
        record = JSON.parse(lines[index]);
        validateRecord(record);
      } catch (error) {
        throw new Error(`Corrupt registration store at line ${index + 1}: ${error.message}`);
      }
      if (!super.append(record)) throw new Error(`Duplicate registration nonce in store: ${record.nonce}`);
    }
  }

  append(record) {
    validateRecord(record);
    if (this.nonces.has(record.nonce)) return false;
    const existing = this.byNode.get(record.nodeId);
    if (existing && existing.publicKeyBase64 !== record.publicKeyBase64) throw new Error('Node ID already registered to another public key');
    const line = `${JSON.stringify(record)}\n`;
    const fd = fs.openSync(this.filePath, 'a', 0o600);
    try {
      fs.writeFileSync(fd, line, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return super.append(record);
  }
}

export function registrationRecord({ nodeId, publicKeyBase64, nonce, registeredAt }) {
  const record = {
    v: STORE_VERSION,
    type: 'node-registration',
    nodeId,
    publicKeyBase64,
    nonce,
    chainId: 5919065,
    protocolVersion: 1,
    registeredAt,
  };
  validateRecord(record);
  return record;
}
