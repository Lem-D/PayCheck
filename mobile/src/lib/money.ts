const fmt = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export const money = (n: unknown) => fmt.format(Number(n) || 0);
export const cents = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
export const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
export const total = <T,>(xs: T[], pick: (x: T) => number) => xs.reduce((t, x) => t + (Number(pick(x)) || 0), 0);
export const uid = () => Math.random().toString(36).slice(2, 10);
