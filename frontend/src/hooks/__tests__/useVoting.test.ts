import { renderHook, act, waitFor } from '@testing-library/react';
import { useVoting } from '../useVoting';

// Mock dependencies
jest.mock('../../services/votingService', () => ({
  votingService: {
    getUserVotingStatus: jest.fn(),
    castVote: jest.fn(),
    removeVote: jest.fn(),
    hasUserVoted: jest.fn()
  }
}));

jest.mock('../../contexts/SocketContext', () => ({
  useSocket: jest.fn()
}));

const { votingService } = require('../../services/votingService');
const { useSocket } = require('../../contexts/SocketContext');

describe('useVoting', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  };

  const mockActivities = [
    { id: 'activity-1', isChosen: false },
    { id: 'activity-2', isChosen: true },
    { id: 'activity-3', isChosen: false }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useSocket.mockReturnValue({
      socket: mockSocket as any,
      isConnected: true,
      connect: jest.fn(),
      disconnect: jest.fn()
    });
  });

  it('loads initial voting status', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([
      { activityId: 'activity-1', hasVoted: true },
      { activityId: 'activity-2', hasVoted: false },
      { activityId: 'activity-3', hasVoted: false }
    ]);

    const { result } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasUserVoted('activity-1')).toBe(true);
    expect(result.current.hasUserVoted('activity-2')).toBe(false);
    expect(result.current.hasUserVoted('activity-3')).toBe(false);
  });

  it('handles voting service errors gracefully', async () => {
    votingService.getUserVotingStatus.mockRejectedValue(new Error('Service error'));

    const { result } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Service error');
  });

  it('casts vote successfully', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([]);
    votingService.castVote.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.castVote('activity-1');
    });

    expect(votingService.castVote).toHaveBeenCalledWith('activity-1');
    expect(result.current.hasUserVoted('activity-1')).toBe(true);
  });

  it('removes vote successfully', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([
      { activityId: 'activity-1', hasVoted: true }
    ]);
    votingService.removeVote.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeVote('activity-1');
    });

    expect(votingService.removeVote).toHaveBeenCalledWith('activity-1');
    expect(result.current.hasUserVoted('activity-1')).toBe(false);
  });

  it('handles vote casting errors', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([]);
    votingService.castVote.mockRejectedValue(new Error('Vote failed'));

    const { result } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let thrownError;
    await act(async () => {
      try {
        await result.current.castVote('activity-1');
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toEqual(new Error('Vote failed'));
    expect(result.current.error).toBe('Vote failed');
    expect(result.current.hasUserVoted('activity-1')).toBe(false);
  });

  it('sets up socket event listeners', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([]);

    renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    expect(mockSocket.on).toHaveBeenCalledWith('group:activity_chosen', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('group:activity_unchosen', expect.any(Function));
  });

  it('cleans up socket event listeners on unmount', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([]);

    const { unmount } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('group:activity_chosen', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('group:activity_unchosen', expect.any(Function));
  });

  it('does not expose vote counts or other user voting information', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([
      { activityId: 'activity-1', hasVoted: true }
    ]);

    const { result } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify that the hook only exposes user's own voting status
    expect(result.current).toHaveProperty('hasUserVoted');
    expect(result.current).toHaveProperty('castVote');
    expect(result.current).toHaveProperty('removeVote');
    
    // Verify that it does NOT expose vote counts, percentages, or other user data
    expect(result.current).not.toHaveProperty('voteCount');
    expect(result.current).not.toHaveProperty('votePercentage');
    expect(result.current).not.toHaveProperty('otherVoters');
    expect(result.current).not.toHaveProperty('totalVotes');
    expect(result.current).not.toHaveProperty('votingStatistics');
  });

  it('refreshes voting status when requested', async () => {
    votingService.getUserVotingStatus.mockResolvedValue([]);

    const { result } = renderHook(() => useVoting({
      groupId: 'group-1',
      activities: mockActivities
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear the mock to verify it's called again
    votingService.getUserVotingStatus.mockClear();

    await act(async () => {
      result.current.refreshVotingStatus();
    });

    expect(votingService.getUserVotingStatus).toHaveBeenCalledWith('group-1');
  });
});