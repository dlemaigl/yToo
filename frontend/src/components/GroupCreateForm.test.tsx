import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupCreateForm from './GroupCreateForm';

// Mock the API client
jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '../services/apiClient';
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('GroupCreateForm', () => {
  const mockOnGroupCreated = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form elements', () => {
    render(
      <GroupCreateForm 
        onGroupCreated={mockOnGroupCreated} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByText('Create New Group')).toBeInTheDocument();
    expect(screen.getByLabelText('Group Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('shows error for empty group name', async () => {
    render(
      <GroupCreateForm 
        onGroupCreated={mockOnGroupCreated} 
        onCancel={mockOnCancel} 
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Create Group' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Group name is required')).toBeInTheDocument();
    });
  });

  test('calls onCancel when cancel button is clicked', () => {
    render(
      <GroupCreateForm 
        onGroupCreated={mockOnGroupCreated} 
        onCancel={mockOnCancel} 
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('creates group successfully', async () => {
    const mockGroup = { id: '1', name: 'Test Group' };
    mockedApiClient.post.mockResolvedValueOnce({
      data: { group: mockGroup }
    });

    render(
      <GroupCreateForm 
        onGroupCreated={mockOnGroupCreated} 
        onCancel={mockOnCancel} 
      />
    );

    const nameInput = screen.getByLabelText('Group Name');
    const submitButton = screen.getByRole('button', { name: 'Create Group' });

    fireEvent.change(nameInput, { target: { value: 'Test Group' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedApiClient.post).toHaveBeenCalledWith('/groups', {
        name: 'Test Group'
      });
      expect(mockOnGroupCreated).toHaveBeenCalledWith(mockGroup);
    });
  });
});