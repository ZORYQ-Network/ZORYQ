#!/usr/bin/env python3
import argparse, json, os, platform, statistics, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from eth_account import Account

CHAIN_ID = 5919065

def pct(values, p):
    if not values: return None
    s=sorted(values); i=min(len(s)-1,max(0,int(round((p/100)*(len(s)-1))))); return round(s[i],3)

def rpc(url, method, params, rid=1, timeout=15):
    r=requests.post(url,json={'jsonrpc':'2.0','id':rid,'method':method,'params':params},timeout=timeout)
    r.raise_for_status(); j=r.json()
    if 'error' in j: raise RuntimeError(j['error'])
    return j['result']

def wait_receipt(url, tx_hash, deadline):
    while time.time() < deadline:
        x=rpc(url,'eth_getTransactionReceipt',[tx_hash])
        if x: return x
        time.sleep(0.05)
    raise TimeoutError(tx_hash)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--base-url',default=os.getenv('ZORYQ_BASE_URL','http://127.0.0.1:18080'))
    ap.add_argument('--count',type=int,default=int(os.getenv('ZORYQ_TX_COUNT','50')))
    ap.add_argument('--concurrency',type=int,default=int(os.getenv('ZORYQ_TX_CONCURRENCY','8')))
    ap.add_argument('--output',default=os.getenv('ZORYQ_TX_BENCH_OUTPUT','zoryq-tx-benchmark.json'))
    args=ap.parse_args(); rpc_url=args.base_url.rstrip('/')+'/rpc'

    chain=int(rpc(rpc_url,'eth_chainId',[]),16)
    if chain != CHAIN_ID: raise SystemExit(f'wrong chain id {chain}')

    sender=Account.create('zoryq-ci-transaction-benchmark')
    faucet=requests.post(args.base_url.rstrip('/')+'/faucet',json={'address':sender.address},timeout=20)
    if faucet.status_code >= 300: raise SystemExit(f'faucet setup failed {faucet.status_code}: {faucet.text}')

    balance=int(rpc(rpc_url,'eth_getBalance',[sender.address,'latest']),16)
    nonce=int(rpc(rpc_url,'eth_getTransactionCount',[sender.address,'pending']),16)
    gas_price=int(rpc(rpc_url,'eth_gasPrice',[]),16)
    if balance <= 0: raise SystemExit('benchmark sender was not funded')

    recipient=Account.create('zoryq-ci-benchmark-recipient').address
    signed=[]
    for i in range(args.count):
        tx={'chainId':CHAIN_ID,'nonce':nonce+i,'to':recipient,'value':1,'gas':21000,'gasPrice':gas_price}
        raw=sender.sign_transaction(tx).raw_transaction.hex()
        signed.append((i,raw))

    accepted={}; errors=[]; start=time.perf_counter()
    def submit(item):
        i,raw=item; t=time.perf_counter(); h=rpc(rpc_url,'eth_sendRawTransaction',[raw],i+1000); return i,h,(time.perf_counter()-t)*1000
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futs=[ex.submit(submit,x) for x in signed]
        for f in as_completed(futs):
            try:
                i,h,ms=f.result(); accepted[h]={'index':i,'accept_ms':ms,'accepted_at':time.perf_counter()}
            except Exception as e: errors.append(str(e))

    receipts=[]
    for h,meta in accepted.items():
        try:
            rec=wait_receipt(rpc_url,h,time.time()+30)
            receipts.append({'hash':h,'index':meta['index'],'accept_ms':meta['accept_ms'],'accepted_to_included_ms':(time.perf_counter()-meta['accepted_at'])*1000,'blockNumber':int(rec['blockNumber'],16),'status':int(rec['status'],16)})
        except Exception as e: errors.append(f'{h}:{e}')
    elapsed=time.perf_counter()-start
    accepts=[x['accept_ms'] for x in receipts]; inclusion=[x['accepted_to_included_ms'] for x in receipts]
    success=sum(1 for x in receipts if x['status']==1)
    result={
      'schema':'zoryq.transaction-benchmark.v1','claimBoundary':'Measures signed native-transfer submission and receipt inclusion on the tested single-node development executor. This is not consensus finality and not a parallel-execution claim.',
      'chainId':chain,'submitted':args.count,'accepted':len(accepted),'receipts':len(receipts),'successfulReceipts':success,'errors':errors,
      'elapsedSeconds':round(elapsed,4),'successfulReceiptTps':round(success/elapsed,3) if elapsed else None,'concurrency':args.concurrency,
      'acceptLatencyMs':{'p50':pct(accepts,50),'p95':pct(accepts,95),'p99':pct(accepts,99)},
      'acceptedToIncludedMs':{'p50':pct(inclusion,50),'p95':pct(inclusion,95),'p99':pct(inclusion,99)},
      'blocks':sorted(set(x['blockNumber'] for x in receipts)),
      'environment':{'python':platform.python_version(),'platform':platform.platform(),'cpuCount':os.cpu_count(),'githubSha':os.getenv('GITHUB_SHA')},
      'transactions':receipts
    }
    with open(args.output,'w') as f: json.dump(result,f,indent=2)
    print(json.dumps({k:v for k,v in result.items() if k!='transactions'},indent=2))
    if success != args.count or errors: raise SystemExit(2)

if __name__=='__main__': main()
