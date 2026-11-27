/** Paise arithmetic. DB2 DECIMAL and COBOL COMP-3 do not use binary floats. */

export function toPaise(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function fromPaise(paise) {
  return paise / 100;
}

export function addMoney(a, b) {
  return fromPaise(toPaise(a) + toPaise(b));
}

export function subMoney(a, b) {
  return fromPaise(toPaise(a) - toPaise(b));
}

export function moneyEqual(a, b) {
  return toPaise(a) === toPaise(b);
}

/** Half-up to the paise, matching COBOL COMPUTE ... ROUNDED for positive amounts. */
export function interestPaise(balance, ratePercent, days) {
  if (days <= 0 || ratePercent <= 0) return 0;
  const b = toPaise(balance);
  return Math.round((b * (ratePercent / 100) * days) / 365);
}

export function parseAmount(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const paise = toPaise(text);
  if (!Number.isFinite(paise) || paise <= 0) return null;
  if (paise > 100000000) return null;
  return fromPaise(paise);
}

export function todayISO(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

export function nowStamp(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 19).replace('T', ' ');
}

export function daysBetween(from, to) {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export function addYears(iso, years) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  return dt.toISOString().slice(0, 10);
}
