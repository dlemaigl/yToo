import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectionStatus from '../ConnectionStatus';

describe('ConnectionStatus', () => {
  const mockOnReconnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show connected status when connected', () => {
    render(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    expect(screen.getByText('Live updates')).toBeInTheDocument();
    expect(screen.queryByText('Reconnect')).not.toBeInTheDocument();
  });

  it('should show active status when connected with recent activity', () => {
    render(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
        hasRecentActivity={true}
      />
    );

    expect(screen.getByText('Live updates (active)')).toBeInTheDocument();
  });

  it('should show disconnected status when not connected', () => {
    render(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  it('should show reconnecting status when reconnecting', () => {
    render(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={true}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    expect(screen.queryByText('Reconnect')).not.toBeInTheDocument();
  });

  it('should show connection error when present', () => {
    render(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={false}
        connectionError="Network timeout"
        onReconnect={mockOnReconnect}
      />
    );

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('should call onReconnect when reconnect button is clicked', () => {
    render(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    const reconnectButton = screen.getByText('Reconnect');
    fireEvent.click(reconnectButton);

    expect(mockOnReconnect).toHaveBeenCalled();
  });

  it('should disable reconnect button when reconnecting', () => {
    render(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={true}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    // Button should not be present when reconnecting
    expect(screen.queryByText('Reconnect')).not.toBeInTheDocument();
  });

  it('should show last update time when provided', () => {
    const lastUpdate = new Date('2024-01-01T12:00:00Z');
    
    render(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
        lastActivityUpdate={lastUpdate}
      />
    );

    expect(screen.getByText(/Last update:/)).toBeInTheDocument();
  });

  it('should show "Just now" for very recent updates', () => {
    const recentUpdate = new Date(Date.now() - 30000); // 30 seconds ago
    
    render(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
        lastActivityUpdate={recentUpdate}
      />
    );

    expect(screen.getByText('Last update: Just now')).toBeInTheDocument();
  });

  it('should show minutes ago for updates within an hour', () => {
    const updateTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    render(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
        lastActivityUpdate={updateTime}
      />
    );

    expect(screen.getByText('Last update: 5m ago')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for different states', () => {
    const { container, rerender } = render(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    let statusElement = container.querySelector('.connection-status');
    expect(statusElement).toHaveClass('connected');

    rerender(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
        hasRecentActivity={true}
      />
    );

    statusElement = container.querySelector('.connection-status');
    expect(statusElement).toHaveClass('connected', 'active');

    rerender(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    statusElement = container.querySelector('.connection-status');
    expect(statusElement).toHaveClass('disconnected');

    rerender(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={true}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    statusElement = container.querySelector('.connection-status');
    expect(statusElement).toHaveClass('reconnecting');
  });

  it('should show spinner when reconnecting', () => {
    const { container } = render(
      <ConnectionStatus
        isConnected={false}
        isReconnecting={true}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    const spinner = container.querySelector('.connection-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should not show spinner when not reconnecting', () => {
    const { container } = render(
      <ConnectionStatus
        isConnected={true}
        isReconnecting={false}
        connectionError={null}
        onReconnect={mockOnReconnect}
      />
    );

    const spinner = container.querySelector('.connection-spinner');
    expect(spinner).not.toBeInTheDocument();
  });
});