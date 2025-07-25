import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InviteLink from './InviteLink';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('InviteLink', () => {
  const mockProps = {
    inviteToken: 'test-token-123',
    groupName: 'Test Group'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders invite link components', () => {
    render(<InviteLink {...mockProps} />);

    expect(screen.getByText('Invite Others to "Test Group"')).toBeInTheDocument();
    expect(screen.getByText('Share this link with others to invite them to join your group:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  test('displays correct invite URL', () => {
    render(<InviteLink {...mockProps} />);

    const input = screen.getByDisplayValue(
      `${window.location.origin}/join/test-token-123`
    );
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('readOnly');
  });

  test('copies invite link to clipboard', async () => {
    const mockWriteText = navigator.clipboard.writeText as jest.Mock;
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<InviteLink {...mockProps} />);

    const copyButton = screen.getByRole('button', { name: 'Copy' });
    fireEvent.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith(
      `${window.location.origin}/join/test-token-123`
    );
  });

  test('shows copied feedback after copying', async () => {
    const mockWriteText = navigator.clipboard.writeText as jest.Mock;
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<InviteLink {...mockProps} />);

    const copyButton = screen.getByRole('button', { name: 'Copy' });
    fireEvent.click(copyButton);

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });
});