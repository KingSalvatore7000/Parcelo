import { API_BASE_URL } from '../config';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, status: number, code: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ─── Session tokens ──────────────────────────────────────────────────────────
// A short access token (15 min) for every request, and a refresh token that renews it.
const ACCESS_KEY = 'parcelo_token';
const REFRESH_KEY = 'parcelo_refresh';

export const session = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  save(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Seconds until the access token expires (from its own payload), or 0 when unknown */
function secondsLeft(token: string): number {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' ? exp - Date.now() / 1000 : 0;
  } catch {
    return 0;
  }
}

let refreshing: Promise<string | null> | null = null;

/** Renew the access token with the refresh token; one call at a time. Null: signed out. */
export function renewSession(): Promise<string | null> {
  if (refreshing) return refreshing;
  const refreshToken = session.refresh();
  if (!refreshToken) return Promise.resolve(null);
  refreshing = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) session.clear();
        return null;
      }
      const body = await res.json();
      session.save(body.data.token, body.data.refreshToken);
      return body.data.token as string;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** An access token good for at least another 30 seconds, renewed if needed (for sockets) */
export async function freshAccessToken(): Promise<string | null> {
  const t = session.access();
  if (t && secondsLeft(t) > 30) return t;
  return renewSession();
}

async function request<T>(endpoint: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = session.access();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // An expired access token: renew it once and repeat the request
  if (response.status === 401 && token && !retried && (await renewSession())) {
    return request<T>(endpoint, options, true);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || 'An unexpected error occurred';
    const errorCode = data?.error || 'UNKNOWN_ERROR';
    throw new ApiError(errorMsg, response.status, errorCode, data?.details);
  }

  return data;
}

export const api = {
  auth: {
    login: (phone: string, password: string) =>
      request<{ success: boolean; data: SessionPayload }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      }),

    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: boolean; data: SessionPayload }>('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    getMe: () =>
      request<{ success: boolean; data: any }>('/auth/me'),

    logout: (refreshToken: string | null) =>
      request<{ success: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
  },

  parcels: {
    getParcels: (status?: string, search?: string, cursor?: string | null) => {
      const params = new URLSearchParams();
      if (status && status !== 'ALL') params.append('status', status);
      if (search) params.append('search', search);
      if (cursor) params.append('cursor', cursor);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return request<{ success: boolean; count: number; data: any[]; nextCursor: string | null }>(`/parcels${qs}`);
    },

    getParcelById: (id: string) =>
      request<{ success: boolean; data: any }>(`/parcels/${id}`),

    logParcel: (body: { flatId: string; courier: string; photoUrl?: string | null }) =>
      request<{ success: boolean; message: string; data: any }>('/parcels', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    completeHandover: (id: string, code: string) =>
      request<{ success: boolean; message: string; data: any }>(`/parcels/${id}/handover`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    scheduleParcel: (id: string, body: { mode: 'PICKUP' | 'DOOR'; slotStart: string; slotEnd: string }) =>
      request<{
        success: boolean;
        message: string;
        data: {
          parcelId: string;
          courier: string;
          flat: string;
          mode: 'PICKUP' | 'DOOR';
          slotStart: string;
          slotEnd: string;
          feePaise: number;
          code: string;
          expiresAt: string;
          rescheduled: boolean;
        };
      }>(`/parcels/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    getSlots: () =>
      request<{
        success: boolean;
        data: {
          slots: { start: string; end: string; day: 'today' | 'tomorrow'; label: string }[];
          fees: { PICKUP: number; DOOR: number };
        };
      }>('/parcels/slots'),

    returnParcel: (id: string) =>
      request<{ success: boolean; message: string; data: any }>(`/parcels/${id}/return`, {
        method: 'POST',
      }),

    /** image: a data:image/jpeg|png|webp;base64,... URL, at most 5 MB decoded */
    uploadPhoto: (image: string) =>
      request<{ success: boolean; photoUrl: string; previewUrl: string }>('/parcels/upload-photo', {
        method: 'POST',
        body: JSON.stringify({ image }),
      }),
  },

  flats: {
    getFlats: () =>
      request<{ success: boolean; count: number; data: any[] }>('/flats'),
  },

  admin: {
    getStats: () => request<{ success: boolean; data: AdminStats }>('/admin/stats'),

    listFlats: () => request<{ success: boolean; data: AdminFlat[] }>('/admin/flats'),
    createFlat: (body: { tower: string; number: string }) =>
      request<{ success: boolean; data: AdminFlat }>('/admin/flats', { method: 'POST', body: JSON.stringify(body) }),
    deleteFlat: (id: string) => request<{ success: boolean }>(`/admin/flats/${id}`, { method: 'DELETE' }),

    listUsers: () => request<{ success: boolean; data: AdminUser[] }>('/admin/users'),
    createUser: (body: { name: string; phone: string; role: Role; flatId?: string | null }) =>
      request<{ success: boolean; data: AdminUser & { temporaryPassword: string } }>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword: (id: string) =>
      request<{ success: boolean; data: { name: string; phone: string; temporaryPassword: string } }>(`/admin/users/${id}/reset-password`, { method: 'POST' }),
    updateUser: (id: string, body: { name?: string; role?: Role; flatId?: string | null }) =>
      request<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteUser: (id: string) => request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),

    importResidents: (body: { csv: string; createMissingFlats: boolean; dryRun: boolean }) =>
      request<{ success: boolean; data: { dryRun: boolean; rows: number; residents: number; newFlats: number; credentials?: ImportedCredential[] } }>(
        '/admin/residents/import',
        { method: 'POST', body: JSON.stringify(body) }
      ),
  },
};

export type Role = 'RESIDENT' | 'GUARD' | 'ADMIN';

export interface SessionPayload {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    phone: string;
    role: Role;
    societyId: string;
    societyName: string;
    flatId?: string | null;
    mustChangePassword: boolean;
    flat?: { id: string; tower: string; number: string; label: string } | null;
  };
}

export interface ImportedCredential {
  name: string;
  phone: string;
  flat: string;
  temporaryPassword: string;
}

export interface AdminStats {
  parcels: {
    byStatus: Record<'LOGGED' | 'SCHEDULED' | 'HANDED_OVER' | 'UNCLAIMED' | 'RETURNED', number>;
    inRoom: number;
    overdue: number;
    loggedToday: number;
    handedOverToday: number;
  };
  doorDeliveriesThisMonth: { count: number; feesPaise: number };
  people: { flats: number; residents: number; guards: number; admins: number };
  overdueParcels: {
    id: string;
    courier: string;
    status: string;
    loggedAt: string;
    daysInRoom: number;
    flat: { id: string; label: string };
    handover: { mode: 'PICKUP' | 'DOOR'; slotStart: string; slotEnd: string } | null;
  }[];
}

export interface AdminFlat {
  id: string;
  tower: string;
  number: string;
  label: string;
  residents?: { id: string; name: string; phone: string }[];
  parcelsInRoom?: number;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  flatId: string | null;
  flatLabel?: string | null;
}
