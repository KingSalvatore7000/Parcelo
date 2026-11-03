import fs from 'fs';
import path from 'path';

export interface StorageService {
  uploadPhoto(base64OrBuffer: Buffer | string, filename: string): Promise<string>;
}

export class LocalDiskStorageService implements StorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(__dirname, '../../../uploads/parcels');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadPhoto(data: Buffer | string, filename: string): Promise<string> {
    const ext = path.extname(filename) || '.jpg';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    const filePath = path.join(this.uploadDir, uniqueName);

    if (Buffer.isBuffer(data)) {
      await fs.promises.writeFile(filePath, data);
    } else if (typeof data === 'string' && data.startsWith('data:image')) {
      const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
      await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
    } else {
      await fs.promises.writeFile(filePath, data);
    }

    // Return URL path served by Express static middleware
    return `/uploads/parcels/${uniqueName}`;
  }
}

export const storageService = new LocalDiskStorageService();
