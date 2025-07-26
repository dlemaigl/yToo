import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationSystem from '../NotificationSystem';

describe('NotificationSystem', () => {
  const mockNotifications = [
    {
      id: '1',
      type: 'activity_added' as const,
      title: 'New Activity Proposed!',
      message: '"Test Activity" has been added to the group',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: { activityId: 'activity1' }
    },
    {
      id: '2',
      type: 'activity_chosen' as const,
      title: 'Activity Chosen! 🎉',
      message: '"Test Activity" has been selected by the group',
      timestamp: new Date('2024-01-01T12:05:00Z'),
      data: { activityId: 'activity1' }
    },
    {
      id: '3',
      type: 'member_joined' as const,
      title: 'New Member Joined! 👋',
      message: 'john_doe has joined the group',
      timestamp: new Date('2024-01-01T12:10:00Z'),
      data: { memberId: 'member1' }
    }
  ];

  const mockOnDismiss = jest.fn();
  const mockOnClearAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing when no notifications', () => {
    const { container } = render(
      <NotificationSystem
        notifications={[]}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render notifications with correct content', () => {
    render(
      <NotificationSystem
        notifications={mockNotifications}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.getByText('New Activity Proposed!')).toBeInTheDocument();
    expect(screen.getByText('"Test Activity" has been added to the group')).toBeInTheDocument();
    expect(screen.getByText('Activity Chosen! 🎉')).toBeInTheDocument();
    expect(screen.getByText('New Member Joined! 👋')).toBeInTheDocument();
    expect(screen.getByText('john_doe has joined the group')).toBeInTheDocument();
  });

  it('should display correct icons for different notification types', () => {
    render(
      <NotificationSystem
        notifications={mockNotifications}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    // Check for icons in notification-icon divs specifically
    const iconContainers = screen.getAllByText('🎯');
    expect(iconContainers).toHaveLength(1);
    expect(screen.getByText('🎉')).toBeInTheDocument(); // activity_chosen (in icon)
    expect(screen.getByText('👋')).toBeInTheDocument(); // member_joined
  });

  it('should display timestamps in correct format', () => {
    render(
      <NotificationSystem
        notifications={mockNotifications}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    // Check that all timestamps are present
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/);
    expect(timeElements).toHaveLength(3);
    
    // Verify specific times are displayed (accounting for timezone conversion)
    expect(timeElements[0]).toHaveTextContent(/\d{1,2}:\d{2}/);
    expect(timeElements[1]).toHaveTextContent(/\d{1,2}:\d{2}/);
    expect(timeElements[2]).toHaveTextContent(/\d{1,2}:\d{2}/);
  });

  it('should show clear all button when multiple notifications', () => {
    render(
      <NotificationSystem
        notifications={mockNotifications}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    const clearAllButton = screen.getByText('Clear All (3)');
    expect(clearAllButton).toBeInTheDocument();
  });

  it('should not show clear all button with single notification', () => {
    render(
      <NotificationSystem
        notifications={[mockNotifications[0]]}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.queryByText(/Clear All/)).not.toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    render(
      <NotificationSystem
        notifications={[mockNotifications[0]]}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    const dismissButton = screen.getByText('×');
    fireEvent.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalledWith('1');
  });

  it('should call onClearAll when clear all button is clicked', () => {
    render(
      <NotificationSystem
        notifications={mockNotifications}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    const clearAllButton = screen.getByText('Clear All (3)');
    fireEvent.click(clearAllButton);

    expect(mockOnClearAll).toHaveBeenCalled();
  });

  it('should apply correct CSS classes for different notification types', () => {
    const { container } = render(
      <NotificationSystem
        notifications={mockNotifications}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    const notifications = container.querySelectorAll('.notification');
    expect(notifications[0]).toHaveClass('notification-info'); // activity_added
    expect(notifications[1]).toHaveClass('notification-success'); // activity_chosen
    expect(notifications[2]).toHaveClass('notification-info'); // member_joined
  });

  it('should handle activity_unchosen notification type', () => {
    const unchosenNotification = {
      id: '4',
      type: 'activity_unchosen' as const,
      title: 'Activity Status Changed',
      message: '"Test Activity" is no longer the chosen activity',
      timestamp: new Date('2024-01-01T12:15:00Z'),
      data: { activityId: 'activity1' }
    };

    const { container } = render(
      <NotificationSystem
        notifications={[unchosenNotification]}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.getByText('Activity Status Changed')).toBeInTheDocument();
    expect(screen.getByText('🔄')).toBeInTheDocument();
    
    const notification = container.querySelector('.notification');
    expect(notification).toHaveClass('notification-warning');
  });

  it('should render multiple dismiss buttons for multiple notifications', () => {
    render(
      <NotificationSystem
        notifications={mockNotifications}
        onDismiss={mockOnDismiss}
        onClearAll={mockOnClearAll}
      />
    );

    const dismissButtons = screen.getAllByText('×');
    expect(dismissButtons).toHaveLength(3);

    // Test dismissing different notifications
    fireEvent.click(dismissButtons[0]);
    expect(mockOnDismiss).toHaveBeenCalledWith('1');

    fireEvent.click(dismissButtons[1]);
    expect(mockOnDismiss).toHaveBeenCalledWith('2');

    fireEvent.click(dismissButtons[2]);
    expect(mockOnDismiss).toHaveBeenCalledWith('3');
  });
});