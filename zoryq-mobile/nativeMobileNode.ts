import {NativeModules,Platform} from 'react-native';

export type NativeNodeMode='ECO'|'BALANCED'|'MAX_CONTRIBUTION'|'PAUSED';
export type NativeNodeStatus={
 running:boolean;
 paused:boolean;
 resumeRequired:boolean;
 nodeId:string;
 state:string;
 mode:string;
 lastBlock:number;
 lastBlockHash:string;
 lastCheck:string;
 proofStatus:string;
 lastXpAwarded:number;
 totalXp:number;
 lastXpEventId:string;
 lastVerifiedProofHash:string;
 heartbeatStatus:string;
 lastHeartbeatAt:string;
 lastHeartbeatXp:number;
 wifiOnly:boolean;
 chargingOnly:boolean;
 allowMobileData:boolean;
 batteryMinimum:number;
 mobileDataBytesToday:number;
 dailyMobileDataLimitBytes:number;
};

type NativeApi={
 start:()=>Promise<boolean>;
 pause:()=>Promise<boolean>;
 stop:()=>Promise<boolean>;
 status:()=>Promise<NativeNodeStatus>;
 setMode:(mode:NativeNodeMode)=>Promise<string>;
 configure:(wifiOnly:boolean,chargingOnly:boolean,allowMobileData:boolean,batteryMinimum:number,dailyMobileDataLimitMb:number)=>Promise<boolean>;
};

const api:NativeApi|undefined=NativeModules.ZoryqMobileNode;

export function nativeMobileNodeAvailable(){return Platform.OS==='android'&&!!api}
export async function startNativeMobileNode(){if(!api)throw Error('ZORYQ native Mobile Node is unavailable in this build');return api.start()}
export async function pauseNativeMobileNode(){if(!api)throw Error('ZORYQ native Mobile Node is unavailable in this build');return api.pause()}
export async function stopNativeMobileNode(){if(!api)throw Error('ZORYQ native Mobile Node is unavailable in this build');return api.stop()}
export async function getNativeMobileNodeStatus(){if(!api)throw Error('ZORYQ native Mobile Node is unavailable in this build');return api.status()}
export async function setNativeMobileNodeMode(mode:NativeNodeMode){if(!api)throw Error('ZORYQ native Mobile Node is unavailable in this build');return api.setMode(mode)}
export async function configureNativeMobileNode(options:{wifiOnly:boolean;chargingOnly:boolean;allowMobileData:boolean;batteryMinimum:number;dailyMobileDataLimitMb:number}){
 if(!api)throw Error('ZORYQ native Mobile Node is unavailable in this build');
 return api.configure(options.wifiOnly,options.chargingOnly,options.allowMobileData,options.batteryMinimum,options.dailyMobileDataLimitMb);
}
