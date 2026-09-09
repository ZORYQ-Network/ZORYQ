export type GenesisAction={action:string;points:number;verification:string;createdAt:number;txHash?:string|null};
export type GenesisStatus={ok:boolean;address:string;pendingScore:number;verifiedOnchainScore:number;verifiedExternalScore:number;socialPendingScore:number;finalizedOnchainScore:number;genesis:{completed:number;total:number;eligible:boolean;status:string};actions:GenesisAction[]};
export type LeaderboardEntry={rank:number;address:string;pendingScore:number;verifiedOnchainScore:number;finalizedOnchainScore:number;level:string;genesisEligible:boolean;actionCount:number};
export type LeaderboardResponse={ok:boolean;generatedAt:string;totalWallets:number;entries:LeaderboardEntry[];self?:LeaderboardEntry|null;disclosure?:string};

export function levelFor(score:number){
  if(score>=5000)return 'Vanguard';
  if(score>=2500)return 'Architect';
  if(score>=1200)return 'Operator';
  if(score>=600)return 'Builder';
  if(score>=250)return 'Pioneer';
  return 'Explorer';
}

export function nextLevel(score:number){
  const levels=[{name:'Pioneer',at:250},{name:'Builder',at:600},{name:'Operator',at:1200},{name:'Architect',at:2500},{name:'Vanguard',at:5000}];
  return levels.find(x=>score<x.at)||null;
}

export function compactScore(value:number){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(value||0))}
