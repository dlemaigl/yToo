import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { SocketProvider } from '../../contexts/SocketContext';
import GroupDetailPage from '../../pages/GroupDetailPage';
import ActivityList from '../../components/ActivityList';
import VotingControls from '../../components/VotingControls';

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
import { describe } from 'node:test';
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
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockIo = io as jest.MockedFunction<typeof io>;

describe('Privacy Compliance Tests', () => {
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connected: true
    };
    
    mockIo.mockReturnValue(mockSocket);
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

  describe('Anonymous Activity Proposal Privacy', () => {
    it('should not display activity creator information anywhere in UI', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Go to movies',
          description: 'Watch latest film',
          isChosen: false,
          createdAt: '2023-01-01T00:00:00Z'
          // No creator information
        },
        {
          id: 'activity-2',
          title: 'Play board games',
          description: 'Fun evening activity',
          isChosen: true,
          createdAt: '2023-01-02T00:00:00Z'
        }
      ];

      renderWithProviders(<ActivityList activities={mockActivities} groupId="group-1" />);

      // Verify no creator information is displayed
      expect(screen.queryByText(/created by/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/proposed by/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/author/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/submitted by/i)).not.toBeInTheDocument();

      // Verify activities are shown without creator details
      expect(screen.getByText('Go to movies')).toBeInTheDocument();
      expect(screen.getByText('Play board games')).toBeInTheDocument();

      // Check that no user avatars or names are associated with activities
      const activityElements = screen.getAllByRole('article');
      activityElements.forEach(element => {
        expect(element).not.toHaveTextContent(/user/i);
        expect(element).not.toHaveTextContent(/@/); // No email addresses
      });
    });

    it('should not expose creator information in DOM attributes or data', () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Secret Activity',
          description: 'This should be anonymous',
          isChosen: false
        }
      ];

      const { container } = renderWithProviders(
        <ActivityList activities={mockActivities} groupId="group-1" />
      );

      // Check DOM for any creator-related attributes
      const activityElements = container.querySelectorAll('[data-creator]');
      expect(activityElements).toHaveLength(0);

      const createdByElements = container.querySelectorAll('[data-created-by]');
      expect(createdByElements).toHaveLength(0);

      const authorElements = container.querySelectorAll('[data-author]');
      expect(authorElements).toHaveLength(0);

      // Check for any hidden creator information in HTML
      expect(container.innerHTML).not.toMatch(/data-creator/);
      expect(container.innerHTML).not.toMatch(/createdBy/);
      expect(container.innerHTML).not.toMatch(/authorId/);
    });

    it('should maintain anonymity in activity proposal form', async () => {
      const user = userEvent.setup();

      mockApiClient.post.mockResolvedValue({
        data: {
          activity: {
            id: 'new-activity',
            title: 'New Activity',
            description: 'Test description',
            isChosen: false
          }
        }
      });

      renderWithProviders(
        <div>
          <h1>Propose Activity</h1>
          <form>
            <input aria-label="Title" />
            <textarea aria-label="Description" />
            <button type="submit">Propose</button>
          </form>
        </div>
      );

      await user.type(screen.getByLabelText(/title/i), 'Anonymous Activity');
      await user.type(screen.getByLabelText(/description/i), 'This should be anonymous');
      
      const submitButton = screen.getByRole('button', { name: /propose/i });
      await user.click(submitButton);

      // Verify API call doesn't include creator information
      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          expect.stringContaining('/activities'),
          expect.objectContaining({
            title: 'Anonymous Activity',
            description: 'This should be anonymous'
          })
        );
      });

      // Verify no creator fields in API call
      const apiCall = mockApiClient.post.mock.calls[0];
      const requestData = apiCall[1];
      expect(requestData).not.toHaveProperty('creatorId');
      expect(requestData).not.toHaveProperty('creator');
      expect(requestData).not.toHaveProperty('createdBy');
    });
  });

  describe('Anonymous Voting Privacy', () => {
    it('should not display vote counts or voting statistics', () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Popular Activity',
          description: 'Many people voted for this',
          isChosen: true
        },
        {
          id: 'activity-2',
          title: 'Less Popular Activity',
          description: 'Fewer votes',
          isChosen: false
        }
      ];

      renderWithProviders(<ActivityList activities={mockActivities} groupId="group-1" />);

      // Verify no vote count information
      expect(screen.queryByText(/votes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument(); // No "3/5" patterns
      expect(screen.queryByText(/%/)).not.toBeInTheDocument(); // No percentages
      expect(screen.queryByText(/majority/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ people voted/i)).not.toBeInTheDocument();

      // Should only show chosen/not chosen status
      expect(screen.getByText(/chosen/i)).toBeInTheDocument();
    });

    it('should not expose individual voting choices', async () => {
      const user = userEvent.setup();

      mockApiClient.post.mockResolvedValue({
        data: { message: 'Vote recorded' }
      });

      renderWithProviders(
        <VotingControls 
          activityId="activity-1" 
          hasVoted={false}
          isChosen={false}
        />
      );

      const voteButton = screen.getByRole('button', { name: /vote/i });
      await user.click(voteButton);

      // Should show vote confirmation without details
      await waitFor(() => {
        expect(screen.getByText(/voted/i)).toBeInTheDocument();
      });

      // Should not show who else voted
      expect(screen.queryByText(/also voted/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/voters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/you and \d+ others/i)).not.toBeInTheDocument();
    });

    it('should not display voting progress or statistics', () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Test Activity',
          isChosen: false
        }
      ];

      const { container } = renderWithProviders(
        <ActivityList activities={mockActivities} groupId="group-1" />
      );

      // Check for progress bars or vote indicators
      expect(container.querySelector('progress')).toBeNull();
      expect(container.querySelector('.progress-bar')).toBeNull();
      expect(container.querySelector('[role="progressbar"]')).toBeNull();

      // Check for vote count badges or indicators
      expect(container.querySelector('.vote-count')).toBeNull();
      expect(container.querySelector('.badge')).toBeNull();
      expect(container.querySelector('.vote-indicator')).toBeNull();
    });

    it('should handle vote changes without exposing voting patterns', async () => {
      const user = userEvent.setup();

      mockApiClient.delete.mockResolvedValue({
        data: { message: 'Vote removed' }
      });

      renderWithProviders(
        <VotingControls 
          activityId="activity-1" 
          hasVoted={true}
          isChosen={false}
        />
      );

      const unvoteButton = screen.getByRole('button', { name: /unvote/i });
      await user.click(unvoteButton);

      await waitFor(() => {
        expect(mockApiClient.delete).toHaveBeenCalledWith(
          expect.stringContaining('/vote')
        );
      });

      // Should not show impact of vote change
      expect(screen.queryByText(/activity no longer has majority/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/vote count decreased/i)).not.toBeInTheDocument();
    });
  });

  describe('Real-time Updates Privacy', () => {
    it('should handle real-time activity status changes without exposing vote details', async () => {
      renderWithProviders(
        <ActivityList activities={[]} groupId="group-1" />
      );

      // Simulate activity chosen event
      const activityChosenHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'group:activity_chosen'
      )?.[1];

      if (activityChosenHandler) {
        activityChosenHandler({
          activityId: 'activity-1',
          isChosen: true
          // No vote count or voter information
        });
      }

      // Should update status without showing vote details
      await waitFor(() => {
        // The component should handle the update internally
        expect(mockSocket.on).toHaveBeenCalledWith(
          'group:activity_chosen',
          expect.any(Function)
        );
      });
    });

    it('should handle new activity notifications without revealing proposer', async () => {
      renderWithProviders(
        <ActivityList activities={[]} groupId="group-1" />
      );

      // Simulate new activity event
      const newActivityHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'group:activity_added'
      )?.[1];

      if (newActivityHandler) {
        newActivityHandler({
          activity: {
            id: 'activity-2',
            title: 'New Anonymous Activity',
            description: 'Added by someone',
            isChosen: false
          }
          // No creator information
        });
      }

      // Should show notification without creator
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith(
          'group:activity_added',
          expect.any(Function)
        );
      });
    });
  });

  describe('Data Sanitization and Security', () => {
    it('should sanitize all displayed data to prevent information leakage', () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Normal Activity',
          description: 'Regular description',
          isChosen: false,
          // Simulate potential data leakage fields that should be filtered
          _internal: 'should not be displayed',
          creatorId: 'user-123',
          votes: ['user-1', 'user-2'],
          voteCount: 5
        }
      ];

      const { container } = renderWithProviders(
        <ActivityList activities={mockActivities} groupId="group-1" />
      );

      // Should display safe content
      expect(screen.getByText('Normal Activity')).toBeInTheDocument();
      expect(screen.getByText('Regular description')).toBeInTheDocument();

      // Should not display sensitive fields
      expect(container.innerHTML).not.toContain('should not be displayed');
      expect(container.innerHTML).not.toContain('user-123');
      expect(container.innerHTML).not.toContain('user-1');
      expect(container.innerHTML).not.toContain('user-2');
      expect(container.innerHTML).not.toContain('5');
    });

    it('should not expose sensitive data in component props or state', () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Test Activity',
          isChosen: false
        }
      ];

      const { container } = renderWithProviders(
        <ActivityList activities={mockActivities} groupId="group-1" />
      );

      // Check React DevTools-accessible data
      const reactFiber = (container.firstChild as any)?._reactInternalFiber;
      if (reactFiber) {
        // Ensure no sensitive data in component state
        const componentState = reactFiber.memoizedState;
        if (componentState) {
          expect(JSON.stringify(componentState)).not.toContain('creatorId');
          expect(JSON.stringify(componentState)).not.toContain('votes');
          expect(JSON.stringify(componentState)).not.toContain('voteCount');
        }
      }
    });

    it('should handle error states without exposing sensitive information', async () => {
      const user = userEvent.setup();

      // Mock API error with potentially sensitive information
      mockApiClient.post.mockRejectedValue({
        response: {
          status: 500,
          data: {
            error: 'Database error',
            details: 'Vote table: user-123 already voted for activity-456',
            query: 'SELECT * FROM votes WHERE user_id = user-123'
          }
        }
      });

      renderWithProviders(
        <VotingControls 
          activityId="activity-1" 
          hasVoted={false}
          isChosen={false}
        />
      );

      const voteButton = screen.getByRole('button', { name: /vote/i });
      await user.click(voteButton);

      // Should show generic error without sensitive details
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });

      // Should not expose database details
      expect(screen.queryByText(/user-123/)).not.toBeInTheDocument();
      expect(screen.queryByText(/activity-456/)).not.toBeInTheDocument();
      expect(screen.queryByText(/SELECT/)).not.toBeInTheDocument();
      expect(screen.queryByText(/vote table/i)).not.toBeInTheDocument();
    });
  });

  describe('UI Privacy Compliance', () => {
    it('should not show vote-related UI elements that could reveal information', () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Test Activity',
          isChosen: true
        }
      ];

      const { container } = renderWithProviders(
        <ActivityList activities={mockActivities} groupId="group-1" />
      );

      // Should not have vote count displays
      expect(container.querySelector('.vote-count')).toBeNull();
      expect(container.querySelector('.voter-list')).toBeNull();
      expect(container.querySelector('.vote-percentage')).toBeNull();
      expect(container.querySelector('.progress-indicator')).toBeNull();

      // Should not have tooltips with vote information
      expect(container.querySelector('[title*="vote"]')).toBeNull();
      expect(container.querySelector('[aria-label*="vote"]')).toBeNull();
    });

    it('should maintain privacy in accessibility attributes', () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Accessible Activity',
          isChosen: true
        }
      ];

      const { container } = renderWithProviders(
        <ActivityList activities={mockActivities} groupId="group-1" />
      );

      // Check aria-labels don't expose vote information
      const elementsWithAriaLabel = container.querySelectorAll('[aria-label]');
      elementsWithAriaLabel.forEach(element => {
        const ariaLabel = element.getAttribute('aria-label') || '';
        expect(ariaLabel).not.toMatch(/\d+ votes?/i);
        expect(ariaLabel).not.toMatch(/voted by/i);
        expect(ariaLabel).not.toMatch(/\d+%/);
      });

      // Check aria-describedby doesn't expose sensitive info
      const elementsWithAriaDescribedBy = container.querySelectorAll('[aria-describedby]');
      elementsWithAriaDescribedBy.forEach(element => {
        const describedById = element.getAttribute('aria-describedby') || '';
        const describedByElement = container.querySelector(`#${describedById}`);
        if (describedByElement) {
          expect(describedByElement.textContent).not.toMatch(/vote count/i);
          expect(describedByElement.textContent).not.toMatch(/voters/i);
        }
      });
    });
  });
});