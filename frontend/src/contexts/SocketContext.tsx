import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
  joinGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { user, token } = useAuth();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelayBase = 1000; // 1 second base delay

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setIsReconnecting(false);
      setConnectionError('Failed to reconnect after multiple attempts');
      return;
    }

    const delay = reconnectDelayBase * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current += 1;
    
    setIsReconnecting(true);
    setConnectionError(null);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (socket && !socket.connected) {
        socket.connect();
      }
    }, delay);
  }, [socket]);

  const createSocket = useCallback(() => {
    if (!user || !token) return null;

    const socketUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
    
    const newSocket = io(socketUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false // We'll handle reconnection manually
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      setIsReconnecting(false);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
      clearReconnectTimeout();
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      
      // Only attempt reconnection for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
        attemptReconnect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
      setConnectionError(error.message || 'Connection failed');
      
      // Attempt reconnection on connection error
      attemptReconnect();
    });

    // Handle authentication errors
    newSocket.on('auth_error', (error) => {
      console.error('Socket authentication error:', error);
      setConnectionError('Authentication failed');
      setIsConnected(false);
      setIsReconnecting(false);
    });

    return newSocket;
  }, [user, token, attemptReconnect, clearReconnectTimeout]);

  useEffect(() => {
    const newSocket = createSocket();
    if (newSocket) {
      setSocket(newSocket);
    }

    return () => {
      clearReconnectTimeout();
      if (newSocket) {
        newSocket.close();
      }
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
    };
  }, [createSocket, clearReconnectTimeout]);

  const joinGroup = useCallback((groupId: string) => {
    if (socket && isConnected) {
      socket.emit('join_group', groupId);
    }
  }, [socket, isConnected]);

  const leaveGroup = useCallback((groupId: string) => {
    if (socket && isConnected) {
      socket.emit('leave_group', groupId);
    }
  }, [socket, isConnected]);

  const reconnect = useCallback(() => {
    if (socket && !isConnected && !isReconnecting) {
      reconnectAttemptsRef.current = 0;
      setConnectionError(null);
      attemptReconnect();
    }
  }, [socket, isConnected, isReconnecting, attemptReconnect]);

  const value: SocketContextType = {
    socket,
    isConnected,
    isReconnecting,
    connectionError,
    joinGroup,
    leaveGroup,
    reconnect
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};