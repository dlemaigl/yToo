import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityList from './ActivityList';

const mockActivities = [
  {
    id: '1',
    title: 'Go to the movies',
    description: 'Watch the latest blockbuster',
    isChosen: false,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Have a picnic',
    description: undefined,
    isChosen: true,
    createdAt: '2024-01-14T15:30:00Z',
  },
  {
    id: '3',
    title: 'Play board games',
    isChosen: false,
    createdAt: '2024-01-13T20:15:00Z',
  },
];

describe('ActivityList', () => {
  it('renders empty state when no activities', () => {
    render(<ActivityList activities={[]} />);
    
    expect(screen.getByText('No activities yet')).toBeInTheDocument();
    expect(screen.getByText('Be the first to propose an activity for this group!')).toBeInTheDocument();
  });

  it('renders all activities with correct information', () => {
    render(<ActivityList activities={mockActivities} />);
    
    // Check all activities are rendered
    expect(screen.getByText('Go to the movies')).toBeInTheDocument();
    expect(screen.getByText('Have a picnic')).toBeInTheDocument();
    expect(screen.getByText('Play board games')).toBeInTheDocument();
    
    // Check descriptions
    expect(screen.getByText('Watch the latest blockbuster')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    
    // Check status badges
    expect(screen.getByText('✓ Chosen')).toBeInTheDocument();
    expect(screen.getAllByText('Pending')).toHaveLength(2);
  });

  it('applies correct CSS classes for chosen activities', () => {
    render(<ActivityList activities={mockActivities} />);
    
    const chosenActivity = screen.getByText('Have a picnic').closest('.activity-item');
    const pendingActivity = screen.getByText('Go to the movies').closest('.activity-item');
    
    expect(chosenActivity).toHaveClass('activity-chosen');
    expect(pendingActivity).not.toHaveClass('activity-chosen');
  });

  it('formats dates correctly', () => {
    render(<ActivityList activities={mockActivities} />);
    
    // Check that dates are formatted (exact format may vary by locale)
    expect(screen.getByText(/Proposed.*Jan.*15.*2024/)).toBeInTheDocument();
    expect(screen.getByText(/Proposed.*Jan.*14.*2024/)).toBeInTheDocument();
    expect(screen.getByText(/Proposed.*Jan.*13.*2024/)).toBeInTheDocument();
  });

  it('calls onActivityClick when activity is clicked', () => {
    const mockOnActivityClick = jest.fn();
    render(<ActivityList activities={mockActivities} onActivityClick={mockOnActivityClick} />);
    
    const firstActivity = screen.getByText('Go to the movies').closest('.activity-item');
    fireEvent.click(firstActivity!);
    
    expect(mockOnActivityClick).toHaveBeenCalledWith(mockActivities[0]);
  });

  it('adds clickable class when onActivityClick is provided', () => {
    const mockOnActivityClick = jest.fn();
    render(<ActivityList activities={mockActivities} onActivityClick={mockOnActivityClick} />);
    
    const activityItems = screen.getAllByText(/Proposed/).map(el => el.closest('.activity-item'));
    activityItems.forEach(item => {
      expect(item).toHaveClass('activity-clickable');
    });
  });

  it('does not add clickable class when onActivityClick is not provided', () => {
    render(<ActivityList activities={mockActivities} />);
    
    const activityItems = screen.getAllByText(/Proposed/).map(el => el.closest('.activity-item'));
    activityItems.forEach(item => {
      expect(item).not.toHaveClass('activity-clickable');
    });
  });

  it('handles activities without descriptions gracefully', () => {
    const activitiesWithoutDesc = [
      {
        id: '1',
        title: 'Simple activity',
        isChosen: false,
        createdAt: '2024-01-15T10:00:00Z',
      },
    ];
    
    render(<ActivityList activities={activitiesWithoutDesc} />);
    
    expect(screen.getByText('Simple activity')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  // Voting functionality tests
  describe('Voting functionality', () => {
    const mockOnVote = jest.fn();
    const mockOnRemoveVote = jest.fn();
    const mockHasUserVoted = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      mockHasUserVoted.mockImplementation((activityId) => activityId === '2'); // User voted for activity 2
    });

    it('renders voting controls when voting props are provided', () => {
      render(
        <ActivityList 
          activities={mockActivities}
          onVote={mockOnVote}
          onRemoveVote={mockOnRemoveVote}
          hasUserVoted={mockHasUserVoted}
        />
      );
      
      // Should have voting controls for each activity
      expect(screen.getAllByRole('button', { name: /\+ vote/i })).toHaveLength(2); // Activities 1 and 3
      expect(screen.getByRole('button', { name: /✓ voted/i })).toBeInTheDocument(); // Activity 2
    });

    it('does not render voting controls when voting props are not provided', () => {
      render(<ActivityList activities={mockActivities} />);
      
      expect(screen.queryByRole('button', { name: /vote/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /voted/i })).not.toBeInTheDocument();
    });

    it('shows correct voting state for each activity', () => {
      render(
        <ActivityList 
          activities={mockActivities}
          onVote={mockOnVote}
          onRemoveVote={mockOnRemoveVote}
          hasUserVoted={mockHasUserVoted}
        />
      );
      
      // Activity 1 - not voted
      const activity1 = screen.getByText('Go to the movies').closest('.activity-item');
      expect(activity1?.querySelector('button')).toHaveTextContent('Vote');
      
      // Activity 2 - voted
      const activity2 = screen.getByText('Have a picnic').closest('.activity-item');
      expect(activity2?.querySelector('button')).toHaveTextContent('Voted');
      expect(activity2?.querySelector('.user-vote-indicator')).toHaveTextContent('Your vote');
      
      // Activity 3 - not voted
      const activity3 = screen.getByText('Play board games').closest('.activity-item');
      expect(activity3?.querySelector('button')).toHaveTextContent('Vote');
    });

    it('calls onVote when vote button is clicked', () => {
      render(
        <ActivityList 
          activities={mockActivities}
          onVote={mockOnVote}
          onRemoveVote={mockOnRemoveVote}
          hasUserVoted={mockHasUserVoted}
        />
      );
      
      const voteButtons = screen.getAllByRole('button', { name: /\+ vote/i });
      fireEvent.click(voteButtons[0]);
      
      expect(mockOnVote).toHaveBeenCalledWith('1');
    });

    it('calls onRemoveVote when voted button is clicked', () => {
      render(
        <ActivityList 
          activities={mockActivities}
          onVote={mockOnVote}
          onRemoveVote={mockOnRemoveVote}
          hasUserVoted={mockHasUserVoted}
        />
      );
      
      const votedButton = screen.getByRole('button', { name: /✓ voted/i });
      fireEvent.click(votedButton);
      
      expect(mockOnRemoveVote).toHaveBeenCalledWith('2');
    });

    it('disables voting controls when votingDisabled is true', () => {
      render(
        <ActivityList 
          activities={mockActivities}
          onVote={mockOnVote}
          onRemoveVote={mockOnRemoveVote}
          hasUserVoted={mockHasUserVoted}
          votingDisabled={true}
        />
      );
      
      const allButtons = screen.getAllByRole('button');
      allButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('does not show vote counts or statistics', () => {
      render(
        <ActivityList 
          activities={mockActivities}
          onVote={mockOnVote}
          onRemoveVote={mockOnRemoveVote}
          hasUserVoted={mockHasUserVoted}
        />
      );
      
      // Ensure no vote counts, percentages, or other user voting info is displayed
      expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ votes?/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ of \d+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/other users/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/total votes/i)).not.toBeInTheDocument();
    });

    it('applies chosen activity styling to voting controls', () => {
      render(
        <ActivityList 
          activities={mockActivities}
          onVote={mockOnVote}
          onRemoveVote={mockOnRemoveVote}
          hasUserVoted={mockHasUserVoted}
        />
      );
      
      // Activity 2 is chosen and user has voted
      const chosenActivityButton = screen.getByText('Have a picnic')
        .closest('.activity-item')
        ?.querySelector('button');
      
      expect(chosenActivityButton).toHaveClass('chosen-activity');
    });
  });})
;