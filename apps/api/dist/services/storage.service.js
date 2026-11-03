"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.LocalDiskStorageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class LocalDiskStorageService {
    uploadDir;
    constructor() {
        this.uploadDir = path_1.default.resolve(__dirname, '../../../uploads/parcels');
        if (!fs_1.default.existsSync(this.uploadDir)) {
            fs_1.default.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async uploadPhoto(data, filename) {
        const ext = path_1.default.extname(filename) || '.jpg';
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
        const filePath = path_1.default.join(this.uploadDir, uniqueName);
        if (Buffer.isBuffer(data)) {
            await fs_1.default.promises.writeFile(filePath, data);
        }
        else if (typeof data === 'string' && data.startsWith('data:image')) {
            const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
            await fs_1.default.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
        }
        else {
            await fs_1.default.promises.writeFile(filePath, data);
        }
        // Return URL path served by Express static middleware
        return `/uploads/parcels/${uniqueName}`;
    }
}
exports.LocalDiskStorageService = LocalDiskStorageService;
exports.storageService = new LocalDiskStorageService();
//# sourceMappingURL=storage.service.js.map