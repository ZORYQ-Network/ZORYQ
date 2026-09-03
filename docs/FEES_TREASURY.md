# Taxas, Receita e Treasury

## Objetivo
Permitir monetização sustentável sem custódia dos fundos do usuário e com transparência total.

## Fontes potenciais
- integrator/app fee em swaps;
- referral/revenue share de bridges/DEXs/perps;
- plano Premium;
- marketplace/itens digitais futuros;
- serviços B2B/SDK futuros.

## Regras
- fee exibida antes da assinatura;
- fee configurada server-side;
- nenhuma fee mascarada no preço;
- provider e KYVO fee separáveis na UI;
- logs financeiros reconciliáveis;
- alteração de fee exige versionamento/audit log.

## Treasury
Usar treasury(s) dedicada(s), preferencialmente multi-sig para produção. Separar:
- operating treasury;
- protocol/integrator revenue;
- grants/community quando existir;
- token treasury somente se token for lançado.

## Contabilidade
Registrar moeda, rede, tx hash, gross fee, provider share, net KYVO revenue e timestamp. Não armazenar secrets de treasury no app ou no repositório.

## XP e taxas
Descontos por nível/Premium podem existir, mas precisam de regras públicas e proteção anti-abuso.