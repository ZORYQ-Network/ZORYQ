use axum::{body::Body, extract::Request, http::{HeaderMap, Method, Response, StatusCode}, response::IntoResponse, routing::any, Router};
use bytes::Bytes;
use reqwest::Client;
use serde_json::{json, Value};
use std::{env, fs, net::SocketAddr, path::Path, process::Stdio, sync::Arc};
use tokio::{process::{Child, Command}, signal, sync::Mutex};

const CHAIN_PORT:u16=8090;
const SOCIAL_PORT:u16=8086;
const SOCIAL_HTML:&str="/app/web/zoriq-social.html";
const MEMORY_STATUS:&str="/data/zoryq-memory-processes.json";

#[derive(Clone)]
struct State{client:Client}

fn json_response(status:StatusCode, value:Value)->Response<Body>{
    let body=Body::from(value.to_string());
    Response::builder().status(status)
        .header("content-type","application/json; charset=utf-8")
        .header("cache-control","no-store")
        .header("access-control-allow-origin","*")
        .header("access-control-allow-headers","content-type")
        .header("access-control-allow-methods","GET,POST,OPTIONS")
        .body(body).unwrap()
}

async fn fetch_json(client:&Client,url:&str)->Option<(StatusCode,Value)>{
    let r=client.get(url).send().await.ok()?; let status=r.status(); let v=r.json::<Value>().await.ok()?; Some((status,v))
}

async fn health(state:&State)->Response<Body>{
    let chain=fetch_json(&state.client,&format!("http://127.0.0.1:{CHAIN_PORT}/health"));
    let social=fetch_json(&state.client,&format!("http://127.0.0.1:{SOCIAL_PORT}/status"));
    let (c,s)=tokio::join!(chain,social);
    let (cs,cv)=c.unwrap_or((StatusCode::SERVICE_UNAVAILABLE,json!({"error":"chain_unreachable"})));
    let (ss,sv)=s.unwrap_or((StatusCode::SERVICE_UNAVAILABLE,json!({"error":"social_unreachable"})));
    let chain_ok=cs.is_success() && cv.get("ok").and_then(Value::as_bool)==Some(true);
    let social_ok=ss.is_success() && sv.get("chainReady").and_then(Value::as_bool)==Some(true);
    let ok=chain_ok&&social_ok;
    let mem=fs::read_to_string(MEMORY_STATUS).ok().and_then(|s|serde_json::from_str::<Value>(&s).ok()).and_then(|v|v.get("cgroup").cloned());
    let mut out=cv.as_object().cloned().unwrap_or_default();
    out.insert("ok".into(),Value::Bool(ok));
    out.insert("readyForTraffic".into(),Value::Bool(ok));
    out.insert("product".into(),json!({"wallet":"ZORYQ Wallet","social":{"ok":ss.is_success(),"status":sv},"explorer":true,"faucet":true}));
    out.insert("memoryWatchdog".into(),mem.unwrap_or(Value::Null));
    out.insert("release".into(),Value::String("infra-v5-rust-edge".into()));
    json_response(if ok{StatusCode::OK}else{StatusCode::SERVICE_UNAVAILABLE},Value::Object(out))
}

async fn proxy(state:&State, mut req:Request, port:u16, path:String)->Response<Body>{
    let method=req.method().clone(); let headers=req.headers().clone();
    let body=match axum::body::to_bytes(req.body_mut(),2*1024*1024).await{Ok(b)=>b,Err(_)=>return json_response(StatusCode::PAYLOAD_TOO_LARGE,json!({"ok":false,"error":"request_too_large"}))};
    let url=format!("http://127.0.0.1:{port}{path}");
    let mut rb=state.client.request(method,url);
    for (k,v) in headers.iter(){if k.as_str().eq_ignore_ascii_case("host"){continue} rb=rb.header(k,v);}
    let upstream=match rb.body(body).send().await{Ok(r)=>r,Err(e)=>return json_response(StatusCode::SERVICE_UNAVAILABLE,json!({"ok":false,"error":"upstream_unavailable","detail":e.to_string()}))};
    let status=upstream.status(); let h=upstream.headers().clone(); let bytes=upstream.bytes().await.unwrap_or_else(|_|Bytes::new());
    let mut builder=Response::builder().status(status); for (k,v) in h.iter(){builder=builder.header(k,v);} builder.body(Body::from(bytes)).unwrap()
}

async fn handler(axum::extract::State(state):axum::extract::State<State>,req:Request)->Response<Body>{
    let method=req.method().clone(); let uri=req.uri().clone(); let p=uri.path();
    if method==Method::OPTIONS{return json_response(StatusCode::NO_CONTENT,json!({}))}
    if method==Method::GET && p=="/health" {return health(&state).await}
    if method==Method::GET && p=="/ops/process-memory" {
        return match fs::read_to_string(MEMORY_STATUS).ok().and_then(|s|serde_json::from_str::<Value>(&s).ok()){
            Some(v)=>json_response(StatusCode::OK,v),None=>json_response(StatusCode::SERVICE_UNAVAILABLE,json!({"ok":false,"error":"memory_watchdog_initializing"}))};
    }
    if method==Method::GET && matches!(p,"/social"|"/zoriq"|"/zoriq-social"|"/zoriq-social.html"){
        return match fs::read(SOCIAL_HTML){Ok(b)=>Response::builder().status(200).header("content-type","text/html; charset=utf-8").header("cache-control","no-cache").header("x-zoryq-product","social-rust").body(Body::from(b)).unwrap(),Err(_)=>json_response(StatusCode::NOT_FOUND,json!({"ok":false,"error":"social_surface_missing"}))};
    }
    let mut path=uri.path_and_query().map(|x|x.as_str()).unwrap_or("/").to_string();
    if p.starts_with("/api/social") { path=path.replacen("/api/social","",1); if path.is_empty(){path="/".into();} return proxy(&state,req,SOCIAL_PORT,path).await; }
    proxy(&state,req,CHAIN_PORT,path).await
}

fn spawn_node(name:&str,args:&[&str],envs:&[(&str,String)])->Child{
    let mut c=Command::new("/usr/local/bin/node"); c.args(args).stdin(Stdio::null()).stdout(Stdio::inherit()).stderr(Stdio::inherit());
    for (k,v) in envs{c.env(k,v);} let child=c.spawn().unwrap_or_else(|e|panic!("failed to spawn {name}: {e}")); println!("[zoryq-rust] spawned {name}"); child
}

#[tokio::main(flavor="multi_thread",worker_threads=2)]
async fn main(){
    let port=env::var("PORT").ok().and_then(|v|v.parse().ok()).unwrap_or(8080u16);
    let chain_spec=env::var("ZORYQ_RETH_CHAIN_SPEC").unwrap_or_else(|_|"/data/zoryq-reth-effective-genesis.json".into());
    let allow_reset=if Path::new("/data/zoryq-reth-migration.json").exists(){"true".into()}else{env::var("ZORYQ_ALLOW_RETH_GENESIS_RESET").unwrap_or_else(|_|"false".into())};
    let chain=spawn_node("chain",&["--max-old-space-size=192","traffic-gateway.mjs"],&[("PORT",CHAIN_PORT.to_string()),("ZORYQ_RETH_CHAIN_SPEC",chain_spec),("ZORYQ_ALLOW_RETH_GENESIS_RESET",allow_reset),("NODE_OPTIONS","--max-old-space-size=128".into())]);
    let social=spawn_node("social",&["--max-old-space-size=96","social-service.mjs"],&[("PORT",SOCIAL_PORT.to_string()),("ZORYQ_CHAIN_BASE",format!("http://127.0.0.1:{CHAIN_PORT}")),("NODE_OPTIONS","--max-old-space-size=96".into())]);
    let watchdog=spawn_node("memory-watchdog",&["--max-old-space-size=32","memory-watchdog.mjs"],&[("ZORYQ_PROCESS_MEMORY_STATUS",MEMORY_STATUS.into()),("NODE_OPTIONS","--max-old-space-size=32".into())]);
    let children=Arc::new(Mutex::new(vec![chain,social,watchdog]));
    let monitor=children.clone(); tokio::spawn(async move{loop{tokio::time::sleep(std::time::Duration::from_secs(2)).await;let mut guard=monitor.lock().await;for child in guard.iter_mut(){if let Ok(Some(status))=child.try_wait(){eprintln!("[zoryq-rust] child exited: {status}");std::process::exit(1);}}}});
    let state=State{client:Client::builder().timeout(std::time::Duration::from_secs(20)).build().unwrap()};
    let app=Router::new().fallback(any(handler)).with_state(state);
    let addr=SocketAddr::from(([0,0,0,0],port)); println!("[zoryq-rust] native gateway listening on :{port}; release=infra-v5-rust-edge");
    let listener=tokio::net::TcpListener::bind(addr).await.expect("bind");
    let shutdown_children=children.clone();
    axum::serve(listener,app).with_graceful_shutdown(async move{let _=signal::ctrl_c().await;let mut g=shutdown_children.lock().await;for c in g.iter_mut(){let _=c.start_kill();}}).await.expect("serve");
}
