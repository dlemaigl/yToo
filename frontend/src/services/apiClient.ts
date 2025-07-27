import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';

interface ApiError {
  message: string;
  status: number;
  code?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    
    // Initialize with stored token if available
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      console.log('Initializing API client with stored token');
      this.setAuthToken(storedToken);
    }
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Debug: Log the authorization header
        console.log('API Request:', config.method?.toUpperCase(), config.url);
        console.log('Authorization header:', config.headers?.Authorization);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        const apiError: ApiError = {
          message: 'An unexpected error occurred',
          status: error.response?.status || 500,
        };

        if (error.response?.data) {
          const errorData = error.response.data as any;
          apiError.message = errorData.message || errorData.error || apiError.message;
          apiError.code = errorData.code;
        } else if (error.request) {
          apiError.message = 'Network error - please check your connection';
        }

        // Handle authentication errors
        if (error.response?.status === 401) {
          // Token expired or invalid - try to refresh
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken && !error.config?.url?.includes('auth/refresh')) {
            try {
              const refreshResponse = await this.post('auth/refresh', {
                refreshToken,
              });
              
              const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
              localStorage.setItem('authToken', accessToken);
              if (newRefreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
              }
              this.setAuthToken(accessToken);
              
              // Retry the original request
              if (error.config) {
                error.config.headers['Authorization'] = `Bearer ${accessToken}`;
                return this.client.request(error.config);
              }
            } catch (refreshError) {
              // Refresh failed, clear tokens and redirect
              localStorage.removeItem('authToken');
              localStorage.removeItem('refreshToken');
              this.setAuthToken(null);
              
              // Only redirect if not already on login/register page
              if (!window.location.pathname.includes('/login') && 
                  !window.location.pathname.includes('/register')) {
                window.location.href = '/login';
              }
            }
          } else {
            // No refresh token or refresh endpoint failed
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            this.setAuthToken(null);
            
            // Only redirect if not already on login/register page
            if (!window.location.pathname.includes('/login') && 
                !window.location.pathname.includes('/register')) {
              window.location.href = '/login';
            }
          }
        }

        return Promise.reject(apiError);
      }
    );
  }

  setAuthToken(token: string | null) {
    console.log('Setting auth token:', token ? 'Token set' : 'Token cleared');
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  async get(url: string, config?: any) {
    return this.client.get(url, config);
  }

  async post(url: string, data?: any, config?: any) {
    return this.client.post(url, data, config);
  }

  async put(url: string, data?: any, config?: any) {
    return this.client.put(url, data, config);
  }

  async delete(url: string, config?: any) {
    return this.client.delete(url, config);
  }
}

export const apiClient = new ApiClient();