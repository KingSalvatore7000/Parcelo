import { UserRole, ParcelStatus, HandoverMode, NotificationChannel, NotificationStatus } from './enums';

export interface SocietyDTO {
  id: string;
  name: string;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlatDTO {
  id: string;
  societyId: string;
  tower: string;
  number: string;
  label?: string; // e.g. "Tower A - 1204"
}

export interface UserDTO {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  societyId: string;
  flatId?: string | null;
  flat?: FlatDTO | null;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

export interface HandoverDTO {
  id: string;
  parcelId: string;
  mode: HandoverMode;
  slotStart: string;
  slotEnd: string;
  otpAttempts: number;
  fee: number;
  completedAt?: string | null;
  completedById?: string | null;
  completedByName?: string | null;
}

export interface ParcelDTO {
  id: string;
  societyId: string;
  flatId: string;
  flat?: FlatDTO;
  courier: string;
  photoUrl?: string | null;
  status: ParcelStatus;
  loggedById: string;
  loggedByName?: string;
  loggedAt: string;
  updatedAt: string;
  handover?: HandoverDTO | null;
}

export interface HandoverStampDTO {
  parcelId: string;
  code: string; // 4-digit code shown only to resident
  expiresAt: string;
  mode: HandoverMode;
  slotStart: string;
  slotEnd: string;
  fee: number;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  parcelId?: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: string | null;
  metadata?: string | null;
}

export interface AdminStatsDTO {
  totalParcels: number;
  loggedCount: number;
  scheduledCount: number;
  handedOverCount: number;
  unclaimedCount: number;
  pickupCount: number;
  doorCount: number;
  totalFlats: number;
  totalResidents: number;
}
