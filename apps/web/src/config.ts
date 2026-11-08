export const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Demo shortcuts (one-click logins, role switcher, sample photo) show on the Vite dev
 * server, or in a build made with VITE_DEMO_MODE=true. Never in a normal production build.
 */
export const DEMO_MODE: boolean = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

/** Password of the seeded demo accounts (apps/api/prisma/seed.ts); used by the demo profiles only */
export const DEMO_PASSWORD = DEMO_MODE ? 'Demo@1234' : '';

/** 2000 paise → "₹20", 2050 → "₹20.50", 0 → "Free" */
export function formatFee(paise: number | null | undefined): string {
  if (!paise) return 'Free';
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}

/** Turn an API-relative path such as /uploads/parcels/x.jpg into a full URL */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;
}
