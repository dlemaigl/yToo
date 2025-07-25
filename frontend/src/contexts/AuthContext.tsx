import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/apiClient';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshToken = async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiClient.post('/auth/refresh', {
        refreshToken: storedRefreshToken,
      });

      const { token, refreshToken: newRefreshToken, user: userData } = response.data;
      
      localStorage.setItem('authToken', token);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      apiClient.setAuthToken(token);
      setToken(token);
      setUser(userData);
    } catch (error) {
      // Refresh failed, clear all tokens
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      apiClient.setAuthToken(null);
      setToken(null);
      setUser(null);
      throw error;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        try {
          // Set the token in the API client
          apiClient.setAuthToken(storedToken);
          setToken(storedToken);
          
          // Verify token is still valid by making a request
          const response = await apiClient.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          // Token is invalid, try to refresh
          try {
            await refreshToken();
          } catch (refreshError) {
            // Refresh failed, clear auth state
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            apiClient.setAuthToken(null);
            setToken(null);
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });

      const { token, refreshToken: newRefreshToken, user: userData } = response.data;
      
      localStorage.setItem('authToken', token);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      apiClient.setAuthToken(token);
      setToken(token);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/register', {
        username,
        email,
        password,
      });

      const { token, refreshToken: newRefreshToken, user: userData } = response.data;
      
      localStorage.setItem('authToken', token);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      apiClient.setAuthToken(token);
      setToken(token);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    apiClient.setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};