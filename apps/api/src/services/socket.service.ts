import { Server as SocketIOServer } from 'socket.io';

let socketServer: SocketIOServer | null = null;

export const guardRoom = (societyId: string) => `society:${societyId}:guards`;
export const flatRoom = (societyId: string, flatId: string) => `society:${societyId}:flat:${flatId}`;

export function initSocketService(io: SocketIOServer) {
  socketServer = io;
}

export const socketService = {
  emitToGuards(societyId: string, event: string, payload: unknown) {
    socketServer?.to(guardRoom(societyId)).emit(event, payload);
  },

  emitToFlat(societyId: string, flatId: string, event: string, payload: unknown) {
    socketServer?.to(flatRoom(societyId, flatId)).emit(event, payload);
  },
};
