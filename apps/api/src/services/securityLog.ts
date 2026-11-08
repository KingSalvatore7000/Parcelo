/**
 * Security events as one JSON line each on stdout, for the host's log search and alerts.
 * Never pass passwords, tokens or handover codes; mask phone numbers with maskPhone.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;

const WINDOW_MS = 5 * 60 * 1000;
/** More than this many of an event in 5 minutes logs one security_alert */
const SPIKE_AT: Record<string, number> = {
  login_failed: 50,
  permission_denied: 50,
  rate_limited: 30,
  handover_code_failed: 30,
  refresh_token_reuse: 5,
};

const windows = new Map<string, { start: number; count: number }>();

export const maskPhone = (phone: string) => `***${phone.slice(-4)}`;

export function securityLog(event: string, fields: Fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), type: 'security', event, ...fields }));

  const limit = SPIKE_AT[event];
  if (limit === undefined) return;
  const now = Date.now();
  let w = windows.get(event);
  if (!w || now - w.start > WINDOW_MS) {
    w = { start: now, count: 0 };
    windows.set(event, w);
  }
  w.count++;
  if (w.count === limit + 1) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), type: 'security', event: 'security_alert', spike: event, count: w.count, windowMinutes: 5 }));
  }
}
