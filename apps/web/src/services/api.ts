const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('parcelo_token');

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
    requestOtp: (phone: string) =>
      request<{ success: boolean; message: string; expiresInSeconds: number; devOtp?: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),

    verifyOtp: (phone: string, otp: string) =>
      request<{
        success: boolean;
        data: {
          token: string;
          user: {
            id: string;
            name: string;
            phone: string;
            role: 'RESIDENT' | 'GUARD' | 'ADMIN';
            societyId: string;
            societyName: string;
            flatId?: string | null;
            flat?: { id: string; tower: string; number: string; label: string } | null;
          };
        };
      }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      }),

    getMe: () =>
      request<{ success: boolean; data: any }>('/auth/me'),
  },

  parcels: {
    getParcels: (status?: string, search?: string) => {
      const params = new URLSearchParams();
      if (status && status !== 'ALL') params.append('status', status);
      if (search) params.append('search', search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return request<{ success: boolean; count: number; data: any[] }>(`/parcels${qs}`);
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
          fee: number;
          code: string;
          expiresAt: string;
        };
      }>(`/parcels/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    uploadPhoto: (image: string, filename?: string) =>
      request<{ success: boolean; photoUrl: string }>('/parcels/upload-photo', {
        method: 'POST',
        body: JSON.stringify({ image, filename }),
      }),
  },

  flats: {
    getFlats: () =>
      request<{ success: boolean; count: number; data: any[] }>('/flats'),
  },
};
