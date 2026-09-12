import fs from 'node:fs';
import path from 'node:path';

const STORE_VERSION = 1;

function validateRecord(record) {
  if (record?.v !== STORE_VERSION || record?.type !== 'heartbeat-accept') throw new Error('Invalid heartbeat store record');
  if (!record.nonce || typeof record.nonce !== 'string') throw new Error('Heartbeat store requires nonce');
  if (!/^[0-9a-f]{64}$/.test(record.nodeId || '')) throw new Error('Heartbeat store requires valid nodeId');
  if (!Number.isInteger(record.blockSeen) || record.blockSeen < 0) throw new Error('Heartbeat store requires valid blockSeen');
  if (record.chainId !== 5919065) throw new Error('Heartbeat store wrong chain');
  if (record.protocolVersion !== 1) throw new Error('Heartbeat store unsupported protocol version');
  if (!record.acceptedAt || Number.isNaN(Date.parse(record.acceptedAt))) throw new Error('Heartbeat store requires timestamp');
  if (record.xpAwarded !== 0) throw new Error('Heartbeat must never award XP');
}

export class MemoryHeartbeatStore {
  constructor() { this.nonces = new Set(); this.records = []; }
  hasNonce(nonce) { return this.nonces.has(nonce); }
  append(record) {
    validateRecord(record);
    if (this.nonces.has(record.nonce)) return false;
    this.nonces.add(record.nonce);
    this.records.push(Object.freeze({ ...record }));
    return true;
  }
}

export class FileHeartbeatStore extends MemoryHeartbeatStore {
  constructor(filePath) {
    super();
    if (!filePath) throw new Error('Heartbeat store file path is required');
    this.filePath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    if (fs.existsSync(this.filePath)) this.#load();
  }
  #load() {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    if (!raw) return;
    const lines = raw.split('\n');
    if (lines.at(-1) === '') lines.pop();
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].trim()) throw new Error(`Corrupt heartbeat store at line ${i + 1}`);
      let record;
      try { record = JSON.parse(lines[i]); validateRecord(record); }
      catch (error) { throw new Error(`Corrupt heartbeat store at line ${i + 1}: ${error.message}`); }
      if (!super.append(record)) throw new Error(`Duplicate heartbeat nonce in store: ${record.nonce}`);
    }
  }
  append(record) {
    validateRecord(record);
    if (this.nonces.has(record.nonce)) return false;
    const fd = fs.openSync(this.filePath, 'a', 0o600);
    try { fs.writeFileSync(fd, `${JSON.stringify(record)}\n`, 'utf8'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    return super.append(record);
  }
}

export function heartbeatRecord({ nonce, nodeId, blockSeen, acceptedAt }) {
  const record = { v: STORE_VERSION, type: 'heartbeat-accept', nonce, nodeId, blockSeen, chainId: 5919065, protocolVersion: 1, acceptedAt, xpAwarded: 0 };
  validateRecord(record);
  return record;
}
