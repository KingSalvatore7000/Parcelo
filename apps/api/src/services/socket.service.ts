import { Server as SocketIOServer } from 'socket.io';

let socketServer: SocketIOServer | null = null;

export const guardRoom = (societyId: string) => `society:${societyId}:guards`;
export const flatRoom = (societyId: string, flatId: string) => `society:${societyId}:flat:${flatId}`;

export const userRoom = (userId: string) => `user:${userId}`;

export function initSocketService(io: SocketIOServer) {
  socketServer = io;
}

export const socketService = {
  /** Sessions ended or the person's role or flat changed: they must reconnect and be checked again */
  disconnectUser(userId: string) {
    socketServer?.in(userRoom(userId)).disconnectSockets(true);
  },

  emitToGuards(societyId: string, event: string, payload: unknown) {
    socketServer?.to(guardRoom(societyId)).emit(event, payload);
  },

  emitToFlat(societyId: string, flatId: string, event: string, payload: unknown) {
    socketServer?.to(flatRoom(societyId, flatId)).emit(event, payload);
  },
};
