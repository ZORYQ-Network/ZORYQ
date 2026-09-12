window.ZORYQ_CONFIG={
  chainId:5919065,
  chainIdHex:'0x5a5159',
  networkName:'ZORYQ EVM Testnet',
  nativeSymbol:'ZQ',
  rpcBase:'https://zoryq-evm-node-live-production.up.railway.app',
  rpcUrl:'https://zoryq-evm-node-live-production.up.railway.app/rpc',
  explorerUrl:'https://zoryq-evm-node-live-production.up.railway.app/explorer',
  rewardRegistry:'0xAB1Dd21c529b182191ED84f00A4dF1917652CB10',
  questRegistry:'0x85747F9BdCd758fcfB562c929236CCA6eEB025a9',
  questCompletionRegistry:'0xD371eb7863cA000fF5039e2Db613F2094ba46b15',
  stakeContract:'0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1',
  testToken:'0xd2121E96C6af936c0496fDB499c1D0613d26c2B9',
  swapContract:'0x8205F34B803eDd79DDCA414F00e12eCdDEdDacbE',
  dexContract:'0x686Ff70d8D551F0a183DbDc608486De9fA9Aa156',
  lendingContract:'0xA08d491c06a2B01bbe6866CA87302c794aD9fB77',
  projectRegistry:'0x180042c92A42f183A67005E8C0968a1F190aab33',
  autonomousEconomy:'0xe9E075d1d44DEC0ee973e94F6e3eE8B7c2b27397',
  autonomousCompanyV2:'0xab9654c5867CB71E0Cedb6B7379d61aadb57af60',
  onePromptCompany:'0xab9654c5867CB71E0Cedb6B7379d61aadb57af60',
  adminTreasury:'0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33',
  scoreEpoch:1
};

// Autonomous helpers are isolated to the Autonomous product surface.
if (/\/autonomous(?:\.html)?$/.test(window.location.pathname)) {
  for (const src of ['./autonomous-evidence.js','./autonomous-wallet.js']) {
    const script=document.createElement('script');
    script.src=src;
    script.defer=true;
    document.head.appendChild(script);
  }
}
