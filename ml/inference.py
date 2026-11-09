from pathlib import Path
import joblib
import numpy as np
import pandas as pd

_B = joblib.load(Path(__file__).parent / "artifacts" / "edith_model.joblib")


def score_app(feats: dict) -> dict:
    x = pd.DataFrame([feats])[_B["features"]]

    anomaly = float(-_B["iso"].score_samples(_B["scaler"].transform(x))[0])
    trust = float(np.clip(_B["reg"].predict(x)[0], 0, 100))
    flagged = anomaly > _B["threshold"]

    z = ((x.iloc[0] - _B["mu"]) / _B["sd"]).sort_values(ascending=False)
    reasons = (
        [f"{k} is {z[k]:.1f} standard deviations above normal" for k in z.index[:3] if z[k] > 2]
        if flagged else []
    )

    if trust >= 70:
        level = "High trust: normal behaviour"
    elif trust >= 40:
        level = "Moderate trust: unusual activity detected"
    else:
        level = "Low trust: high-risk activity, review required"

    return dict(trust_score=round(trust, 1), trust_level=level,
                anomaly_detected=bool(flagged), reasons=reasons)