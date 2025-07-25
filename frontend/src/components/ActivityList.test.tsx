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
});