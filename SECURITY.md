# Security Policy

## Reporting a vulnerability
Não publique vulnerabilidades de wallet, auth, swap, treasury, signing ou dados sensíveis em issue pública.

Enquanto um canal dedicado de security reporting não estiver configurado, use os recursos privados de segurança do GitHub do repositório quando disponíveis e limite detalhes públicos.

## Scope crítico
- wallet/key management;
- transaction construction/signing;
- auth/session;
- swap/bridge routing;
- XP/airdrop integrity;
- treasury/fees;
- API authorization;
- CI/CD secrets.

## Never request
A equipe KYVO nunca deve solicitar seed phrase ou private key de usuário para suporte.

## Standards
O baseline mobile acompanha OWASP MASVS/MASTG e práticas de segurança do ecossistema Expo/React Native. Mainnet exige assessment adicional.