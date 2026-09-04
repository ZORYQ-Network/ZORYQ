export type IntentPlan = {
  intent: string;
  summary: string;
  steps: string[];
  guardRequired: boolean;
  execution: 'preview' | 'backend-required';
};

export async function planIntent(intent: string): Promise<IntentPlan> {
  const clean = intent.trim();
  if (!clean) return {intent:'',summary:'Descreva o resultado que você quer obter.',steps:[],guardRequired:true,execution:'preview'};
  const lower = clean.toLowerCase();
  const steps: string[] = ['Entender ativo, valor e destino desejado'];
  if (lower.includes('enviar') || lower.includes('send')) steps.push('Resolver KYVO ID/endereço e rede de destino');
  if (lower.includes('sol') || lower.includes('ethereum') || lower.includes('usdc') || lower.includes('eth')) steps.push('Comparar redes, liquidez, bridge e swap necessários');
  steps.push('Comparar custo total, tempo e impacto de preço');
  steps.push('Executar KYVO Guard e simular a transação');
  steps.push('Exibir resultado final, taxa KYVO e pedir assinatura');
  return {
    intent: clean,
    summary: 'KYVO ONE transformará a intenção em uma rota executável, mas a execução real depende do backend de routing e da wallet segura.',
    steps,
    guardRequired: true,
    execution: 'backend-required',
  };
}
