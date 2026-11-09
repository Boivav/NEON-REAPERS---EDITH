import { useEffect, useReducer, useRef, useState } from "react";
import { createSim, tick, setPerm, triggerRogue, allRecs, getApp, Sim } from "./engine";
import { Act } from "./ui";
import { Dashboard, Applications, Detail, Alerts, Activity } from "./pages";

const TABS: [string,string][] = [["dashboard","Dashboard"],["apps","Applications"],["activity","Activity"],["alerts","Alerts"]];
const readRoute = () => location.hash.slice(1) || "dashboard";

export default function App() {
  const ref = useRef<Sim>(); if (!ref.current) ref.current = createSim();
  const S = ref.current;
  const [, force] = useReducer((x:number)=>x+1, 0);
  const [route, setRoute] = useState(readRoute());
  const pressed = useRef(false);

  useEffect(() => {
    const hash = () => { setRoute(readRoute()); scrollTo(0,0); };
    const dn = () => (pressed.current = true), up = () => (pressed.current = false);
    addEventListener("hashchange", hash); addEventListener("pointerdown", dn); addEventListener("pointerup", up); addEventListener("pointercancel", up);
    const id = setInterval(() => { if (S.run) { tick(S); if (!pressed.current) force(); } }, 1500);
    return () => { clearInterval(id); removeEventListener("hashchange", hash); removeEventListener("pointerdown", dn); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
  }, [S]);

  const act: Act = {
    perm: (app, p, st) => { setPerm(S, app, p, st); force(); },
    all: () => { allRecs(S).forEach(r => setPerm(S, r.app, r.perm, r.st)); force(); },
    dismiss: id => { const x = S.alerts.find(a => a.id === id); if (x) x.state = "dismissed"; force(); },
  };

  const base = route.startsWith("app-") ? "apps" : route;
  const open = S.alerts.filter(a => a.state === "open").length;
  const detailApp = route.startsWith("app-") ? S.apps.find(a => a.id === route.slice(4)) : undefined;
  const rogueOn = S.apps.some(a => a.rogue);

  return (<>
    <header>
      <div className="brand">E.D.I.T.H.<small>Enhanced Digital Identity, Trust &amp; Heuristics</small></div>
      <nav>{TABS.map(([k,l]) => <a key={k} href={`#${k}`} className={k===base?"on":""}>{l}{k==="alerts"&&open?` (${open})`:""}</a>)}</nav>
      <div className="ctl">
        <span className={"live"+(S.run?"":" off")}><i />{S.run?"Live":"Paused"}</span>
        <button className="btn danger" disabled={rogueOn} onClick={()=>{ triggerRogue(S); force(); }}>Simulate rogue app</button>
        <button className="btn" onClick={()=>{ S.run=!S.run; force(); }}>{S.run?"Pause":"Resume"}</button>
        <button className="btn" onClick={()=>{ Object.assign(S, createSim()); force(); }}>Reset</button>
        <button className="btn" onClick={()=>{ const h=document.documentElement; h.dataset.theme = h.dataset.theme==="dark"?"light":"dark"; }}>Theme</button>
      </div>
    </header>
    <main>
      {detailApp ? <Detail S={S} act={act} a={detailApp}/> : route==="apps" ? <Applications S={S} act={act}/> : route==="activity" ? <Activity S={S}/> : route==="alerts" ? <Alerts S={S} act={act}/> : <Dashboard S={S} act={act}/>}
    </main>
  </>);
}
