import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Reuse existing active socket if connected
    if (socketRef.current && socketRef.current.connected) {
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('⚡ Connected to Thapal WebSocket:', newSocket.id);
      setIsConnected(true);

      // Join role rooms
      if (user.role === 'GUARD' || user.role === 'ADMIN') {
        newSocket.emit('join:guard', user.societyId);
      }

      if (user.role === 'RESIDENT' && user.flatId) {
        newSocket.emit('join:flat', {
          societyId: user.societyId,
          flatId: user.flatId,
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from Thapal WebSocket');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      // Disconnect cleanly on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?.id, user?.societyId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket() {
  return useContext(SocketContext);
}
