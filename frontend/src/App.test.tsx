import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

// Mock the API client
jest.mock('./services/apiClient', () => ({
  apiClient: {
    setAuthToken: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

test('renders app without crashing', () => {
  renderWithProviders(<App />);
  // The app should render the login page when not authenticated
  expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'yToo' })).toBeInTheDocument();
  expect(screen.getByLabelText('Username')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
});