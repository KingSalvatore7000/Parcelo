import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/** apps/api/uploads (same depth from src/services and dist/services) */
export const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const PARCEL_DIR = path.join(UPLOAD_ROOT, 'parcels');

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** JSON body limit for the upload route: base64 is ~4/3 of the binary size, plus headroom */
export const MAX_UPLOAD_JSON = '8mb';

function badImage(message: string) {
  return { status: 400, code: 'INVALID_IMAGE', message };
}

/** Detect the image type from its first bytes; the client's name or MIME type is never trusted */
function detectImageExt(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export interface StorageService {
  /** Store a data:image/...;base64 photo and return its public path */
  uploadPhoto(dataUrl: unknown): Promise<string>;
}

export class LocalDiskStorageService implements StorageService {
  constructor() {
    fs.mkdirSync(PARCEL_DIR, { recursive: true });
  }

  async uploadPhoto(dataUrl: unknown): Promise<string> {
    if (typeof dataUrl !== 'string') {
      throw badImage('Photo must be sent as a base64 data URL.');
    }
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
    if (!match) {
      throw badImage('Only JPEG, PNG or WebP photos are accepted.');
    }

    const buf = Buffer.from(match[2], 'base64');
    if (buf.length === 0) throw badImage('The photo is empty.');
    if (buf.length > MAX_PHOTO_BYTES) throw badImage('The photo is larger than 5 MB.');

    const ext = detectImageExt(buf);
    if (!ext) throw badImage('The file is not a valid JPEG, PNG or WebP image.');

    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    await fs.promises.writeFile(path.join(PARCEL_DIR, name), buf, { flag: 'wx' });
    return `/uploads/parcels/${name}`;
  }
}

export const storageService = new LocalDiskStorageService();
