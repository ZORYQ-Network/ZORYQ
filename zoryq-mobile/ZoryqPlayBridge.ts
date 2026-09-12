import {NativeModules,Platform} from 'react-native';

export type ZoryqGameId='rush-city'|'realm-rivals'|'battle-zone-heroes'|'wallet-quest'|'tycoon-world';
export type ZoryqRushRunMode='standard'|'daily'|'ghost';

export type ZoryqPlayRunResult={
 version:'zoryq.play.run.v1';
 gameId:ZoryqGameId;
 sessionId:string;
 score:number;
 zqCollected:number;
 distanceMeters:number;
 durationSeconds:number;
 integrity:'client-untrusted'|'server-verified';
};

type NativeGameBridge={
 isAvailable?:(gameId:string)=>Promise<boolean>;
 launch?:(gameId:string,payload:string)=>Promise<string|null>;
};

const bridge:NativeGameBridge|undefined=NativeModules.ZoryqGameBridge;

export async function isNativeGameEngineAvailable(gameId:ZoryqGameId='rush-city'){
 if(Platform.OS!=='android'||!bridge?.launch)return false;
 try{return bridge.isAvailable?await bridge.isAvailable(gameId):true}catch{return false}
}

/**
 * Launches a native game runtime with a deliberately narrow payload.
 * Never place private keys, seed phrases, wallet balances or spend permissions here.
 */
export async function launchZoryqGame(
 gameId:ZoryqGameId,
 profile:{playerId:string;displayName?:string},
 options?:{mode?:ZoryqRushRunMode}
){
 if(!bridge?.launch)throw new Error('zoryq_game_engine_unavailable');
 const safePayload=JSON.stringify({
  version:'zoryq.play.launch.v1',
  gameId,
  playerId:profile.playerId,
  displayName:profile.displayName||'',
  mode:gameId==='rush-city'?(options?.mode||'standard'):'standard'
 });
 const raw=await bridge.launch(gameId,safePayload);
 if(!raw)return null;
 let parsed:unknown;
 try{parsed=JSON.parse(raw)}catch{throw new Error('zoryq_game_result_invalid_json')}
 if(!validateClientRunShape(parsed))throw new Error('zoryq_game_result_invalid_shape');
 return parsed;
}

export function validateClientRunShape(value:unknown):value is ZoryqPlayRunResult{
 if(!value||typeof value!=='object')return false;
 const r=value as Partial<ZoryqPlayRunResult>;
 return r.version==='zoryq.play.run.v1'&&
  typeof r.gameId==='string'&&
  typeof r.sessionId==='string'&&r.sessionId.length>=8&&
  typeof r.score==='number'&&Number.isFinite(r.score)&&r.score>=0&&
  typeof r.zqCollected==='number'&&Number.isFinite(r.zqCollected)&&r.zqCollected>=0&&
  typeof r.distanceMeters==='number'&&Number.isFinite(r.distanceMeters)&&r.distanceMeters>=0&&
  typeof r.durationSeconds==='number'&&Number.isFinite(r.durationSeconds)&&r.durationSeconds>=0&&
  (r.integrity==='client-untrusted'||r.integrity==='server-verified');
}
