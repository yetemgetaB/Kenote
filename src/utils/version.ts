export const APP_VERSION = "0.5.4";

// Compare semantic versions (returns true only if remote > current)
export function isNewerVersion(remote: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0);
  const r = parse(remote);
  const c = parse(current);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rVal = r[i] || 0;
    const cVal = c[i] || 0;
    if (rVal > cVal) return true;
    if (rVal < cVal) return false;
  }
  return false;
}

// Returns true if current version is greater than or equal to target version
export function isVersionAtLeast(current: string, target: string): boolean {
  if (!current || !target) return false;
  const parse = (v: string) => v.replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0);
  const c = parse(current);
  const t = parse(target);
  for (let i = 0; i < Math.max(c.length, t.length); i++) {
    const cVal = c[i] || 0;
    const tVal = t[i] || 0;
    if (cVal > tVal) return true;
    if (cVal < tVal) return false;
  }
  return true;
}