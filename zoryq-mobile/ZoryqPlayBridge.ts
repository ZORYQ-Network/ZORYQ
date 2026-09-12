import {NativeModules,Platform} from 'react-native';

export type ZoryqPlayRunResult={
 version:'zoryq.play.run.v1';
 gameId:'rush-city'|'realm-rivals'|'battle-zone-heroes'|'wallet-quest'|'tycoon-world';
 sessionId:string;
 score:number;
 zqCollected:number;
 distanceMeters:number;
 durationSeconds:number;
 integrity:'client-untrusted'|'server-verified';
};

type NativeGameBridge={
 isAvailable?:()=>Promise<boolean>;
 launch?: (gameId:string,payload:string)=>Promise<ZoryqPlayRunResult|null>;
};

const bridge:NativeGameBridge|undefined=NativeModules.ZoryqGameBridge;

export async function isNativeGameEngineAvailable(){
 if(Platform.OS!=='android'||!bridge?.launch)return false;
 try{return bridge.isAvailable?await bridge.isAvailable():true}catch{return false}
}

/**
 * Launches a game runtime with a deliberately narrow payload. Never place private keys,
 * seed phrases or wallet spend permissions in this payload.
 */
export async function launchZoryqGame(gameId:ZoryqPlayRunResult['gameId'],profile:{playerId:string;displayName?:string}){
 if(!bridge?.launch)throw new Error('zoryq_game_engine_unavailable');
 const safePayload=JSON.stringify({version:'zoryq.play.launch.v1',gameId,playerId:profile.playerId,displayName:profile.displayName||''});
 return bridge.launch(gameId,safePayload);
}

export function validateClientRunShape(value:unknown):value is ZoryqPlayRunResult{
 if(!value||typeof value!=='object')return false;
 const r=value as Partial<ZoryqPlayRunResult>;
 return r.version==='zoryq.play.run.v1'&&typeof r.sessionId==='string'&&typeof r.score==='number'&&typeof r.zqCollected==='number'&&typeof r.durationSeconds==='number';
}
