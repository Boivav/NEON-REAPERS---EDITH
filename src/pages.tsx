import { useState } from "react";
import { Sim, AppState, W, PN, Status, getApp, recs, allRecs } from "./engine";
import { FEATURE_NAMES } from "./ml/features";
import { Ring, Chart, Chips, RecItem, AlertItem, LogRow, Act, tc, lvl } from "./ui";

type P = { S:Sim; act:Act };
const Empty = ({children}:{children:string}) => <p style={{color:"var(--mut)",margin:0}}>{children}</p>;

export function Dashboard({S,act}:P) {
  const open=S.alerts.filter(a=>a.state==="open"), avg=S.apps.reduce((s,a)=>s+a.trust,0)/S.apps.length, bad=S.apps.filter(a=>a.trust<50).length;
  const rg=S.apps.find(a=>a.rogue&&a.trust<50), rs=allRecs(S);
  return (<>
    {rg && <div className="banner">{rg.name} is behaving abnormally. Review the recommendations below.</div>}
    <div className="grid g4" style={{marginBottom:14}}>
      <div className="card stat"><b style={{color:tc(avg)}}>{Math.round(avg)}</b><span>Average trust score</span></div>
      <div className="card stat"><b>{open.length}</b><span>Open alerts</span></div>
      <div className="card stat"><b style={{color:bad?"var(--bad)":"var(--good)"}}>{bad}</b><span>Apps at high risk</span></div>
      <div className="card stat"><b>{S.apps.reduce((s,a)=>s+a.f.access_count,0)}</b><span>Allowed accesses, last {W} ticks</span></div>
    </div>
    <div className="grid g3">
      {S.apps.map(a=>(
        <a key={a.id} className="card app" href={`#app-${a.id}`}><Ring t={a.trust}/>
          <div className="t"><b>{a.icon} {a.name}</b><div style={{color:tc(a.trust),fontSize:13,fontWeight:600}}>{lvl(a.trust)}</div>
            <small style={{color:"var(--mut)"}}>{Object.keys(a.perms).length} permissions · {a.f.access_count} accesses</small></div></a>
      ))}
    </div>
    <div className="grid g2" style={{marginTop:14}}>
      <div className="card"><h3>Trust over time</h3><Chart ser={S.apps.map(a=>({c:a.col,n:a.name,d:a.hist}))}/></div>
      <div className="card"><h3>Recommended actions</h3>
        {rs.length ? rs.map(r=><RecItem key={r.app+r.perm} S={S} r={r} act={act}/>) : <Empty>No actions needed. Every app is within its normal range.</Empty>}
        <h3 style={{marginTop:14}}>Recent alerts</h3>
        {S.alerts.length ? S.alerts.slice(0,4).map(x=><AlertItem key={x.id} S={S} x={x}/>) : <Empty>No alerts yet. Try “Simulate rogue app”.</Empty>}
      </div>
    </div>
  </>);
}

export function Applications({S}:P) {
  return (<><h2>Applications</h2><div className="grid">
    {S.apps.map(a=>(
      <a key={a.id} className="card app" href={`#app-${a.id}`} style={{alignItems:"flex-start"}}><Ring t={a.trust} s={72}/>
        <div className="t"><b>{a.icon} {a.name}</b> <span className="badge" style={{color:tc(a.trust)}}>{lvl(a.trust)}</span>
          <div style={{margin:"6px 0"}}><Chips a={a}/></div>
          <small style={{color:"var(--mut)"}}>Frequency {a.f.frequency_ratio}× baseline · night {Math.round(a.f.night_access_ratio*100)}% · denied {a.f.denied_access_count}</small></div></a>
    ))}
  </div></>);
}

export function Detail({S,act,a}:P & {a:AppState}) {
  const rs=recs(a);
  const B=({p,st,l}:{p:string;st:Status;l:string})=><button className="btn" disabled={a.perms[p]===st} onClick={()=>act.perm(a.id,p,st)}>{l}</button>;
  return (<>
    <p><a href="#apps" style={{color:"var(--acc)"}}>Back to applications</a></p>
    <div className="card app" style={{cursor:"default",marginBottom:14}}><Ring t={a.trust} s={84}/>
      <div className="t"><h2 style={{margin:0}}>{a.icon} {a.name}</h2><span className="badge" style={{color:tc(a.trust)}}>{lvl(a.trust)}</span></div></div>
    <div className="grid g2">
      <div className="card"><h3>Permissions</h3>
        {Object.entries(a.perms).map(([p,st])=>(
          <div className="perm" key={p}>
            <div><b>{PN[p]}</b> <span className={`chip ${st}`}>{st}</span>{!a.exp.includes(p)&&<small style={{color:"var(--bad)"}}>Not in this app’s declared behavior</small>}</div>
            <div className="b"><B p={p} st="approved" l="Approve"/><B p={p} st="restricted" l="Restrict"/><B p={p} st="suspended" l="Suspend"/><B p={p} st="revoked" l="Revoke"/></div>
          </div>))}
      </div>
      <div className="card"><h3>Trust trend</h3><Chart ser={[{c:a.col,n:a.name,d:a.hist}]}/>
        <h3 style={{marginTop:12}}>Recommendations</h3>
        {rs.length ? rs.map(r=><RecItem key={r.perm} S={S} r={r} act={act}/>) : <Empty>Nothing to act on right now.</Empty>}
      </div>
    </div>
    <div className="card" style={{marginTop:14}}><h3>Behavior features (last {W} ticks)</h3>
      <div className="grid g4">{FEATURE_NAMES.map(k=><div className="feat" key={k}><small>{k}</small><b>{a.f[k]}</b></div>)}</div></div>
    <div className="card" style={{marginTop:14}}><h3>Recent access</h3>{S.log.filter(e=>e.app===a.id).slice(0,10).map((e,i)=><LogRow key={i} S={S} e={e}/>)}</div>
  </>);
}

export function Alerts({S,act}:P) {
  const r=allRecs(S);
  return (<div className="grid g2">
    <div className="card"><h3>Recommendations</h3>
      {r.length ? r.map(x=><RecItem key={x.app+x.perm} S={S} r={x} act={act}/>) : <Empty>No recommended actions.</Empty>}
      {r.length>0 && <p><button className="btn pri" onClick={act.all}>Apply all</button></p>}</div>
    <div className="card"><h3>Alerts</h3>
      {S.alerts.length ? S.alerts.slice(0,15).map(x=><AlertItem key={x.id} S={S} x={x} act={act}/>) : <Empty>No alerts yet.</Empty>}</div>
  </div>);
}

export function Activity({S}:{S:Sim}) {
  const [app,setApp]=useState("all"), [type,setType]=useState("all"), [q,setQ]=useState("");
  const ql=q.toLowerCase();
  const l=S.log.filter(e=>(app==="all"||e.app===app)&&(type==="all"||(type==="denied"?e.kind==="access"&&!e.ok:e.kind===type))&&(!ql||`${PN[e.perm||""]||""} ${e.reason||""} ${e.msg||""}`.toLowerCase().includes(ql))).slice(0,80);
  return (<><h2>Activity</h2>
    <div className="fl">
      <select value={app} onChange={e=>setApp(e.target.value)}><option value="all">All apps</option>{S.apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select value={type} onChange={e=>setType(e.target.value)}><option value="all">All events</option><option value="access">Access</option><option value="denied">Denied</option><option value="alert">Alerts</option><option value="change">Permission changes</option></select>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search resource or reason" style={{flex:1,minWidth:180}}/>
    </div>
    <div className="card">{l.length ? l.map((e,i)=><LogRow key={i} S={S} e={e}/>) : <Empty>No events match these filters.</Empty>}</div></>);
}
export { getApp };
