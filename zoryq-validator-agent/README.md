ZORYQ VALIDATOR AGENT — TESTNET

Purpose
- Runs on a PC and reports healthy participation to the ZORYQ Testnet coordinator.
- Reads the public ZORYQ RPC and sends signed/HMAC-authenticated heartbeats.
- Does NOT require or store the private key/seed phrase of the operator wallet.

Pairing
1. Open the official ZORYQ Run a Node page.
2. Connect the operator wallet.
3. Request a registration challenge and sign it in the wallet.
4. The page returns a Node ID and Node Secret.
5. Create zoryq-node.json in the same folder as the executable:

{
  "nodeId": "YOUR_NODE_ID",
  "secret": "YOUR_NODE_SECRET",
  "base": "https://zoryq-evm-node-v4-production.up.railway.app"
}

Run on Windows
- Double-click zoryq-validator.exe from a terminal folder containing zoryq-node.json, or run:
  zoryq-validator.exe

Run on Linux
- chmod +x zoryq-validator
- ./zoryq-validator

Healthy behavior
- The agent reads eth_blockNumber from the public RPC.
- It sends one heartbeat per minute.
- The coordinator rejects heartbeats with stale timestamps, wrong HMAC, unknown Node ID, or a block height too far from the chain.
- Pending validator points are estimates until an epoch is reviewed and finalized on-chain.

Security
- Never paste a wallet seed phrase or wallet private key into this program.
- The Node Secret is not a wallet key, but it authenticates your node heartbeats; keep it private.
- Testnet points and ZQ have no guaranteed monetary value.
