import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the API client
jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    setAuthToken: jest.fn(),
  },
}));

// Test component to access auth context
const TestComponent: React.FC = () => {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{auth.loading.toString()}</div>
      <div data-testid="authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="user">{auth.user ? auth.user.username : 'null'}</div>
      <button onClick={() => auth.login('testuser', 'password')}>Login</button>
      <button onClick={() => auth.register('testuser', 'test@example.com', 'password')}>Register</button>
      <button onClick={() => auth.logout()}>Logout</button>
      <button onClick={() => auth.refreshToken()}>Refresh</button>
    </div>
  );
};

const renderWithAuthProvider = () => {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
};

describe('AuthContext', () => {
  const mockApiClient = require('../services/apiClient').apiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('provides initial auth state', async () => {
    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  test('initializes with existing token', async () => {
    localStorage.setItem('authToken', 'existing-token');
    mockApiClient.get.mockResolvedValue({
      data: {
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      },
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(mockApiClient.setAuthToken).toHaveBeenCalledWith('existing-token');
    expect(mockApiClient.get).toHaveBeenCalledWith('auth/me');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });

  test('handles invalid token on initialization', async () => {
    localStorage.setItem('authToken', 'invalid-token');
    localStorage.setItem('refreshToken', 'refresh-token');
    
    // Mock auth/me to fail
    mockApiClient.get.mockRejectedValue(new Error('Unauthorized'));
    
    // Mock refresh to succeed
    mockApiClient.post.mockResolvedValue({
      data: {
        token: 'new-token',
        refreshToken: 'new-refresh-token',
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      },
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(mockApiClient.post).toHaveBeenCalledWith('auth/refresh', {
      refreshToken: 'refresh-token',
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });

  test('clears auth state when refresh fails', async () => {
    localStorage.setItem('authToken', 'invalid-token');
    localStorage.setItem('refreshToken', 'invalid-refresh-token');
    
    // Mock both auth/me and refresh to fail
    mockApiClient.get.mockRejectedValue(new Error('Unauthorized'));
    mockApiClient.post.mockRejectedValue(new Error('Refresh failed'));

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  test('handles successful login', async () => {
    mockApiClient.post.mockResolvedValue({
      data: {
        token: 'login-token',
        refreshToken: 'login-refresh-token',
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      },
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await act(async () => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('auth/login', {
        username: 'testuser',
        password: 'password',
      });
    });

    expect(localStorage.getItem('authToken')).toBe('login-token');
    expect(localStorage.getItem('refreshToken')).toBe('login-refresh-token');
    expect(mockApiClient.setAuthToken).toHaveBeenCalledWith('login-token');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });

  test('handles successful registration', async () => {
    mockApiClient.post.mockResolvedValue({
      data: {
        token: 'register-token',
        refreshToken: 'register-refresh-token',
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      },
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await act(async () => {
      screen.getByText('Register').click();
    });

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('auth/register', {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password',
      });
    });

    expect(localStorage.getItem('authToken')).toBe('register-token');
    expect(localStorage.getItem('refreshToken')).toBe('register-refresh-token');
    expect(mockApiClient.setAuthToken).toHaveBeenCalledWith('register-token');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });

  test('handles logout', async () => {
    // Set up authenticated state
    localStorage.setItem('authToken', 'existing-token');
    localStorage.setItem('refreshToken', 'existing-refresh-token');
    mockApiClient.get.mockResolvedValue({
      data: {
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      },
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  test('handles manual token refresh', async () => {
    localStorage.setItem('refreshToken', 'refresh-token');
    mockApiClient.post.mockResolvedValue({
      data: {
        token: 'new-token',
        refreshToken: 'new-refresh-token',
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      },
    });

    renderWithAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await act(async () => {
      screen.getByText('Refresh').click();
    });

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('auth/refresh', {
        refreshToken: 'refresh-token',
      });
    });

    expect(localStorage.getItem('authToken')).toBe('new-token');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token');
    expect(mockApiClient.setAuthToken).toHaveBeenCalledWith('new-token');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });



  test('throws error when useAuth is used outside provider', () => {
    const TestComponentOutsideProvider = () => {
      useAuth();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponentOutsideProvider />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});