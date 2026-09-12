# ZORYQ Mobile Witness Node

A battery-aware Android-oriented witness node for the ZORYQ testnet.

The first version is deliberately not a validator. It independently checks chain identity, compares multiple RPC peers, verifies monotonically advancing block headers, records peer agreement, and reports local participation metrics. This improves independent verification without overstating consensus decentralization.

## Modes
- Eco: checks less frequently and is intended for battery operation.
- Balanced: regular witness verification.
- Active: intended for charging + Wi-Fi.

## Security model
The client must query more than one independent endpoint before treating a checkpoint as agreed. A single canonical RPC may be used as bootstrap only; it is not sufficient evidence of decentralization.
