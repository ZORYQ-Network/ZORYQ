import fs from 'node:fs';
import path from 'node:path';

const LEDGER_VERSION = 1;

function validateEvent(event) {
  if (event?.v !== LEDGER_VERSION || event?.type !== 'xp-credit') throw new Error('Invalid XP ledger event');
  if (!event.eventId || !event.nodeId) throw new Error('XP ledger event requires eventId and nodeId');
  if (!Number.isInteger(event.xp) || event.xp <= 0) throw new Error('XP ledger event requires positive integer XP');
  if (!Number.isInteger(event.bestBlock) || event.bestBlock < 0) throw new Error('XP ledger event requires valid bestBlock');
  if (!event.checkpoint || typeof event.checkpoint !== 'string') throw new Error('XP ledger event requires checkpoint');
  if (!event.at || Number.isNaN(Date.parse(event.at))) throw new Error('XP ledger event requires timestamp');
}

export class MemoryXpLedger {
  constructor() {
    this.events = [];
    this.eventIds = new Set();
    this.balances = new Map();
  }

  hasEvent(eventId) {
    return this.eventIds.has(eventId);
  }

  appendCredit(event) {
    validateEvent(event);
    if (this.eventIds.has(event.eventId)) return false;
    this.events.push(Object.freeze({ ...event }));
    this.eventIds.add(event.eventId);
    this.balances.set(event.nodeId, (this.balances.get(event.nodeId) || 0) + event.xp);
    return true;
  }

  getXp(nodeId) {
    return this.balances.get(nodeId) || 0;
  }
}

/**
 * Minimal single-process durable ledger for the Mobile Node MVP.
 *
 * Every accepted proof is one immutable JSONL record. Startup replays the file
 * and reconstructs consumed event IDs and balances. A malformed line fails
 * closed so replay state is never silently forgotten. Multi-replica production
 * needs a transactional database with a UNIQUE(eventId) constraint; this class
 * is intentionally not a distributed consensus store.
 */
export class FileXpLedger extends MemoryXpLedger {
  constructor(filePath) {
    super();
    if (!filePath) throw new Error('XP ledger file path is required');
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
      const line = lines[index];
      if (!line.trim()) throw new Error(`Corrupt XP ledger at line ${index + 1}`);
      let event;
      try {
        event = JSON.parse(line);
        validateEvent(event);
      } catch (error) {
        throw new Error(`Corrupt XP ledger at line ${index + 1}: ${error.message}`);
      }
      if (this.eventIds.has(event.eventId)) throw new Error(`Duplicate XP eventId in ledger: ${event.eventId}`);
      super.appendCredit(event);
    }
  }

  appendCredit(event) {
    validateEvent(event);
    if (this.eventIds.has(event.eventId)) return false;

    const line = `${JSON.stringify(event)}\n`;
    const fd = fs.openSync(this.filePath, 'a', 0o600);
    try {
      fs.writeFileSync(fd, line, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    return super.appendCredit(event);
  }
}

export function xpCreditEvent({ eventId, nodeId, xp, bestBlock, checkpoint, at }) {
  const event = {
    v: LEDGER_VERSION,
    type: 'xp-credit',
    eventId,
    nodeId,
    xp,
    bestBlock,
    checkpoint,
    at,
  };
  validateEvent(event);
  return event;
}
