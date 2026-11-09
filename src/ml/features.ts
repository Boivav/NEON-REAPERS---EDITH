export const FEATURE_NAMES = ["access_count","frequency_ratio","unique_permissions","unexpected_permissions","night_access_ratio","denied_access_count","baseline_deviation"] as const;
export type Features = Record<(typeof FEATURE_NAMES)[number], number>;
export interface RawBehavior { access_count:number; expected_access_count:number; unique_permissions:number; unexpected_permissions:number; night_access_ratio:number; denied_access_count:number }

const r2 = (x: number) => Math.round(x * 100) / 100;
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function buildFeatures(d: RawBehavior): Features {
  const e = d.expected_access_count;
  const fr = e > 0 ? d.access_count / e : d.access_count > 0 ? d.access_count : 0;
  return {
    access_count: d.access_count,
    frequency_ratio: r2(fr),
    unique_permissions: d.unique_permissions,
    unexpected_permissions: d.unexpected_permissions,
    night_access_ratio: r2(d.night_access_ratio),
    denied_access_count: d.denied_access_count,
    baseline_deviation: r2((d.access_count - e) / Math.max(e, 1)),
  };
}

/** Rule-based risk score (0-100). Replace with a trained model later: (f: Features) => number. */
export const risk = (f: Features): number =>
  Math.round(
    35 * clamp(f.baseline_deviation / 2.5, 0, 1) +
    30 * clamp(f.unexpected_permissions / 3, 0, 1) +
    15 * clamp((f.night_access_ratio - 0.1) / 0.4, 0, 1) +
    10 * clamp(f.denied_access_count / 10, 0, 1) +
    10 * clamp((f.unique_permissions - 3) / 3, 0, 1)
  );
