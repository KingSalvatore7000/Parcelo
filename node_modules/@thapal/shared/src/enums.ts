export enum UserRole {
  RESIDENT = 'RESIDENT',
  GUARD = 'GUARD',
  ADMIN = 'ADMIN',
}

export enum ParcelStatus {
  LOGGED = 'LOGGED',
  SCHEDULED = 'SCHEDULED',
  HANDED_OVER = 'HANDED_OVER',
  UNCLAIMED = 'UNCLAIMED',
  RETURNED = 'RETURNED',
}

export enum HandoverMode {
  PICKUP = 'PICKUP',
  DOOR = 'DOOR',
}

export enum NotificationChannel {
  PUSH = 'PUSH',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export const COMMON_COURIERS = [
  'Amazon',
  'Flipkart',
  'Blue Dart',
  'Delhivery',
  'DTDC',
  'India Post',
  'Swiggy Instamart',
  'Blinkit',
  'Zepto',
  'Myntra',
  'DHL',
  'FedEx',
  'Other',
] as const;
