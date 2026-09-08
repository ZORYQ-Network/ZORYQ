(()=>{
  if(!window.ZORYQI18N)return;
  const lang=ZORYQI18N.language();
  const path=location.pathname.replace(/\.html$/,'');
  const T={
    'Connect wallet':['Conectar carteira','Conectar billetera','Connecter le portefeuille','Wallet verbinden','连接钱包','ウォレット接続','지갑 연결'],
    'Explorer':['Explorador','Explorador','Explorateur','Explorer','浏览器','エクスプローラー','익스플로러'],
    'Wallet balance':['Saldo da carteira','Saldo de la billetera','Solde du portefeuille','Wallet-Guthaben','钱包余额','ウォレット残高','지갑 잔액'],
    'Network':['Rede','Red','Réseau','Netzwerk','网络','ネットワーク','네트워크'],
    'Contract':['Contrato','Contrato','Contrat','Vertrag','合约','コントラクト','컨트랙트'],
    'LIVE TESTNET AMM':['AMM DA TESTNET AO VIVO','AMM DE TESTNET EN VIVO','AMM TESTNET EN DIRECT','LIVE TESTNET-AMM','实时测试网 AMM','ライブ・テストネット AMM','라이브 테스트넷 AMM'],
    'LP fee':['Taxa do LP','Comisión LP','Frais LP','LP-Gebühr','LP 费用','LP手数料','LP 수수료'],
    'Treasury fee':['Taxa da Treasury','Comisión Treasury','Frais Treasury','Treasury-Gebühr','Treasury 费用','Treasury手数料','Treasury 수수료'],
    'Minimum received':['Mínimo recebido','Mínimo recibido','Minimum reçu','Mindestens erhalten','最少收到','最小受取額','최소 수령량'],
    'Live protocol':['Protocolo ao vivo','Protocolo en vivo','Protocole en direct','Live-Protokoll','实时协议','ライブプロトコル','라이브 프로토콜'],
    'ZQ reserve':['Reserva ZQ','Reserva ZQ','Réserve ZQ','ZQ-Reserve','ZQ 储备','ZQリザーブ','ZQ 준비금'],
    'zUSD reserve':['Reserva zUSD','Reserva zUSD','Réserve zUSD','zUSD-Reserve','zUSD 储备','zUSDリザーブ','zUSD 준비금'],
    'Stake ZQ.':['Faça stake de ZQ.','Haz stake de ZQ.','Stakez ZQ.','ZQ staken.','质押 ZQ。','ZQをステーク。','ZQ 스테이킹.'],
    'Staked position':['Posição em stake','Posición en stake','Position stakée','Staking-Position','质押仓位','ステーク残高','스테이킹 포지션'],
    'Position age':['Idade da posição','Antigüedad de la posición','Âge de la position','Positionsalter','仓位时间','ポジション期間','포지션 기간'],
    'Position details':['Detalhes da posição','Detalles de la posición','Détails de la position','Positionsdetails','仓位详情','ポジション詳細','포지션 상세'],
    'Security':['Segurança','Seguridad','Sécurité','Sicherheit','安全','セキュリティ','보안'],
    'Borrow. Supply. Build credit rails.':['Empreste. Forneça liquidez. Construa trilhos de crédito.','Pide prestado. Aporta liquidez. Construye rieles de crédito.','Empruntez. Fournissez. Construisez des rails de crédit.','Leihen. Liquidität bereitstellen. Kredit-Rails bauen.','借贷。提供流动性。构建信用轨道。','借りる。供給する。信用レールを構築する。','대출. 유동성 공급. 신용 레일 구축.'],
    'ZQ collateral':['Colateral ZQ','Colateral ZQ','Collatéral ZQ','ZQ-Sicherheit','ZQ 抵押品','ZQ担保','ZQ 담보'],
    'zUSD debt':['Dívida zUSD','Deuda zUSD','Dette zUSD','zUSD-Schuld','zUSD 债务','zUSD負債','zUSD 부채'],
    'Borrow available':['Empréstimo disponível','Préstamo disponible','Emprunt disponible','Verfügbarer Kredit','可借额度','借入可能額','대출 가능액'],
    'Deposit ZQ collateral':['Depositar colateral ZQ','Depositar colateral ZQ','Déposer du collatéral ZQ','ZQ-Sicherheit einzahlen','存入 ZQ 抵押品','ZQ担保を預ける','ZQ 담보 예치'],
    'Borrow zUSD':['Tomar zUSD emprestado','Pedir zUSD prestado','Emprunter zUSD','zUSD leihen','借入 zUSD','zUSDを借りる','zUSD 대출'],
    'Repay zUSD':['Pagar zUSD','Reembolsar zUSD','Rembourser zUSD','zUSD zurückzahlen','偿还 zUSD','zUSDを返済','zUSD 상환'],
    'Supply zUSD liquidity':['Fornecer liquidez zUSD','Aportar liquidez zUSD','Fournir de la liquidité zUSD','zUSD-Liquidität bereitstellen','提供 zUSD 流动性','zUSD流動性を供給','zUSD 유동성 공급'],
    'Risk model v1':['Modelo de risco v1','Modelo de riesgo v1','Modèle de risque v1','Risikomodell v1','风险模型 v1','リスクモデル v1','리스크 모델 v1']
  };
  const idx={'pt-BR':0,es:1,fr:2,de:3,'zh-CN':4,ja:5,ko:6}[lang];
  function tr(s){return idx===undefined?s:(T[s]?.[idx]||s)}
  function walk(){const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);for(const n of nodes){const raw=n.nodeValue,trim=raw.trim();if(!trim)continue;const out=tr(trim);if(out!==trim)n.nodeValue=raw.replace(trim,out)}}
  function liveFix(){if(path!=='/lending')return;const status=document.getElementById('status');const state=document.getElementById('contractState');if(status&&/final activation|not yet deployed|deployment pending/i.test(status.textContent))status.textContent='ZORYQ Lending is deployed and live on the public testnet. Connect a wallet to read your position and transact.';if(state)state.innerHTML='Contract: <a target="_blank" href="/address/0xA08d491c06a2B01bbe6866CA87302c794aD9fB77">0xA08d…fB77</a> · LIVE';}
  function mount(){const header=document.querySelector('header.nav');if(header&&!header.querySelector('.zoryq-language-select')){const host=document.createElement('span');host.style.marginLeft='8px';ZORYQI18N.mountSelector(host);header.appendChild(host)}liveFix();walk()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
