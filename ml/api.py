import asyncio
import pandas as pd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from inference import score_app
from features import FEATURE_NAMES

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

df = pd.read_csv("edith_synthetic.csv")

def first_app(scn):
    return int(df[df.scenario == scn].app_id.iloc[0])

anomalous_apps = df[df.is_anomalous == 1].app_id.unique()
normal_id = int(df[~df.app_id.isin(anomalous_apps)].app_id.iloc[0])

DEMO = {
    "Application A": normal_id,
    "Application B": first_app("burst"),
    "Application C": first_app("permission_creep"),
}

tracks = {n: df[df.app_id == a].sort_values("day").reset_index(drop=True) for n, a in DEMO.items()}
onset = {n: (int(t.is_anomalous.values.argmax()) if t.is_anomalous.any() else None)
         for n, t in tracks.items()}

cursor = {n: 0 for n in DEMO}
armed = {n: False for n in DEMO}


def next_row(name):
    t, i = tracks[name], cursor[name]
    # Hold at the last normal row until the attack is triggered
    if onset[name] is not None and i >= onset[name] and not armed[name]:
        i = onset[name] - 1
    else:
        cursor[name] = (i + 1) % len(t)
    return t.iloc[i]


@app.post("/attack/{name}")
def attack(name: str):
    armed[name] = True
    if onset[name] is not None:
        cursor[name] = onset[name]
    return {"status": "attack started", "app": name}


@app.post("/reset")
def reset():
    for n in DEMO:
        cursor[n], armed[n] = 0, False
    return {"status": "reset"}


@app.websocket("/ws/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            payload = []
            for name in DEMO:
                row = next_row(name)
                res = score_app(row[FEATURE_NAMES].to_dict())
                payload.append({"app": name, "tick": int(row.day), **res,
                                "features": {k: float(row[k]) for k in FEATURE_NAMES}})
            await ws.send_json(payload)
            await asyncio.sleep(1)       # one tick per second
    except WebSocketDisconnect:
        pass

def build_payload():
    payload = []
    for name in DEMO:
        row = next_row(name)
        res = score_app(row[FEATURE_NAMES].to_dict())
        payload.append({"app": name, "tick": int(row.day), **res,
                        "features": {k: float(row[k]) for k in FEATURE_NAMES}})
    return payload


@app.get("/step")
def step():
    """Advance one monitoring window and return all 3 apps' scores (for testing in /docs)."""
    return build_payload()