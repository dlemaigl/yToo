import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { SocketProvider } from '../../contexts/SocketContext';
import GroupDetailPage from '../../pages/GroupDetailPage';
import ActivityList from '../../components/ActivityList';
import VotingControls from '../../components/VotingControls';

// Mock API responses
const mockActivities = [
  {
    id: 'activity-1',
    title: 'Test Activity 1',
    description: 'First test activity',
    isChosen: false,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  },
  {
    id: 'activity-2',
    title: 'Test Activity 2',
    description: 'Second test activity',
    isChosen: true,
    createdAt: '2023-01-01T01:00:00Z',
    updatedAt: '2023-01-01T01:00:00Z'
  }
];

const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  inviteToken: 'invite-token-123',
  members: [
    { id: 'user-1', username: 'testuser1' },
    { id: 'user-2', username: 'testuser2' }
  ]
};

const mockVoteStatus = [
  { activityId: 'activity-1', hasVoted: true },
  { activityId: 'activity-2', hasVoted: false }
];

// Mock fetch
global.fetch = jest.fn();

// Mock socket
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connected: true
};

jest.mock('socket.io-client', () => ({
  io: () => mockSocket
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('Frontend Data Privacy Tests', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    
    // Mock successful API responses
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ group: mockGroup })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activities: mockActivities })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ voteStatus: mockVoteStatus })
      });
  });

  describe('Activity Display Privacy', () => {
    it('should not display vote counts in activity list', async () => {
      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check that vote counts are not displayed
      expect(screen.queryByText(/votes?:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\s*votes?/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/vote count/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument(); // No "2/5" style displays
    });

    it('should not display voting percentages', async () => {
      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check that percentages are not displayed
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/percent/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    });

    it('should not display activity creators', async () => {
      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check that creator information is not displayed
      expect(screen.queryByText(/created by/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/proposed by/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/author/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/testuser1/)).not.toBeInTheDocument();
      expect(screen.queryByText(/testuser2/)).not.toBeInTheDocument();
    });

    it('should not display who voted for activities', async () => {
      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check that voter information is not displayed
      expect(screen.queryByText(/voted by/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/voters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/supported by/i)).not.toBeInTheDocument();
    });

    it('should only show chosen status without vote details', async () => {
      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Should show chosen status
      expect(screen.getByText(/chosen/i)).toBeInTheDocument();
      
      // But not the details of how it was chosen
      expect(screen.queryByText(/majority/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\s*out of\s*\d+/i)).not.toBeInTheDocument();
    });
  });

  describe('Voting Interface Privacy', () => {
    it('should not display vote statistics in voting controls', () => {
      const mockActivity = mockActivities[0];
      const mockUserVote = mockVoteStatus[0];

      render(
        <TestWrapper>
          <VotingControls
            activity={mockActivity}
            userVoteStatus={mockUserVote}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check that voting statistics are not displayed
      expect(screen.queryByText(/\d+\s*votes?/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/vote count/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/total votes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/participation/i)).not.toBeInTheDocument();
    });

    it('should only show user\'s own vote status', () => {
      const mockActivity = mockActivities[0];
      const mockUserVote = mockVoteStatus[0];

      render(
        <TestWrapper>
          <VotingControls
            activity={mockActivity}
            userVoteStatus={mockUserVote}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Should indicate user's vote status
      if (mockUserVote.hasVoted) {
        expect(screen.getByText(/remove vote/i) || screen.getByText(/voted/i)).toBeInTheDocument();
      } else {
        expect(screen.getByText(/vote/i)).toBeInTheDocument();
      }

      // But not other users' votes
      expect(screen.queryByText(/others voted/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/also voted/i)).not.toBeInTheDocument();
    });
  });

  describe('Group Information Privacy', () => {
    it('should not expose sensitive member information', async () => {
      // Mock the useParams hook
      jest.doMock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useParams: () => ({ id: 'group-1' })
      }));

      render(
        <TestWrapper>
          <GroupDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Group')).toBeInTheDocument();
      });

      // Should show member usernames
      expect(screen.getByText('testuser1')).toBeInTheDocument();
      expect(screen.getByText('testuser2')).toBeInTheDocument();

      // But not sensitive information
      expect(screen.queryByText(/@/)).not.toBeInTheDocument(); // No email addresses
      expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/user-1/)).not.toBeInTheDocument(); // No user IDs
      expect(screen.queryByText(/user-2/)).not.toBeInTheDocument();
    });

    it('should not display invite tokens in plain text', async () => {
      jest.doMock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useParams: () => ({ id: 'group-1' })
      }));

      render(
        <TestWrapper>
          <GroupDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Group')).toBeInTheDocument();
      });

      // Should not display the raw invite token
      expect(screen.queryByText('invite-token-123')).not.toBeInTheDocument();
      
      // Should have a way to share invite but not expose the token directly
      expect(screen.getByText(/invite/i) || screen.getByText(/share/i)).toBeInTheDocument();
    });
  });

  describe('API Response Privacy Validation', () => {
    it('should not include sensitive fields in API responses', async () => {
      // Mock a response that accidentally includes sensitive data
      const sensitiveResponse = {
        activities: [
          {
            ...mockActivities[0],
            voteCount: 5,
            voters: ['user-1', 'user-2'],
            creatorId: 'user-1',
            votingStatistics: { participation: 0.8 }
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => sensitiveResponse
      });

      render(
        <TestWrapper>
          <ActivityList 
            activities={sensitiveResponse.activities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Even if the API accidentally returns sensitive data,
      // the UI should not display it
      expect(screen.queryByText('5')).not.toBeInTheDocument(); // vote count
      expect(screen.queryByText('user-1')).not.toBeInTheDocument(); // creator ID
      expect(screen.queryByText('0.8')).not.toBeInTheDocument(); // participation
    });

    it('should validate that vote status only contains allowed fields', () => {
      const invalidVoteStatus = [
        {
          activityId: 'activity-1',
          hasVoted: true,
          voteCount: 10, // Should not be included
          otherVoters: ['user-2'], // Should not be included
          totalMembers: 5 // Should not be included
        }
      ];

      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={invalidVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Should not display the extra sensitive fields
      expect(screen.queryByText('10')).not.toBeInTheDocument();
      expect(screen.queryByText('user-2')).not.toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
  });

  describe('Console and Debug Information', () => {
    it('should not log sensitive information to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check that no sensitive data was logged
      const allLogs = [
        ...consoleSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
        ...consoleErrorSpy.mock.calls
      ].flat().join(' ');

      expect(allLogs).not.toContain('voteCount');
      expect(allLogs).not.toContain('voters');
      expect(allLogs).not.toContain('creatorId');
      expect(allLogs).not.toContain('password');
      expect(allLogs).not.toContain('token');

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Local Storage and Session Privacy', () => {
    it('should not store sensitive data in localStorage', () => {
      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check localStorage doesn't contain sensitive data
      const localStorageData = JSON.stringify(localStorage);
      expect(localStorageData).not.toContain('voteCount');
      expect(localStorageData).not.toContain('voters');
      expect(localStorageData).not.toContain('creatorId');
      expect(localStorageData).not.toContain('password');
    });

    it('should not store sensitive data in sessionStorage', () => {
      render(
        <TestWrapper>
          <ActivityList 
            activities={mockActivities}
            userVoteStatus={mockVoteStatus}
            onVote={jest.fn()}
            onRemoveVote={jest.fn()}
          />
        </TestWrapper>
      );

      // Check sessionStorage doesn't contain sensitive data
      const sessionStorageData = JSON.stringify(sessionStorage);
      expect(sessionStorageData).not.toContain('voteCount');
      expect(sessionStorageData).not.toContain('voters');
      expect(sessionStorageData).not.toContain('creatorId');
      expect(sessionStorageData).not.toContain('password');
    });
  });
});