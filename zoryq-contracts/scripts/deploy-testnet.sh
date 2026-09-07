#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://zoryq-evm-node-live-production.up.railway.app}"
RPC_URL="${RPC_URL:-$BASE_URL/rpc}"
FAUCET_URL="${FAUCET_URL:-$BASE_URL/faucet}"
ADMIN="${ADMIN:-0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33}"

retry_curl() {
  curl --fail --silent --show-error \
    --retry 8 --retry-delay 5 --retry-all-errors --connect-timeout 10 --max-time 30 "$@"
}

echo "Checking ZORYQ public health..."
retry_curl "$BASE_URL/health" | tee /tmp/zoryq-health.json

echo "Checking ZORYQ chain ID..."
CHAIN_HEX=$(retry_curl -X POST "$RPC_URL" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | jq -r '.result')
test "$CHAIN_HEX" = "0x5a5159"

printf '[profile.default]\nsrc = "src"\ntest = "test"\nout = "out"\nsolc_version = "0.8.24"\n' > foundry.toml
forge build
forge test -vv

DEPLOYER_KEY="0x$(openssl rand -hex 32)"
DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_KEY")
echo "Transient Testnet deployer: $DEPLOYER"

echo "Funding transient deployer from Testnet faucet..."
retry_curl -X POST "$FAUCET_URL" \
  -H 'content-type: application/json' \
  -d "{\"address\":\"$DEPLOYER\"}" | tee /tmp/zoryq-faucet.json
jq -e '.ok == true' /tmp/zoryq-faucet.json >/dev/null
sleep 3

BALANCE=$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL")
python3 - "$BALANCE" <<'PY'
import sys
balance = int(sys.argv[1])
minimum = 10_000_000_000_000_000_000
if balance <= minimum:
    raise SystemExit(f"deployer balance too low: {balance}")
PY

forge create src/ZoryqBootstrap.sol:ZoryqBootstrap \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --constructor-args "$ADMIN" \
  --value 10000000000000000000 \
  --broadcast \
  --json > /tmp/zoryq-deploy.json

BOOTSTRAP=$(jq -r '.deployedTo // .deployed_to // .contractAddress // empty' /tmp/zoryq-deploy.json)
TX=$(jq -r '.transactionHash // .transaction_hash // .txHash // empty' /tmp/zoryq-deploy.json)
test -n "$BOOTSTRAP"

test "$(cast chain-id --rpc-url "$RPC_URL")" = "5919065"

REWARD=$(cast call "$BOOTSTRAP" 'rewardRegistry()(address)' --rpc-url "$RPC_URL")
QUEST=$(cast call "$BOOTSTRAP" 'questRegistry()(address)' --rpc-url "$RPC_URL")
COMPLETION=$(cast call "$BOOTSTRAP" 'questCompletionRegistry()(address)' --rpc-url "$RPC_URL")
STAKE=$(cast call "$BOOTSTRAP" 'stakeContract()(address)' --rpc-url "$RPC_URL")
TOKEN=$(cast call "$BOOTSTRAP" 'testToken()(address)' --rpc-url "$RPC_URL")
SWAP=$(cast call "$BOOTSTRAP" 'swapContract()(address)' --rpc-url "$RPC_URL")

for A in "$BOOTSTRAP" "$REWARD" "$QUEST" "$COMPLETION" "$STAKE" "$TOKEN" "$SWAP"; do
  test "$(cast code "$A" --rpc-url "$RPC_URL")" != "0x"
done

ADMIN_LOWER=$(printf '%s' "$ADMIN" | tr '[:upper:]' '[:lower:]')
for A in "$REWARD" "$QUEST" "$COMPLETION" "$TOKEN" "$SWAP"; do
  OWNER=$(cast call "$A" 'owner()(address)' --rpc-url "$RPC_URL" | tr '[:upper:]' '[:lower:]')
  test "$OWNER" = "$ADMIN_LOWER"
done

ADMIN_TOKEN=$(cast call "$TOKEN" 'balanceOf(address)(uint256)' "$ADMIN" --rpc-url "$RPC_URL")
RESERVES=$(cast call "$SWAP" 'reserves()(uint256,uint256)' --rpc-url "$RPC_URL")

jq -n \
  --arg chainId "5919065" \
  --arg admin "$ADMIN" \
  --arg bootstrap "$BOOTSTRAP" \
  --arg deploymentTx "$TX" \
  --arg rewardRegistry "$REWARD" \
  --arg questRegistry "$QUEST" \
  --arg questCompletionRegistry "$COMPLETION" \
  --arg stakeContract "$STAKE" \
  --arg testToken "$TOKEN" \
  --arg swapContract "$SWAP" \
  --arg adminTokenBalanceWei "$ADMIN_TOKEN" \
  --arg reserves "$RESERVES" \
  '{chainId:$chainId,admin:$admin,bootstrap:$bootstrap,deploymentTx:$deploymentTx,rewardRegistry:$rewardRegistry,questRegistry:$questRegistry,questCompletionRegistry:$questCompletionRegistry,stakeContract:$stakeContract,testToken:$testToken,swapContract:$swapContract,adminTokenBalanceWei:$adminTokenBalanceWei,swapReservesRaw:$reserves,verified:true}' \
  > ../zoryq-testnet-deployment.json

unset DEPLOYER_KEY
cat ../zoryq-testnet-deployment.json
