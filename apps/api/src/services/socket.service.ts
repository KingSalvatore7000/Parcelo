import { Server as SocketIOServer } from 'socket.io';

let socketServer: SocketIOServer | null = null;

export function initSocketService(io: SocketIOServer) {
  socketServer = io;
}

export const socketService = {
  emitToGuards(societyId: string, event: string, payload: any) {
    if (socketServer) {
      socketServer.to(`society:${societyId}:guards`).emit(event, payload);
    }
  },

  emitToFlat(societyId: string, flatId: string, event: string, payload: any) {
    if (socketServer) {
      socketServer.to(`society:${societyId}:flat:${flatId}`).emit(event, payload);
    }
  },

  emitToSociety(societyId: string, event: string, payload: any) {
    if (socketServer) {
      socketServer.to(`society:${societyId}:guards`).emit(event, payload);
    }
  },
};
