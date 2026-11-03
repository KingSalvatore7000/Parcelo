"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = void 0;
exports.initSocketService = initSocketService;
let socketServer = null;
function initSocketService(io) {
    socketServer = io;
}
exports.socketService = {
    emitToGuards(societyId, event, payload) {
        if (socketServer) {
            socketServer.to(`society:${societyId}:guards`).emit(event, payload);
        }
    },
    emitToFlat(societyId, flatId, event, payload) {
        if (socketServer) {
            socketServer.to(`society:${societyId}:flat:${flatId}`).emit(event, payload);
        }
    },
    emitToSociety(societyId, event, payload) {
        if (socketServer) {
            socketServer.to(`society:${societyId}:guards`).emit(event, payload);
        }
    },
};
//# sourceMappingURL=socket.service.js.map