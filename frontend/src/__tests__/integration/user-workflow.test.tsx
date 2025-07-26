import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { AuthProvider } from '../../contexts/AuthContext';
import { SocketProvider } from '../../contexts/SocketContext';

// Mock API client
jest.mock('../../services/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  setAuthToken: jest.fn()
}));

// Mock socket.io-client
jest.mock('socket.io-client');

import * as apiClient from '../../services/apiClient';
import io from 'socket.io-client';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockIo = io as jest.MockedFunction<typeof io>;

describe('Complete User Workflow Integration Tests', () => {
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock socket
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connected: true
    };
    
    mockIo.mockReturnValue(mockSocket);
    
    // Clear localStorage
    localStorage.clear();
  });

  const renderApp = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  };

  describe('Complete Group Activity Voting Flow', () => {
    it('should complete full user journey: register -> create group -> invite -> propose -> vote -> see result', async () => {
      const user = userEvent.setup();
      
      // Mock API responses
      mockApiClient.post.mockImplementation((url, data) => {
        if (url === '/api/auth/register') {
          return Promise.resolve({
            data: {
              accessToken: 'mock-token',
              refreshToken: 'mock-refresh',
              user: { id: '1', username: 'testuser', email: 'test@example.com' }
            }
          });
        }
        if (url === '/api/groups') {
          return Promise.resolve({
            data: {
              group: {
                id: 'group-1',
                name: data.name,
                inviteToken: 'invite-123',
                members: [{ id: '1', username: 'testuser' }]
              }
            }
          });
        }
        if (url.includes('/activities')) {
          return Promise.resolve({
            data: {
              activity: {
                id: 'activity-1',
                title: data.title,
                description: data.description,
                isChosen: false
              }
            }
          });
        }
        if (url.includes('/vote')) {
          return Promise.resolve({
            data: { message: 'Vote recorded' }
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      mockApiClient.get.mockImplementation((url) => {
        if (url === '/api/groups') {
          return Promise.resolve({
            data: {
              groups: [{
                id: 'group-1',
                name: 'Test Group',
                inviteToken: 'invite-123'
              }]
            }
          });
        }
        if (url.includes('/api/groups/group-1')) {
          return Promise.resolve({
            data: {
              group: {
                id: 'group-1',
                name: 'Test Group',
                members: [
                  { id: '1', username: 'testuser' },
                  { id: '2', username: 'testuser2' }
                ]
              }
            }
          });
        }
        if (url.includes('/activities')) {
          return Promise.resolve({
            data: {
              activities: [{
                id: 'activity-1',
                title: 'Go to movies',
                description: 'Watch latest film',
                isChosen: true // Activity achieved majority
              }]
            }
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      renderApp();

      // Step 1: User Registration
      expect(screen.getByText(/login/i)).toBeInTheDocument();
      
      const registerLink = screen.getByText(/register/i);
      await user.click(registerLink);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      
      const registerButton = screen.getByRole('button', { name: /register/i });
      await user.click(registerButton);

      // Should redirect to groups page after registration
      await waitFor(() => {
        expect(screen.getByText(/my groups/i)).toBeInTheDocument();
      });

      // Step 2: Create Group
      const createGroupButton = screen.getByText(/create group/i);
      await user.click(createGroupButton);

      await user.type(screen.getByLabelText(/group name/i), 'Test Group');
      
      const submitGroupButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitGroupButton);

      // Should show group in list
      await waitFor(() => {
        expect(screen.getByText('Test Group')).toBeInTheDocument();
      });

      // Step 3: Enter Group
      const groupLink = screen.getByText('Test Group');
      await user.click(groupLink);

      // Should show group detail page
      await waitFor(() => {
        expect(screen.getByText(/members/i)).toBeInTheDocument();
        expect(screen.getByText(/activities/i)).toBeInTheDocument();
      });

      // Step 4: Propose Activity
      const proposeButton = screen.getByText(/propose activity/i);
      await user.click(proposeButton);

      await user.type(screen.getByLabelText(/title/i), 'Go to movies');
      await user.type(screen.getByLabelText(/description/i), 'Watch latest film');
      
      const submitActivityButton = screen.getByRole('button', { name: /propose/i });
      await user.click(submitActivityButton);

      // Should show activity in list
      await waitFor(() => {
        expect(screen.getByText('Go to movies')).toBeInTheDocument();
      });

      // Step 5: Vote on Activity
      const voteButton = screen.getByRole('button', { name: /vote/i });
      await user.click(voteButton);

      // Should show vote confirmation
      await waitFor(() => {
        expect(screen.getByText(/vote recorded/i)).toBeInTheDocument();
      });

      // Step 6: See Majority Result
      // Mock real-time update for majority achieved
      const activityChosenHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'group:activity_chosen'
      )?.[1];

      if (activityChosenHandler) {
        activityChosenHandler({
          activityId: 'activity-1',
          isChosen: true
        });
      }

      // Should show chosen status
      await waitFor(() => {
        expect(screen.getByText(/chosen/i)).toBeInTheDocument();
      });

      // Verify privacy: no vote counts or voter information displayed
      expect(screen.queryByText(/vote count/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/voters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/percentage/i)).not.toBeInTheDocument();
    });

    it('should handle group invitation flow', async () => {
      const user = userEvent.setup();

      // Mock join group API
      mockApiClient.post.mockImplementation((url) => {
        if (url.includes('/join')) {
          return Promise.resolve({
            data: { message: 'Joined group successfully' }
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      // Simulate navigation to join page with invite token
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/join/invite-123'
        },
        writable: true
      });

      renderApp();

      // Should show join group page
      await waitFor(() => {
        expect(screen.getByText(/join group/i)).toBeInTheDocument();
      });

      const joinButton = screen.getByRole('button', { name: /join/i });
      await user.click(joinButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/joined group successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle real-time activity updates', async () => {
      const user = userEvent.setup();

      // Mock authenticated state
      localStorage.setItem('accessToken', 'mock-token');
      
      mockApiClient.get.mockImplementation((url) => {
        if (url === '/api/groups') {
          return Promise.resolve({ data: { groups: [] } });
        }
        if (url.includes('/activities')) {
          return Promise.resolve({
            data: {
              activities: [{
                id: 'activity-1',
                title: 'Initial Activity',
                isChosen: false
              }]
            }
          });
        }
        return Promise.reject(new Error('Unexpected API call'));
      });

      renderApp();

      // Navigate to group page
      await waitFor(() => {
        expect(screen.getByText(/my groups/i)).toBeInTheDocument();
      });

      // Simulate real-time new activity
      const newActivityHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'group:activity_added'
      )?.[1];

      if (newActivityHandler) {
        newActivityHandler({
          activity: {
            id: 'activity-2',
            title: 'New Real-time Activity',
            description: 'Added via WebSocket',
            isChosen: false
          }
        });
      }

      // Should show new activity
      await waitFor(() => {
        expect(screen.getByText('New Real-time Activity')).toBeInTheDocument();
      });

      // Simulate activity chosen update
      const activityChosenHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'group:activity_chosen'
      )?.[1];

      if (activityChosenHandler) {
        activityChosenHandler({
          activityId: 'activity-2',
          isChosen: true
        });
      }

      // Should show chosen status
      await waitFor(() => {
        expect(screen.getByText(/chosen/i)).toBeInTheDocument();
      });
    });

    it('should handle member join notifications', async () => {
      localStorage.setItem('accessToken', 'mock-token');
      
      renderApp();

      // Simulate member joined event
      const memberJoinedHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'group:member_joined'
      )?.[1];

      if (memberJoinedHandler) {
        memberJoinedHandler({
          member: {
            id: 'user-3',
            username: 'newmember'
          }
        });
      }

      // Should show notification
      await waitFor(() => {
        expect(screen.getByText(/newmember joined/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock API error
      mockApiClient.post.mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'Invalid group name' }
        }
      });

      renderApp();

      // Try to create group with error
      const createButton = screen.getByText(/create group/i);
      await user.click(createButton);

      await user.type(screen.getByLabelText(/group name/i), '');
      
      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid group name/i)).toBeInTheDocument();
      });
    });

    it('should handle WebSocket disconnection', async () => {
      localStorage.setItem('accessToken', 'mock-token');
      
      renderApp();

      // Simulate socket disconnection
      mockSocket.connected = false;
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        disconnectHandler();
      }

      // Should show offline indicator
      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeInTheDocument();
      });

      // Simulate reconnection
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        connectHandler();
      }

      // Should hide offline indicator
      await waitFor(() => {
        expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
      });
    });

    it('should handle authentication expiration', async () => {
      const user = userEvent.setup();

      // Mock expired token response
      mockApiClient.get.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Token expired' }
        }
      });

      localStorage.setItem('accessToken', 'expired-token');
      
      renderApp();

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Token should be cleared
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });
});