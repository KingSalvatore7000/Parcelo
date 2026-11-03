export interface StorageService {
    uploadPhoto(base64OrBuffer: Buffer | string, filename: string): Promise<string>;
}
export declare class LocalDiskStorageService implements StorageService {
    private uploadDir;
    constructor();
    uploadPhoto(data: Buffer | string, filename: string): Promise<string>;
}
export declare const storageService: LocalDiskStorageService;
//# sourceMappingURL=storage.service.d.ts.map