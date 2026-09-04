# ZORYQ dApp Provider API v0.3

Developers use the injected `window.zoryq` provider from ZORYQ Wallet.

```js
const accounts = await window.zoryq.request({ method: 'zoryq_requestAccounts' });
const address = accounts[0];
const chainId = await window.zoryq.request({ method: 'zoryq_chainId' });
```

## Sign an authentication challenge

```js
const proof = await window.zoryq.request({
  method: 'zoryq_signMessage',
  params: { message: challenge.message }
});
```

Returns `{ address, publicKey, signature, algorithm, domain }`.

## Sign a transaction

```js
const signed = await window.zoryq.request({
  method: 'zoryq_signTransaction',
  params: {
    transaction: {
      version: 1,
      chain_id: 'zoryq-testnet-1',
      type: 'transfer',
      from: address,
      to: 'zq1...',
      amount: 100000000,
      fee: 1000,
      nonce: 0,
      timestamp: Date.now()
    }
  }
});
```

The wallet adds `pubkey_format`, `pubkey`, and `signature`. The dApp then broadcasts the signed transaction to a ZORYQ RPC/node. dApps must never request, store, or transmit a user's mnemonic/private key.

## Current allow-list
The Testnet extension injects the provider only on official ZORYQ Testnet origins. A future developer mode will allow user-approved third-party origins.