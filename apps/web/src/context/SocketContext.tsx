import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL as SOCKET_URL } from '../config';

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

    // The server checks this token and puts the socket in the right rooms itself
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: (cb) => cb({ token: localStorage.getItem('parcelo_token') }),
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Live updates unavailable:', err.message);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from Parcelo WebSocket');
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
