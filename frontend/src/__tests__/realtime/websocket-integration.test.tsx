import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { SocketProvider } from '../../contexts/SocketContext';
import GroupDetailPage from '../../pages/GroupDetailPage';
import { useRealTimeUpdates } from '../../hooks/useRealTimeUpdates';

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
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

const mockIo = io as jest.MockedFunction<typeof io>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test component that uses real-time updates
const TestRealTimeComponent: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { activities, members, isConnected } = useRealTimeUpdates(groupId);

  return (
    <div>
      <div data-testid="connection-status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="activities">
        {activities.map(activity => (
          <div key={activity.id} data-testid={`activity-${activity.id}`}>
            <span>{activity.title}</span>
            {activity.isChosen && <span data-testid="chosen-badge">Chosen</span>}
          </div>
        ))}
      </div>
      <div data-testid="members">
        {members.map(member => (
          <div key={member.id} data-testid={`member-${member.id}`}>
            {member.username}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('WebSocket Real-time Integration Tests', () => {
  let mockSocket: any;
  let socketEventHandlers: { [key: string]: Function } = {};

  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
    
    mockSocket = {
      on: jest.fn((event: string, handler: Function) => {
        socketEventHandlers[event] = handler;
      }),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connected: true,
      id: 'mock-socket-id'
    };
    
    mockIo.mockReturnValue(mockSocket);
    
    // Mock initial API calls
    mockApiClient.get.mockImplementation((url) => {
      if (url.includes('/activities')) {
        return Promise.resolve({
          data: {
            activities: [
              {
                id: 'activity-1',
                title: 'Initial Activity',
                description: 'Pre-existing activity',
                isChosen: false
              }
            ]
          }
        });
      }
      if (url.includes('/groups/')) {
        return Promise.resolve({
          data: {
            group: {
              id: 'group-1',
              name: 'Test Group',
              members: [
                { id: 'user-1', username: 'testuser1' },
                { id: 'user-2', username: 'testuser2' }
              ]
            }
          }
        });
      }
      return Promise.reject(new Error('Unexpected API call'));
    });

    localStorage.setItem('accessToken', 'mock-token');
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            {component}
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  };

  describe('Real-time Activity Updates', () => {
    it('should receive and display new activities in real-time', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      // Simulate new activity event
      act(() => {
        if (socketEventHandlers['group:activity_added']) {
          socketEventHandlers['group:activity_added']({
            activity: {
              id: 'activity-2',
              title: 'Real-time Activity',
              description: 'Added via WebSocket',
              isChosen: false
            }
          });
        }
      });

      // Should display new activity
      await waitFor(() => {
        expect(screen.getByText('Real-time Activity')).toBeInTheDocument();
      });

      // Verify both activities are present
      expect(screen.getByTestId('activity-activity-1')).toBeInTheDocument();
      expect(screen.getByTestId('activity-activity-2')).toBeInTheDocument();
    });

    it('should update activity chosen status in real-time', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      // Initially not chosen
      expect(screen.queryByTestId('chosen-badge')).not.toBeInTheDocument();

      // Simulate activity chosen event
      act(() => {
        if (socketEventHandlers['group:activity_chosen']) {
          socketEventHandlers['group:activity_chosen']({
            activityId: 'activity-1',
            isChosen: true
          });
        }
      });

      // Should show chosen status
      await waitFor(() => {
        expect(screen.getByTestId('chosen-badge')).toBeInTheDocument();
      });
    });

    it('should handle activity unchosen events', async () => {
      // Start with chosen activity
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes('/activities')) {
          return Promise.resolve({
            data: {
              activities: [
                {
                  id: 'activity-1',
                  title: 'Chosen Activity',
                  isChosen: true
                }
              ]
            }
          });
        }
        return Promise.resolve({ data: { group: { members: [] } } });
      });

      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('chosen-badge')).toBeInTheDocument();
      });

      // Simulate activity unchosen event
      act(() => {
        if (socketEventHandlers['group:activity_unchosen']) {
          socketEventHandlers['group:activity_unchosen']({
            activityId: 'activity-1',
            isChosen: false
          });
        }
      });

      // Should remove chosen status
      await waitFor(() => {
        expect(screen.queryByTestId('chosen-badge')).not.toBeInTheDocument();
      });
    });

    it('should handle multiple rapid activity updates', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      // Simulate rapid activity additions
      act(() => {
        for (let i = 2; i <= 5; i++) {
          if (socketEventHandlers['group:activity_added']) {
            socketEventHandlers['group:activity_added']({
              activity: {
                id: `activity-${i}`,
                title: `Activity ${i}`,
                isChosen: false
              }
            });
          }
        }
      });

      // Should display all activities
      await waitFor(() => {
        expect(screen.getByText('Activity 2')).toBeInTheDocument();
        expect(screen.getByText('Activity 3')).toBeInTheDocument();
        expect(screen.getByText('Activity 4')).toBeInTheDocument();
        expect(screen.getByText('Activity 5')).toBeInTheDocument();
      });

      // Verify all activity elements exist
      expect(screen.getByTestId('activity-activity-2')).toBeInTheDocument();
      expect(screen.getByTestId('activity-activity-3')).toBeInTheDocument();
      expect(screen.getByTestId('activity-activity-4')).toBeInTheDocument();
      expect(screen.getByTestId('activity-activity-5')).toBeInTheDocument();
    });
  });

  describe('Real-time Member Updates', () => {
    it('should receive and display new members in real-time', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('testuser1')).toBeInTheDocument();
        expect(screen.getByText('testuser2')).toBeInTheDocument();
      });

      // Simulate new member joined event
      act(() => {
        if (socketEventHandlers['group:member_joined']) {
          socketEventHandlers['group:member_joined']({
            member: {
              id: 'user-3',
              username: 'newuser'
            }
          });
        }
      });

      // Should display new member
      await waitFor(() => {
        expect(screen.getByText('newuser')).toBeInTheDocument();
      });

      // Verify all members are present
      expect(screen.getByTestId('member-user-1')).toBeInTheDocument();
      expect(screen.getByTestId('member-user-2')).toBeInTheDocument();
      expect(screen.getByTestId('member-user-3')).toBeInTheDocument();
    });

    it('should handle member updates without exposing sensitive information', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('testuser1')).toBeInTheDocument();
      });

      // Simulate member joined with potentially sensitive data
      act(() => {
        if (socketEventHandlers['group:member_joined']) {
          socketEventHandlers['group:member_joined']({
            member: {
              id: 'user-3',
              username: 'sensitiveuser',
              email: 'sensitive@example.com', // Should not be displayed
              password: 'secret123', // Should not be displayed
              votes: ['activity-1', 'activity-2'] // Should not be displayed
            }
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText('sensitiveuser')).toBeInTheDocument();
      });

      // Should not display sensitive information
      expect(screen.queryByText('sensitive@example.com')).not.toBeInTheDocument();
      expect(screen.queryByText('secret123')).not.toBeInTheDocument();
      expect(screen.queryByText('activity-1')).not.toBeInTheDocument();
    });
  });

  describe('Connection Management', () => {
    it('should handle connection status changes', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      // Initially connected
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      // Simulate disconnection
      mockSocket.connected = false;
      act(() => {
        if (socketEventHandlers['disconnect']) {
          socketEventHandlers['disconnect']();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });

      // Simulate reconnection
      mockSocket.connected = true;
      act(() => {
        if (socketEventHandlers['connect']) {
          socketEventHandlers['connect']();
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
    });

    it('should rejoin group rooms on reconnection', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      // Simulate reconnection
      act(() => {
        if (socketEventHandlers['connect']) {
          socketEventHandlers['connect']();
        }
      });

      // Should emit join_group event
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('join_group', 'group-1');
      });
    });

    it('should handle connection errors gracefully', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      // Simulate connection error
      act(() => {
        if (socketEventHandlers['connect_error']) {
          socketEventHandlers['connect_error'](new Error('Connection failed'));
        }
      });

      // Should show disconnected status
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });
    });

    it('should handle authentication errors', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      // Simulate authentication error
      act(() => {
        if (socketEventHandlers['connect_error']) {
          socketEventHandlers['connect_error'](new Error('Authentication error'));
        }
      });

      // Should handle auth error appropriately
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });
    });
  });

  describe('Event Filtering and Privacy', () => {
    it('should only process events for the correct group', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      // Simulate activity event for different group
      act(() => {
        if (socketEventHandlers['group:activity_added']) {
          socketEventHandlers['group:activity_added']({
            activity: {
              id: 'activity-wrong-group',
              title: 'Wrong Group Activity',
              groupId: 'group-2', // Different group
              isChosen: false
            }
          });
        }
      });

      // Should not display activity from different group
      await waitFor(() => {
        expect(screen.queryByText('Wrong Group Activity')).not.toBeInTheDocument();
      });
    });

    it('should sanitize real-time event data', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      // Simulate activity event with potentially malicious data
      act(() => {
        if (socketEventHandlers['group:activity_added']) {
          socketEventHandlers['group:activity_added']({
            activity: {
              id: 'activity-2',
              title: '<script>alert("xss")</script>Safe Title',
              description: 'javascript:alert("xss")',
              isChosen: false,
              creatorId: 'should-not-be-displayed',
              votes: ['user-1', 'user-2']
            }
          });
        }
      });

      // Should display sanitized content
      await waitFor(() => {
        const activityElement = screen.getByTestId('activity-activity-2');
        expect(activityElement).toBeInTheDocument();
        
        // Should not execute scripts or show sensitive data
        expect(activityElement.innerHTML).not.toContain('<script>');
        expect(activityElement.innerHTML).not.toContain('javascript:');
        expect(activityElement.innerHTML).not.toContain('should-not-be-displayed');
        expect(activityElement.innerHTML).not.toContain('user-1');
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-frequency events without performance issues', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Simulate many rapid events
      act(() => {
        for (let i = 0; i < 100; i++) {
          if (socketEventHandlers['group:activity_chosen']) {
            socketEventHandlers['group:activity_chosen']({
              activityId: 'activity-1',
              isChosen: i % 2 === 0 // Alternate chosen status
            });
          }
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle events quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Final state should be correct
      await waitFor(() => {
        // Last event had isChosen: false (99 % 2 === 1, so false)
        expect(screen.queryByTestId('chosen-badge')).not.toBeInTheDocument();
      });
    });

    it('should debounce rapid status changes', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      // Simulate rapid chosen/unchosen events
      act(() => {
        if (socketEventHandlers['group:activity_chosen']) {
          socketEventHandlers['group:activity_chosen']({
            activityId: 'activity-1',
            isChosen: true
          });
        }
        if (socketEventHandlers['group:activity_unchosen']) {
          socketEventHandlers['group:activity_unchosen']({
            activityId: 'activity-1',
            isChosen: false
          });
        }
        if (socketEventHandlers['group:activity_chosen']) {
          socketEventHandlers['group:activity_chosen']({
            activityId: 'activity-1',
            isChosen: true
          });
        }
      });

      // Should settle on final state
      await waitFor(() => {
        expect(screen.getByTestId('chosen-badge')).toBeInTheDocument();
      });
    });

    it('should maintain state consistency during network interruptions', async () => {
      renderWithProviders(<TestRealTimeComponent groupId="group-1" />);

      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      });

      // Add activity via real-time
      act(() => {
        if (socketEventHandlers['group:activity_added']) {
          socketEventHandlers['group:activity_added']({
            activity: {
              id: 'activity-2',
              title: 'Network Test Activity',
              isChosen: false
            }
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Network Test Activity')).toBeInTheDocument();
      });

      // Simulate network disconnection
      mockSocket.connected = false;
      act(() => {
        if (socketEventHandlers['disconnect']) {
          socketEventHandlers['disconnect']();
        }
      });

      // Activities should still be displayed
      expect(screen.getByText('Initial Activity')).toBeInTheDocument();
      expect(screen.getByText('Network Test Activity')).toBeInTheDocument();

      // Simulate reconnection
      mockSocket.connected = true;
      act(() => {
        if (socketEventHandlers['connect']) {
          socketEventHandlers['connect']();
        }
      });

      // State should be maintained
      await waitFor(() => {
        expect(screen.getByText('Initial Activity')).toBeInTheDocument();
        expect(screen.getByText('Network Test Activity')).toBeInTheDocument();
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
    });
  });
});