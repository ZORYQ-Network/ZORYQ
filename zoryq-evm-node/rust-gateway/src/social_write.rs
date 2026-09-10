use rand::{rngs::OsRng,RngCore};
use serde_json::{json,Value};
use std::{collections::{HashMap,HashSet},env,fs::{self,OpenOptions},io::Write,os::unix::fs::OpenOptionsExt,sync::OnceLock,time::{Duration,Instant,SystemTime,UNIX_EPOCH}};
use tokio::sync::Mutex;

static RATE:OnceLock<Mutex<HashMap<String,Vec<Instant>>>>=OnceLock::new();
fn rate()->&'static Mutex<HashMap<String,Vec<Instant>>>{RATE.get_or_init(||Mutex::new(HashMap::new()))}
fn store_file()->String{env::var("ZORYQ_SOCIAL_STORE").unwrap_or_else(|_|"/data/zoryq-social-events.ndjson".into())}
fn norm(s:&str)->String{s.trim().to_ascii_lowercase()}
fn as_str<'a>(v:&'a Value,k:&str)->&'a str{v.get(k).and_then(Value::as_str).unwrap_or("")}
fn canonical(v:&Value)->String{match v{Value::Object(m)=>{let mut keys=m.keys().collect::<Vec<_>>();keys.sort();format!("{{{}}}",keys.into_iter().map(|k|format!("{}:{}",serde_json::to_string(k).unwrap(),canonical(&m[k]))).collect::<Vec<_>>().join(","))},Value::Array(a)=>format!("[{}]",a.iter().map(canonical).collect::<Vec<_>>().join(",")),_=>serde_json::to_string(v).unwrap_or_else(|_|"null".into())}}
fn uuid_v4()->String{let mut b=[0u8;16];OsRng.fill_bytes(&mut b);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;format!("{}-{}-{}-{}-{}",hex(&b[0..4]),hex(&b[4..6]),hex(&b[6..8]),hex(&b[8..10]),hex(&b[10..16]))}
fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
fn now_ms()->u64{SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64}
async fn allowed(address:&str)->bool{let mut g=rate().lock().await;let now=Instant::now();let rows=g.entry(norm(address)).or_default();rows.retain(|t|now.duration_since(*t)<Duration::from_secs(60));if rows.len()>=30{return false}rows.push(now);true}
fn append_event(v:&Value)->Result<(),String>{let path=store_file();if let Some(parent)=std::path::Path::new(&path).parent(){let _=fs::create_dir_all(parent);}let mut f=OpenOptions::new().create(true).append(true).mode(0o600).open(path).map_err(|e|format!("social_store_open_failed:{e}"))?;let line=serde_json::to_string(v).map_err(|e|format!("social_store_encode_failed:{e}"))?+"\n";f.write_all(line.as_bytes()).map_err(|e|format!("social_store_write_failed:{e}"))?;f.sync_all().map_err(|e|format!("social_store_sync_failed:{e}"))?;Ok(())}
#[derive(Default)]struct Toggle{likes:HashMap<String,HashSet<String>>,reposts:HashMap<String,HashSet<String>>,bookmarks:HashMap<String,HashSet<String>>,follows:HashMap<String,HashSet<String>>}
fn load_toggle()->Toggle{let mut t=Toggle::default();if let Ok(s)=fs::read_to_string(store_file()){for line in s.lines(){let Ok(e)=serde_json::from_str::<Value>(line)else{continue};let typ=as_str(&e,"type");let a=norm(as_str(&e,"address"));let active=e.get("active").and_then(Value::as_bool).unwrap_or(false);match typ{"like"|"repost"=>{let pid=as_str(&e,"postId").to_string();let map=if typ=="like"{&mut t.likes}else{&mut t.reposts};let set=map.entry(pid).or_default();if active{set.insert(a)}else{set.remove(&a);}},"bookmark"=>{let pid=as_str(&e,"postId").to_string();let set=t.bookmarks.entry(a).or_default();if active{set.insert(pid.clone())}else{set.remove(&pid);}},"follow"=>{let target=norm(as_str(&e,"target"));let set=t.follows.entry(a).or_default();if active{set.insert(target.clone())}else{set.remove(&target);}},_=>{}}}}t}
fn toggle(action:&str,address:&str,payload:&Value)->bool{let t=load_toggle();let a=norm(address);match action{"like"=>!t.likes.get(as_str(payload,"postId")).map(|s|s.contains(&a)).unwrap_or(false),"repost"=>!t.reposts.get(as_str(payload,"postId")).map(|s|s.contains(&a)).unwrap_or(false),"bookmark"=>!t.bookmarks.get(&a).map(|s|s.contains(as_str(payload,"postId"))).unwrap_or(false),"follow"=>!t.follows.get(&a).map(|s|s.contains(&norm(as_str(payload,"target")))).unwrap_or(false),_=>true}}
fn anchor_document(event:&Value)->Value{let mut o=event.as_object().cloned().unwrap_or_default();o.remove("anchorTxHash");let mut doc=serde_json::Map::new();doc.insert("version".into(),json!(1));doc.insert("chainId".into(),json!(5919065));for(k,v)in o{doc.insert(k,v);}Value::Object(doc)}
fn find_post_for(address:&str,id:&str)->Option<Value>{let p=crate::social::profile(address,"",address).ok()?;p.get("posts")?.as_array()?.iter().find(|v|as_str(v,"id")==id).cloned()}
fn find_feed_post(viewer:&str,id:&str)->Option<Value>{crate::social::feed(viewer,50,u64::MAX).get("posts")?.as_array()?.iter().find(|v|as_str(v,"id")==id).cloned()}

pub async fn commit_verified(address:String,action:String,payload:Value)->Result<Value,(u16,Value)>{
 if !allowed(&address).await{return Err((429,json!({"ok":false,"error":"social_rate_limit"})))}
 let created=now_ms();let active=toggle(&action,&address,&payload);
 let mut event=match action.as_str(){
  "profile"=>json!({"version":1,"type":"profile","address":address,"payload":payload,"createdAt":created}),
  "post"=>json!({"version":1,"type":"post","id":uuid_v4(),"address":address,"payload":payload,"createdAt":created}),
  "like"|"repost"|"bookmark"=>json!({"version":1,"type":action,"address":address,"postId":as_str(&payload,"postId"),"active":active,"createdAt":created}),
  "follow"=>json!({"version":1,"type":"follow","address":address,"target":as_str(&payload,"target"),"active":active,"createdAt":created}),
  _=>return Err((400,json!({"ok":false,"error":"unsupported_social_action"})))
 };
 let tx_hash=if action=="bookmark"{String::new()}else{let doc=anchor_document(&event);crate::social_anchor::anchor_event(&canonical(&doc)).await.map_err(|e|(400,json!({"ok":false,"error":e})))?};
 if !tx_hash.is_empty(){event.as_object_mut().unwrap().insert("anchorTxHash".into(),json!(tx_hash));}
 append_event(&event).map_err(|e|(500,json!({"ok":false,"error":e})))?;
 if !tx_hash.is_empty(){let a=json!({"version":1,"type":"anchor","address":address,"action":action,"eventId":event.get("id").cloned().unwrap_or(Value::Null),"txHash":tx_hash,"createdAt":now_ms()});append_event(&a).map_err(|e|(500,json!({"ok":false,"error":e})))?;}
 match event.get("type").and_then(Value::as_str).unwrap_or(""){
  "profile"=>{let p=crate::social::profile(&address,"",&address).ok().and_then(|v|v.get("profile").cloned()).unwrap_or(Value::Null);Ok(json!({"ok":true,"action":"profile","profile":p,"anchorTxHash":if tx_hash.is_empty(){Value::Null}else{json!(tx_hash)}}))},
  "post"=>{let id=as_str(&event,"id");let p=find_post_for(&address,id).unwrap_or(Value::Null);Ok(json!({"ok":true,"action":"post","post":p,"anchorTxHash":if tx_hash.is_empty(){Value::Null}else{json!(tx_hash)}}))},
  "like"|"repost"|"bookmark"=>{let id=as_str(&event,"postId");let p=find_feed_post(&address,id).unwrap_or(Value::Null);Ok(json!({"ok":true,"action":event.get("type").cloned().unwrap_or(Value::Null),"active":active,"post":p,"anchorTxHash":if tx_hash.is_empty(){Value::Null}else{json!(tx_hash)}}))},
  "follow"=>{let target=as_str(&event,"target");let p=crate::social::profile(target,"",&address).ok().and_then(|v|v.get("profile").cloned()).unwrap_or(Value::Null);Ok(json!({"ok":true,"action":"follow","active":active,"profile":p,"anchorTxHash":if tx_hash.is_empty(){Value::Null}else{json!(tx_hash)}}))},
  _=>Ok(json!({"ok":true}))
 }
}
