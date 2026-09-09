export type GuardRisk = 'low' | 'medium' | 'high' | 'blocked';

export type GuardFinding = {
  code: string;
  title: string;
  detail: string;
  severity: GuardRisk;
};

export type GuardReport = {
  score: number;
  risk: GuardRisk;
  headline: string;
  findings: GuardFinding[];
  simulation: 'preview' | 'success' | 'failed';
};

const suspiciousMarkers = ['0000', 'dead', 'scam', 'phish'];

/** Local preview only. Production Guard must use server-side simulation and risk data. */
export async function analyzeTarget(target: string): Promise<GuardReport> {
  const normalized = target.trim().toLowerCase();
  if (!normalized) {
    return {
      score: 0,
      risk: 'blocked',
      headline: 'Informe um endereço, contrato ou domínio antes de continuar.',
      simulation: 'preview',
      findings: [{code:'EMPTY',title:'Destino ausente',detail:'Nenhuma análise pode ser executada sem um alvo.',severity:'blocked'}],
    };
  }

  const suspicious = suspiciousMarkers.some((marker) => normalized.includes(marker));
  const looksLikeEvm = /^0x[a-f0-9]{40}$/.test(normalized);
  const looksLikeName = /^[a-z0-9._-]{3,64}$/.test(normalized);

  if (suspicious) {
    return {
      score: 18,
      risk: 'high',
      headline: 'KYVO Guard encontrou sinais que exigem revisão manual.',
      simulation: 'preview',
      findings: [
        {code:'SUSPICIOUS_MARKER',title:'Padrão incomum',detail:'O identificador contém um padrão usado pelo modo de demonstração para representar risco.',severity:'high'},
        {code:'NO_CHAIN_SIM',title:'Simulação on-chain pendente',detail:'Ative o Guard backend antes de usar esta classificação com dinheiro real.',severity:'medium'},
      ],
    };
  }

  const score = looksLikeEvm ? 88 : looksLikeName ? 82 : 70;
  return {
    score,
    risk: score >= 85 ? 'low' : 'medium',
    headline: score >= 85 ? 'Nenhum alerta crítico no pré-check local.' : 'Formato aceito; confirme a rede e simule antes de assinar.',
    simulation: 'preview',
    findings: [
      {code:'FORMAT',title:'Formato analisado',detail:looksLikeEvm?'Endereço EVM com formato válido.':'Identificador aceito pelo pré-check.',severity:'low'},
      {code:'SIMULATION_REQUIRED',title:'Simulação obrigatória',detail:'A produção deve confirmar mudanças de saldo, approvals e chamadas internas antes da assinatura.',severity:'medium'},
      {code:'NO_SECRET_EXPOSURE',title:'Chaves protegidas',detail:'KYVO Guard não precisa receber seed phrase nem chave privada para analisar a transação.',severity:'low'},
    ],
  };
}
