import { requireNativeModule } from 'expo-modules-core';

export type NodeMode = 'ECO' | 'BALANCED' | 'MAX_CONTRIBUTION' | 'PAUSED';

export type MobileNodeStatus = {
  running: boolean;
  state: string;
  nodeId?: string | null;
  nodeKeyHardwareBacked: boolean;
  lastBlock: number;
  lastHash?: string | null;
  lastCheck?: string | null;
  lastCheckpoint?: string | null;
  rpcHealthyCount: number;
  rpcAgreementVotes: number;
  independentRpcAgreement: boolean;
  resourceDecision?: string | null;
  mode: NodeMode;
  minBatteryPct: number;
  chargingOnly: boolean;
  wifiOnly: boolean;
  mobileDataAllowed: boolean;
  lastLocalProofXp: number;
};

export type MobileNodeIdentity = {
  nodeId: string;
  publicKeyBase64: string;
  hardwareBacked: boolean;
  algorithm: string;
  walletKeyReused: false;
};

type NativeModule = {
  start(): Promise<MobileNodeStatus>;
  pause(): Promise<MobileNodeStatus>;
  stop(): Promise<MobileNodeStatus>;
  getStatus(): Promise<MobileNodeStatus>;
  getNodeIdentity(): Promise<MobileNodeIdentity>;
  signRegistrationChallenge(challenge: string): Promise<string>;
  signProof(challenge: string, nodeId: string, bestBlock: number, checkpoint: string, votes: number): Promise<string>;
  setPolicy(mode: NodeMode, minBatteryPct: number, chargingOnly: boolean, wifiOnly: boolean, mobileDataAllowed: boolean): Promise<MobileNodeStatus>;
};

export default requireNativeModule<NativeModule>('ZoryqMobileNode');
