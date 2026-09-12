import ZoryqMobileNode, { type MobileNodeStatus } from './ZoryqMobileNodeModule';

type JsonObject = Record<string, unknown>;

export type XpResult = {
  accepted: true;
  protocolVersion: number;
  replayProtected: true;
  serverVerified: true;
  nodeId: string;
  xpAwarded: number;
  xpBalance: number;
  bestBlock: number;
  checkpoint: string;
  consumedNonce: string;
  verifiedAt: string;
};

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error('Mobile Node API requires HTTPS');
  }
  return url.toString().replace(/\/$/, '');
}

async function parseJson(response: Response): Promise<JsonObject> {
  const body = (await response.json()) as JsonObject;
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export class MobileNodeApiClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  private async post(path: string, body: JsonObject): Promise<JsonObject> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return parseJson(response);
  }

  async health(): Promise<JsonObject> {
    const response = await fetch(`${this.baseUrl}/health`, {
      headers: { accept: 'application/json' },
    });
    return parseJson(response);
  }

  async register(): Promise<{ nodeId: string; registeredAt: string }> {
    const identity = await ZoryqMobileNode.getNodeIdentity();
    const challengeResponse = await this.post('/v1/registration/challenge', { nodeId: identity.nodeId });
    const challenge = challengeResponse.challenge;
    if (typeof challenge !== 'string') throw new Error('Registration challenge missing');

    const signatureBase64 = await ZoryqMobileNode.signRegistrationChallenge(challenge);
    const registrationResponse = await this.post('/v1/registration', {
      challenge,
      nodeId: identity.nodeId,
      publicKeyBase64: identity.publicKeyBase64,
      signatureBase64,
    });
    const registered = registrationResponse.registered as JsonObject | undefined;
    if (!registered || registered.nodeId !== identity.nodeId || typeof registered.registeredAt !== 'string') {
      throw new Error('Registration response does not match Node Identity');
    }
    return { nodeId: identity.nodeId, registeredAt: registered.registeredAt };
  }

  async getXp(nodeId?: string): Promise<number> {
    const identity = nodeId ? null : await ZoryqMobileNode.getNodeIdentity();
    const target = nodeId ?? identity!.nodeId;
    const response = await fetch(`${this.baseUrl}/v1/xp/${encodeURIComponent(target)}`, {
      headers: { accept: 'application/json' },
    });
    const body = await parseJson(response);
    if (!Number.isInteger(body.xp) || (body.xp as number) < 0) throw new Error('Invalid XP response');
    return body.xp as number;
  }

  async submitCurrentWitness(status?: MobileNodeStatus): Promise<XpResult> {
    const observed = status ?? (await ZoryqMobileNode.getStatus());
    const identity = await ZoryqMobileNode.getNodeIdentity();

    if (!observed.independentRpcAgreement) throw new Error('Independent RPC agreement is required before proof submission');
    if (!Number.isInteger(observed.lastBlock) || observed.lastBlock < 0) throw new Error('No valid observed block is available');
    if (!observed.lastCheckpoint) throw new Error('No verified checkpoint is available');
    if (!Number.isInteger(observed.rpcAgreementVotes) || observed.rpcAgreementVotes < 2) {
      throw new Error('At least two independent RPC votes are required');
    }

    const challengeResponse = await this.post('/v1/proof/challenge', { nodeId: identity.nodeId });
    const challenge = challengeResponse.challenge;
    if (typeof challenge !== 'string') throw new Error('Proof challenge missing');

    const witness = {
      ok: true,
      bestBlock: observed.lastBlock,
      agreement: {
        checkpoint: observed.lastCheckpoint,
        votes: observed.rpcAgreementVotes,
      },
    };
    const signatureBase64 = await ZoryqMobileNode.signProof(
      challenge,
      identity.nodeId,
      witness.bestBlock,
      witness.agreement.checkpoint,
      witness.agreement.votes,
    );
    const response = await this.post('/v1/proof', {
      challenge,
      nodeId: identity.nodeId,
      witness,
      signatureBase64,
    });
    const result = response.result as XpResult | undefined;
    if (!result || result.accepted !== true || result.nodeId !== identity.nodeId || result.serverVerified !== true) {
      throw new Error('Proof response is not server-verified for this Node Identity');
    }
    return result;
  }
}
