import { Server as SocketIOServer } from 'socket.io';
export declare function initSocketService(io: SocketIOServer): void;
export declare const socketService: {
    emitToGuards(societyId: string, event: string, payload: any): void;
    emitToFlat(societyId: string, flatId: string, event: string, payload: any): void;
    emitToSociety(societyId: string, event: string, payload: any): void;
};
//# sourceMappingURL=socket.service.d.ts.map