import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VotingControls from '../VotingControls';

describe('VotingControls', () => {
  const mockOnVote = jest.fn();
  const mockOnRemoveVote = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders vote button when user has not voted', () => {
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={false}
        isChosen={false}
        onVote={mockOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    const voteButton = screen.getByRole('button', { name: /vote/i });
    expect(voteButton).toBeInTheDocument();
    expect(voteButton).toHaveTextContent('Vote');
    expect(screen.queryByText('Your vote')).not.toBeInTheDocument();
  });

  it('renders voted button when user has voted', () => {
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={true}
        isChosen={false}
        onVote={mockOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    const voteButton = screen.getByRole('button', { name: /voted/i });
    expect(voteButton).toBeInTheDocument();
    expect(voteButton).toHaveTextContent('Voted');
    expect(screen.getByText('Your vote')).toBeInTheDocument();
  });

  it('calls onVote when clicking vote button', async () => {
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={false}
        isChosen={false}
        onVote={mockOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    const voteButton = screen.getByRole('button', { name: /vote/i });
    fireEvent.click(voteButton);

    await waitFor(() => {
      expect(mockOnVote).toHaveBeenCalledWith('activity-1');
    });
  });

  it('calls onRemoveVote when clicking voted button', async () => {
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={true}
        isChosen={false}
        onVote={mockOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    const voteButton = screen.getByRole('button', { name: /voted/i });
    fireEvent.click(voteButton);

    await waitFor(() => {
      expect(mockOnRemoveVote).toHaveBeenCalledWith('activity-1');
    });
  });

  it('shows loading state during vote action', async () => {
    const slowOnVote = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={false}
        isChosen={false}
        onVote={slowOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    const voteButton = screen.getByRole('button', { name: /vote/i });
    fireEvent.click(voteButton);

    // Should show loading spinner
    expect(screen.getByText('⟳')).toBeInTheDocument();
    expect(voteButton).toBeDisabled();

    await waitFor(() => {
      expect(slowOnVote).toHaveBeenCalled();
    });
  });

  it('disables button when disabled prop is true', () => {
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={false}
        isChosen={false}
        onVote={mockOnVote}
        onRemoveVote={mockOnRemoveVote}
        disabled={true}
      />
    );

    const voteButton = screen.getByRole('button', { name: /vote/i });
    expect(voteButton).toBeDisabled();
  });

  it('applies chosen activity styling when activity is chosen', () => {
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={true}
        isChosen={true}
        onVote={mockOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    const voteButton = screen.getByRole('button', { name: /voted/i });
    expect(voteButton).toHaveClass('chosen-activity');
  });

  it('does not show vote counts or statistics', () => {
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={true}
        isChosen={false}
        onVote={mockOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    // Ensure no vote counts, percentages, or other user voting info is displayed
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ votes?/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/other users/i)).not.toBeInTheDocument();
  });

  it('handles vote errors gracefully', async () => {
    const errorOnVote = jest.fn().mockRejectedValue(new Error('Vote failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    render(
      <VotingControls
        activityId="activity-1"
        hasUserVoted={false}
        isChosen={false}
        onVote={errorOnVote}
        onRemoveVote={mockOnRemoveVote}
      />
    );

    const voteButton = screen.getByRole('button', { name: /vote/i });
    fireEvent.click(voteButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Voting error:', expect.any(Error));
    });

    // Button should be re-enabled after error
    expect(voteButton).not.toBeDisabled();
    
    consoleSpy.mockRestore();
  });
});