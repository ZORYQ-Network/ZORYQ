(()=>{
  if(!window.ZORYQI18N)return;
  const lang=ZORYQI18N.language();
  const path=location.pathname.replace(/\.html$/,'');
  const common={
    'Connect wallet':{'pt-BR':'Conectar carteira','es':'Conectar billetera','fr':'Connecter le portefeuille','de':'Wallet verbinden','zh-CN':'连接钱包','ja':'ウォレット接続','ko':'지갑 연결'},
    'Explorer':{'pt-BR':'Explorador','es':'Explorador','fr':'Explorateur','de':'Explorer','zh-CN':'浏览器','ja':'エクスプローラー','ko':'익스플로러'},
    'Wallet balance':{'pt-BR':'Saldo da carteira','es':'Saldo de la billetera','fr':'Solde du portefeuille','de':'Wallet-Guthaben','zh-CN':'钱包余额','ja':'ウォレット残高','ko':'지갑 잔액'},
    'Network':{'pt-BR':'Rede','es':'Red','fr':'Réseau','de':'Netzwerk','zh-CN':'网络','ja':'ネットワーク','ko':'네트워크'},
    'Contract':{'pt-BR':'Contrato','es':'Contrato','fr':'Contrat','de':'Vertrag','zh-CN':'合约','ja':'コントラクト','ko':'컨트랙트'}
  };
  const pages={
    '/swap':{
      'LIVE TESTNET AMM':{'pt-BR':'AMM DA TESTNET AO VIVO','es':'AMM DE TESTNET EN VIVO','fr':'AMM TESTNET EN DIRECT','de':'LIVE TESTNET-AMM','zh-CN':'实时测试网 AMM','ja':'ライブ・テストネット AMM','ko':'라이브 테스트넷 AMM'},
      'ZORYQ DEX v1.':{'pt-BR':'ZORYQ DEX v1.','es':'ZORYQ DEX v1.','fr':'ZORYQ DEX v1.','de':'ZORYQ DEX v1.','zh-CN':'ZORYQ DEX v1.','ja':'ZORYQ DEX v1.','ko':'ZORYQ DEX v1.'},
      'Native ZQ / zUSD constant-product AMM. 0.30% total swap fee: 0.20% stays with LPs and 0.10% goes on-chain to the ZORYQ Treasury. Testnet assets have no monetary value.':{'pt-BR':'AMM nativo ZQ / zUSD de produto constante. Taxa total de swap de 0,30%: 0,20% fica com os LPs e 0,10% vai on-chain para a Treasury da ZORYQ. Ativos da testnet não possuem valor monetário.','es':'AMM nativo ZQ / zUSD de producto constante. Comisión total de swap de 0,30%: 0,20% para LPs y 0,10% on-chain para la Treasury de ZORYQ. Los activos de testnet no tienen valor monetario.','fr':'AMM natif ZQ / zUSD à produit constant. Frais totaux de swap de 0,30 % : 0,20 % aux LP et 0,10 % on-chain à la Treasury ZORYQ. Les actifs testnet n’ont aucune valeur monétaire.','de':'Natives ZQ/zUSD Constant-Product-AMM. Gesamt-Swap-Gebühr 0,30 %: 0,20 % für LPs und 0,10 % on-chain an die ZORYQ Treasury. Testnet-Assets haben keinen Geldwert.','zh-CN':'原生 ZQ / zUSD 恒定乘积 AMM。Swap 总费率 0.30%：0.20% 归 LP，0.10% 链上进入 ZORYQ Treasury。测试网资产无货币价值。','ja':'ネイティブ ZQ / zUSD 定積 AMM。Swap 手数料は合計0.30%で、0.20%はLP、0.10%はオンチェーンでZORYQ Treasuryへ。テストネット資産に金銭的価値はありません。','ko':'네이티브 ZQ / zUSD 상수곱 AMM. 총 스왑 수수료 0.30% 중 0.20%는 LP, 0.10%는 온체인으로 ZORYQ Treasury에 전달됩니다. 테스트넷 자산은 금전적 가치가 없습니다.'},
      'LP fee':{'pt-BR':'Taxa do LP','es':'Comisión LP','fr':'Frais LP','de':'LP-Gebühr','zh-CN':'LP 费用','ja':'LP手数料','ko':'LP 수수료'},
      'Treasury fee':{'pt-BR':'Taxa da Treasury','es':'Comisión Treasury','fr':'Frais Treasury','de':'Treasury-Gebühr','zh-CN':'Treasury 费用','ja':'Treasury手数料','ko':'Treasury 수수료'},
      'Minimum received':{'pt-BR':'Mínimo recebido','es':'Mínimo recibido','fr':'Minimum reçu','de':'Mindestens erhalten','zh-CN':'最少收到','ja':'最小受取額','ko':'최소 수령량'},
      'Slippage':{'pt-BR':'Slippage','es':'Deslizamiento','fr':'Slippage','de':'Slippage','zh-CN':'滑点','ja':'スリッページ','ko':'슬리피지'},
      'Live protocol':{'pt-BR':'Protocolo ao vivo','es':'Protocolo en vivo','fr':'Protocole en direct','de':'Live-Protokoll','zh-CN':'实时协议','ja':'ライブプロトコル','ko':'라이브 프로토콜'},
      'ZQ reserve':{'pt-BR':'Reserva ZQ','es':'Reserva ZQ','fr':'Réserve ZQ','de':'ZQ-Reserve','zh-CN':'ZQ 储备','ja':'ZQリザーブ','ko':'ZQ 준비금'},
      'zUSD reserve':{'pt-BR':'Reserva zUSD','es':'Reserva zUSD','fr':'Réserve zUSD','de':'zUSD-Reserve','zh-CN':'zUSD 储备','ja':'zUSDリザーブ','ko':'zUSD 준비금'},
      'LP supply':{'pt-BR':'Supply de LP','es':'Suministro LP','fr':'Offre LP','de':'LP-Angebot','zh-CN':'LP 供应量','ja':'LP供給量','ko':'LP 공급량'},
      'Review swap':{'pt-BR':'Revisar swap','es':'Revisar swap','fr':'Vérifier le swap','de':'Swap prüfen','zh-CN':'检查 Swap','ja':'Swapを確認','ko':'스왑 검토'}
    },
    '/stake':{
      'NATIVE ZORYQ TESTNET DAPP':{'pt-BR':'DAPP NATIVO DA TESTNET ZORYQ','es':'DAPP NATIVA DE ZORYQ TESTNET','fr':'DAPP NATIF ZORYQ TESTNET','de':'NATIVE ZORYQ TESTNET-DAPP','zh-CN':'ZORYQ 测试网原生 DAPP','ja':'ZORYQ テストネット・ネイティブ DAPP','ko':'ZORYQ 테스트넷 네이티브 DAPP'},
      'Stake ZQ.':{'pt-BR':'Faça stake de ZQ.','es':'Haz stake de ZQ.','fr':'Stakez ZQ.','de':'ZQ staken.','zh-CN':'质押 ZQ。','ja':'ZQをステーク。','ko':'ZQ 스테이킹.'},
      'Lock ZQ Testnet in the native Stake Vault, track your position, and unstake partially or fully. Testnet assets have no monetary value and staking does not represent guaranteed yield.':{'pt-BR':'Bloqueie ZQ Testnet no Stake Vault nativo, acompanhe sua posição e faça unstake parcial ou total. Ativos da testnet não possuem valor monetário e staking não representa rendimento garantido.','es':'Bloquea ZQ Testnet en el Stake Vault nativo, sigue tu posición y retira parcial o totalmente. Los activos de testnet no tienen valor monetario y el staking no garantiza rendimiento.','fr':'Verrouillez ZQ Testnet dans le Stake Vault natif, suivez votre position et retirez partiellement ou totalement. Les actifs testnet n’ont aucune valeur monétaire et le staking ne garantit aucun rendement.','de':'Sperre ZQ Testnet im nativen Stake Vault, verfolge deine Position und unstake teilweise oder vollständig. Testnet-Assets haben keinen Geldwert und Staking garantiert keine Rendite.','zh-CN':'在原生 Stake Vault 中锁定 ZQ Testnet，跟踪仓位，并可部分或全部解除质押。测试网资产无货币价值，质押不代表保证收益。','ja':'ネイティブ Stake Vault に ZQ Testnet をロックし、ポジションを追跡して一部または全額をアンステークできます。テストネット資産に金銭的価値はなく、ステーキングは利回りを保証しません。','ko':'네이티브 Stake Vault에 ZQ Testnet을 예치하고 포지션을 추적하며 일부 또는 전체 언스테이킹할 수 있습니다. 테스트넷 자산은 금전적 가치가 없고 수익을 보장하지 않습니다.'},
      'Staked position':{'pt-BR':'Posição em stake','es':'Posición en stake','fr':'Position stakée','de':'Staking-Position','zh-CN':'质押仓位','ja':'ステーク残高','ko':'스테이킹 포지션'},
      'Position age':{'pt-BR':'Idade da posição','es':'Antigüedad de la posición','fr':'Âge de la position','de':'Positionsalter','zh-CN':'仓位时间','ja':'ポジション期間','ko':'포지션 기간'},
      'Unstake':{'pt-BR':'Unstake','es':'Retirar stake','fr':'Unstake','de':'Unstake','zh-CN':'解除质押','ja':'アンステーク','ko':'언스테이크'},
      'Position details':{'pt-BR':'Detalhes da posição','es':'Detalles de la posición','fr':'Détails de la position','de':'Positionsdetails','zh-CN':'仓位详情','ja':'ポジション詳細','ko':'포지션 상세'},
      'Security':{'pt-BR':'Segurança','es':'Seguridad','fr':'Sécurité','de':'Sicherheit','zh-CN':'安全','ja':'セキュリティ','ko':'보안'}
    },
    '/lending':{
      'NATIVE ZORYQ TESTNET DAPP':{'pt-BR':'DAPP NATIVO DA TESTNET ZORYQ','es':'DAPP NATIVA DE ZORYQ TESTNET','fr':'DAPP NATIF ZORYQ TESTNET','de':'NATIVE ZORYQ TESTNET-DAPP','zh-CN':'ZORYQ 测试网原生 DAPP','ja':'ZORYQ テストネット・ネイティブ DAPP','ko':'ZORYQ 테스트넷 네이티브 DAPP'},
      'Borrow. Supply. Build credit rails.':{'pt-BR':'Empreste. Forneça liquidez. Construa trilhos de crédito.','es':'Pide prestado. Aporta liquidez. Construye rieles de crédito.','fr':'Empruntez. Fournissez. Construisez des rails de crédit.','de':'Leihen. Liquidität bereitstellen. Kredit-Rails bauen.','zh-CN':'借贷。提供流动性。构建信用轨道。','ja':'借りる。供給する。信用レールを構築する。','ko':'대출. 유동성 공급. 신용 레일 구축.'},
      'ZQ collateral':{'pt-BR':'Colateral ZQ','es':'Colateral ZQ','fr':'Collatéral ZQ','de':'ZQ-Sicherheit','zh-CN':'ZQ 抵押品','ja':'ZQ担保','ko':'ZQ 담보'},
      'zUSD debt':{'pt-BR':'Dívida zUSD','es':'Deuda zUSD','fr':'Dette zUSD','de':'zUSD-Schuld','zh-CN':'zUSD 债务','ja':'zUSD負債','ko':'zUSD 부채'},
      'zUSD supplied':{'pt-BR':'zUSD fornecido','es':'zUSD aportado','fr':'zUSD fourni','de':'zUSD bereitgestellt','zh-CN':'已提供 zUSD','ja':'供給済みzUSD','ko':'공급된 zUSD'},
      'Borrow available':{'pt-BR':'Empréstimo disponível','es':'Préstamo disponible','fr':'Emprunt disponible','de':'Verfügbarer Kredit','zh-CN':'可借额度','ja':'借入可能額','ko':'대출 가능액'},
      'Deposit ZQ collateral':{'pt-BR':'Depositar colateral ZQ','es':'Depositar colateral ZQ','fr':'Déposer du collatéral ZQ','de':'ZQ-Sicherheit einzahlen','zh-CN':'存入 ZQ 抵押品','ja':'ZQ担保を預ける','ko':'ZQ 담보 예치'},
      'Borrow zUSD':{'pt-BR':'Tomar zUSD emprestado','es':'Pedir zUSD prestado','fr':'Emprunter zUSD','de':'zUSD leihen','zh-CN':'借入 zUSD','ja':'zUSDを借りる','ko':'zUSD 대출'},
      'Repay zUSD':{'pt-BR':'Pagar zUSD','es':'Reembolsar zUSD','fr':'Rembourser zUSD','de':'zUSD zurückzahlen','zh-CN':'偿还 zUSD','ja':'zUSDを返済','ko':'zUSD 상환'},
      'Supply zUSD liquidity':{'pt-BR':'Fornecer liquidez zUSD','es':'Aportar liquidez zUSD','fr':'Fournir de la liquidité zUSD','de':'zUSD-Liquidität bereitstellen','zh-CN':'提供 zUSD 流动性','ja':'zUSD流動性を供給','ko':'zUSD 유동성 공급'},
      'Risk model v1':{'pt-BR':'Modelo de risco v1','es':'Modelo de riesgo v1','fr':'Modèle de risque v1','de':'Risikomodell v1','zh-CN':'风险模型 v1','ja':'リスクモデル v1','ko':'리스크 모델 v1'},
      'Liquidation threshold':{'pt-BR':'Limite de liquidação','es':'Umbral de liquidación','fr':'Seuil de liquidation','de':'Liquidationsschwelle','zh-CN':'清算阈值','ja':'清算しきい値','ko':'청산 기준'},
      'Borrow APR':{'pt-BR':'APR de empréstimo','es':'APR de préstamo','fr':'APR d’emprunt','de':'Kredit-APR','zh-CN':'借款 APR','ja':'借入APR','ko':'대출 APR'}
    }
  };
  const dict={...common,...(pages[path]||{})};
  function tr(s){const row=dict[s];return row?.[lang]||s}
  function walk(root=document.body){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);for(const n of nodes){const raw=n.nodeValue,trim=raw.trim();if(!trim)continue;const translated=tr(trim);if(translated!==trim)n.nodeValue=raw.replace(trim,translated)}}
  function mount(){const header=document.querySelector('header.nav');if(header&&!header.querySelector('.zoryq-language-select')){const host=document.createElement('span');host.style.marginLeft='8px';ZORYQI18N.mountSelector(host);header.appendChild(host)}walk()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
