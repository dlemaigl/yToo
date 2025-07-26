import { renderHook, act } from '@testing-library/react';
import { useRealTimeUpdates } from '../useRealTimeUpdates';
import { useSocket } from '../../contexts/SocketContext';

// Mock the socket context
jest.mock('../../contexts/SocketContext');
const mockUseSocket = useSocket as jest.MockedFunction<typeof useSocket>;

// Mock axios to prevent import issues
jest.mock('axios', () => ({
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    })),
  },
}));

describe('useRealTimeUpdates', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  };

  const mockSocketContext = {
    socket: mockSocket,
    isConnected: true,
    isReconnecting: false,
    connectionError: null,
    joinGroup: jest.fn(),
    leaveGroup: jest.fn(),
    reconnect: jest.fn()
  };

  const initialActivities = [
    {
      id: '1',
      title: 'Test Activity 1',
      description: 'Description 1',
      isChosen: false,
      createdAt: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      title: 'Test Activity 2',
      description: 'Description 2',
      isChosen: true,
      createdAt: '2024-01-02T00:00:00Z'
    }
  ];

  const initialMembers = [
    {
      id: '1',
      username: 'user1',
      joinedAt: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSocket.mockReturnValue(mockSocketContext);
  });

  it('should initialize with provided activities and members', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    expect(result.current.activities).toEqual(initialActivities);
    expect(result.current.members).toEqual(initialMembers);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.isConnected).toBe(true);
  });

  it('should join group when connected', () => {
    renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    expect(mockSocketContext.joinGroup).toHaveBeenCalledWith('group1');
  });

  it('should set up socket event listeners', () => {
    renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    expect(mockSocket.on).toHaveBeenCalledWith('group:activity_added', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('group:activity_chosen', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('group:activity_unchosen', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('group:member_joined', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('should handle activity added event', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    const newActivity = {
      id: '3',
      title: 'New Activity',
      description: 'New Description',
      isChosen: false,
      createdAt: '2024-01-03T00:00:00Z'
    };

    // Get the activity_added handler
    const activityAddedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'group:activity_added'
    )?.[1];

    act(() => {
      activityAddedHandler?.({ activity: newActivity });
    });

    expect(result.current.activities).toHaveLength(3);
    expect(result.current.activities[2]).toEqual(newActivity);
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('activity_added');
  });

  it('should handle activity chosen event', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    // Get the activity_chosen handler
    const activityChosenHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'group:activity_chosen'
    )?.[1];

    act(() => {
      activityChosenHandler?.({ activityId: '1', isChosen: true });
    });

    expect(result.current.activities[0].isChosen).toBe(true);
    expect(result.current.activities[1].isChosen).toBe(false); // Only one can be chosen
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('activity_chosen');
  });

  it('should handle member joined event', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    const newMember = {
      id: '2',
      username: 'user2',
      joinedAt: '2024-01-03T00:00:00Z'
    };

    // Get the member_joined handler
    const memberJoinedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'group:member_joined'
    )?.[1];

    act(() => {
      memberJoinedHandler?.({ member: newMember, groupId: 'group1' });
    });

    expect(result.current.members).toHaveLength(2);
    expect(result.current.members[1]).toEqual(newMember);
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('member_joined');
  });

  it('should dismiss notifications', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    // Add a notification first
    const activityAddedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'group:activity_added'
    )?.[1];

    const newActivity = {
      id: '3',
      title: 'New Activity',
      isChosen: false,
      createdAt: '2024-01-03T00:00:00Z'
    };

    act(() => {
      activityAddedHandler?.({ activity: newActivity });
    });

    expect(result.current.notifications).toHaveLength(1);

    const notificationId = result.current.notifications[0].id;

    act(() => {
      result.current.dismissNotification(notificationId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should clear all notifications', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    // Add multiple notifications
    const activityAddedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'group:activity_added'
    )?.[1];

    act(() => {
      activityAddedHandler?.({ activity: { id: '3', title: 'Activity 3', isChosen: false, createdAt: '2024-01-03T00:00:00Z' } });
      activityAddedHandler?.({ activity: { id: '4', title: 'Activity 4', isChosen: false, createdAt: '2024-01-04T00:00:00Z' } });
    });

    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clearAllNotifications();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should not add duplicate activities', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    const activityAddedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'group:activity_added'
    )?.[1];

    // Try to add an activity that already exists
    act(() => {
      activityAddedHandler?.({ activity: initialActivities[0] });
    });

    expect(result.current.activities).toHaveLength(2); // Should remain the same
  });

  it('should not add duplicate members', () => {
    const { result } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    const memberJoinedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'group:member_joined'
    )?.[1];

    // Try to add a member that already exists
    act(() => {
      memberJoinedHandler?.({ member: initialMembers[0], groupId: 'group1' });
    });

    expect(result.current.members).toHaveLength(1); // Should remain the same
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealTimeUpdates({
        groupId: 'group1',
        initialActivities,
        initialMembers
      })
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('group:activity_added', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('group:activity_chosen', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('group:activity_unchosen', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('group:member_joined', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });
});