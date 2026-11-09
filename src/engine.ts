import { buildFeatures, risk, clamp, Features } from "./ml/features";

export type Status = "approved" | "restricted" | "suspended" | "revoked";
export const W = 10;
export const PN: Record<string, string> = { contacts:"Contacts", camera:"Camera", location:"Location", microphone:"Microphone", storage:"Storage", calendar:"Calendar", sms:"SMS" };
const REASON: Record<string, string> = { storage:"Sync files", calendar:"Read upcoming events", camera:"Capture photo", location:"Tag location", contacts:"Bulk contact read", microphone:"Background audio capture", sms:"Read messages" };

export interface LogItem { kind: "access"|"alert"|"change"; t: number; app: string; tick?: number; perm?: string; ok?: boolean; night?: boolean; reason?: string; msg?: string; sev?: string }
export interface AppState { id:string; name:string; icon:string; exp:string[]; off:number; col:string; perms:Record<string,Status>; win:LogItem[]; trust:number; hist:number[]; rogue:boolean; f:Features; un:string[]; risk:number }
export interface Alert { id:number; app:string; type:string; sev:"high"|"medium"; msg:string; t:number; state:"open"|"dismissed"|"resolved" }
export interface Rec { app:string; perm:string; st:Status; why:string }
export interface Sim { T:number; aid:number; run:boolean; log:LogItem[]; alerts:Alert[]; apps:AppState[] }

const rand = (a:number,b:number)=>a+Math.floor(Math.random()*(b-a+1));
const pick = <T,>(a:T[]):T => a[Math.floor(Math.random()*a.length)];
export const getApp = (S:Sim,id:string) => S.apps.find(a=>a.id===id)!;

export function createSim(): Sim {
  const mk=(id:string,name:string,icon:string,exp:string[],off:number,col:string):AppState=>({id,name,icon,exp,off,col,perms:Object.fromEntries(exp.map(p=>[p,"approved" as Status])),win:[],trust:100-off,hist:[],rogue:false,f:buildFeatures({access_count:0,expected_access_count:8,unique_permissions:0,unexpected_permissions:0,night_access_ratio:0,denied_access_count:0}),un:[],risk:0});
  const S:Sim={T:0,aid:0,run:true,log:[],alerts:[],apps:[mk("lumen","Lumen Notes","📝",["storage","calendar"],3,"#2cc8ff"),mk("pixel","PixelShare","📷",["camera","storage","location"],6,"#ffc233"),mk("fit","FitTrack","🏃",["location","calendar"],2,"#b88cff")]};
  for(let i=0;i<30;i++) tick(S,Date.now()-(30-i)*1500);
  return S;
}

export function tick(S:Sim, ts=Date.now()) {
  S.T++;
  for (const a of S.apps) {
    const n = a.rogue ? rand(3,5) : Math.random()<0.8 ? 1 : 0;
    for (let i=0;i<n;i++) {
      const extra = Object.keys(a.perms).filter(p=>!a.exp.includes(p));
      const perm = a.rogue && extra.length && Math.random()<0.6 ? pick(extra) : pick(a.exp);
      const st = a.perms[perm];
      const ok = st==="approved" || (st==="restricted" && Math.random()<0.3);
      const ev:LogItem = {kind:"access",t:ts,tick:S.T,app:a.id,perm,ok,night:Math.random()<(a.rogue?0.55:0.04),reason:REASON[perm]};
      a.win.push(ev); S.log.unshift(ev);
    }
    a.win = a.win.filter(e=>e.tick! > S.T-W);
    const ok = a.win.filter(e=>e.ok);
    a.un = [...new Set(ok.map(e=>e.perm!).filter(p=>!a.exp.includes(p)))];
    a.f = buildFeatures({access_count:ok.length,expected_access_count:8,unique_permissions:new Set(ok.map(e=>e.perm)).size,unexpected_permissions:a.un.length,night_access_ratio:ok.length?ok.filter(e=>e.night).length/ok.length:0,denied_access_count:a.win.length-ok.length});
    a.risk = risk(a.f);
    a.trust += (clamp(100-a.risk-a.off,0,100)-a.trust)*0.35;
    a.hist.push(a.trust); if (a.hist.length>60) a.hist.shift();
    watch(S,a,ts);
  }
  if (S.log.length>500) S.log.length=500;
}

function watch(S:Sim,a:AppState,ts:number) {
  const f=a.f;
  const C:Record<string,[boolean,"high"|"medium",string]> = {
    freq:[f.frequency_ratio>=2,"high",`Access frequency is ${f.frequency_ratio}× its baseline`],
    unexp:[f.unexpected_permissions>0,"high","Using unexpected permissions: "+a.un.map(p=>PN[p]).join(", ")],
    night:[f.night_access_ratio>=0.3&&f.access_count>=5,"medium",`High night-time access (${Math.round(f.night_access_ratio*100)}% of requests)`],
    deny:[f.denied_access_count>=5,"medium",`${f.denied_access_count} denied access attempts in the last window`],
  };
  for (const k in C) {
    const o=S.alerts.find(x=>x.app===a.id&&x.type===k&&x.state!=="resolved"); const [c,sev,msg]=C[k];
    if (c&&!o) { S.alerts.unshift({id:++S.aid,app:a.id,type:k,sev,msg,t:ts,state:"open"}); S.log.unshift({kind:"alert",t:ts,app:a.id,msg,sev}); }
    else if (c&&o&&o.state==="open") o.msg=msg;
    else if (!c&&o) o.state="resolved";
  }
}

export function recs(a:AppState): Rec[] {
  const r:Rec[]=[]; if (a.risk<30) return r;
  for (const [p,st] of Object.entries(a.perms)) {
    if (st==="revoked"||st==="suspended") continue;
    if (!a.exp.includes(p)) r.push({app:a.id,perm:p,st:"revoked",why:`Not part of ${a.name}’s normal behavior`});
    else if (st==="approved"&&a.f.frequency_ratio>=2) r.push({app:a.id,perm:p,st:"restricted",why:`Access rate is ${a.f.frequency_ratio}× baseline`});
  }
  return r;
}
export const allRecs = (S:Sim) => S.apps.flatMap(recs);

export function setPerm(S:Sim,id:string,p:string,st:Status) {
  getApp(S,id).perms[p]=st;
  S.log.unshift({kind:"change",t:Date.now(),app:id,msg:`You set ${PN[p]} to ${st}`});
}
/** Demo scenario: PixelShare requests extra permissions and spikes its access rate. */
export function triggerRogue(S:Sim) {
  const a=getApp(S,"pixel"); a.rogue=true;
  for (const p of ["contacts","microphone","sms"]) { a.perms[p]="approved"; S.log.unshift({kind:"change",t:Date.now(),app:a.id,msg:`requested ${PN[p]} in an update and was granted it`}); }
}
