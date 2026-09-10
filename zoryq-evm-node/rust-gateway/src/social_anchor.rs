use alloy_network::{EthereumWallet,TransactionBuilder};
use alloy_primitives::{Bytes,U256};
use alloy_provider::{Provider,ProviderBuilder};
use alloy_rpc_types_eth::TransactionRequest;
use alloy_signer::Signer;
use alloy_signer_local::MnemonicBuilder;
use sha3::{Digest,Keccak256};
use std::{env,fs};

const CHAIN_ID:u64=5919065;
const SOCIAL_PREFIX:&str="5a4f5259515f534f4349414c5f56313a";

fn hex_decode(s:&str)->Result<Vec<u8>,String>{let s=s.trim_start_matches("0x");if s.len()%2!=0{return Err("invalid_hex".into())}let mut out=Vec::with_capacity(s.len()/2);for i in (0..s.len()).step_by(2){out.push(u8::from_str_radix(&s[i..i+2],16).map_err(|_|"invalid_hex")?)}Ok(out)}

pub async fn anchor_event(canonical_event:&str)->Result<String,String>{
 if env::var("ZORYQ_SOCIAL_ANCHOR").unwrap_or_else(|_|"true".into()).eq_ignore_ascii_case("false"){return Ok(String::new())}
 let mnemonic_file=env::var("ZORYQ_RETH_MNEMONIC_FILE").unwrap_or_else(|_|"/data/zoryq-reth-mnemonic.txt".into());
 let phrase=fs::read_to_string(mnemonic_file).map_err(|_|"social_relayer_mnemonic_missing")?;
 let phrase=phrase.trim();if phrase.is_empty(){return Err("social_relayer_mnemonic_missing".into())}
 let index=env::var("ZORYQ_SOCIAL_RELAYER_INDEX").ok().and_then(|v|v.parse::<u32>().ok()).unwrap_or(23).max(20);
 let mut signer=MnemonicBuilder::try_from_phrase_nth(phrase,index).map_err(|e|format!("social_relayer_derivation_failed:{e}"))?;
 signer.set_chain_id(Some(CHAIN_ID));
 let address=signer.address();
 let wallet=EthereumWallet::new(signer);
 let rpc=env::var("ZORYQ_SOCIAL_RPC").unwrap_or_else(|_|"http://127.0.0.1:8082/rpc".into());
 let provider=ProviderBuilder::new().with_chain_id(CHAIN_ID).wallet(wallet).connect_http(rpc.parse().map_err(|_|"social_rpc_invalid")?);
 let balance=provider.get_balance(address).await.map_err(|e|format!("social_relayer_balance_failed:{e}"))?;
 if balance==U256::ZERO{return Err("social_relayer_unfunded".into())}
 let mut h=Keccak256::new();h.update(canonical_event.as_bytes());let event_hash=h.finalize();
 let mut data=hex_decode(SOCIAL_PREFIX)?;data.extend_from_slice(&event_hash);
 let tx=TransactionRequest::default().with_from(address).with_to(address).with_value(U256::ZERO).with_input(Bytes::from(data));
 let receipt=provider.send_transaction_sync(tx).await.map_err(|e|format!("social_anchor_send_failed:{e}"))?;
 if !receipt.status(){return Err("social_anchor_failed".into())}
 Ok(format!("{:#x}",receipt.transaction_hash))
}
