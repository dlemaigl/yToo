import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityProposalForm from './ActivityProposalForm';

// Mock the API client
jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const mockOnActivityCreated = jest.fn();
const mockOnCancel = jest.fn();

const defaultProps = {
  groupId: 'test-group-id',
  onActivityCreated: mockOnActivityCreated,
  onCancel: mockOnCancel,
};

describe('ActivityProposalForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form with all required fields', () => {
    render(<ActivityProposalForm {...defaultProps} />);
    
    expect(screen.getByText('Propose New Activity')).toBeInTheDocument();
    expect(screen.getByText(/Your identity will remain anonymous/)).toBeInTheDocument();
    expect(screen.getByLabelText('Activity Title *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Propose Activity' })).toBeInTheDocument();
  });

  it('shows error when submitting with only whitespace title', async () => {
    render(<ActivityProposalForm {...defaultProps} />);
    
    const titleInput = screen.getByLabelText('Activity Title *');
    
    // Add whitespace to trigger validation
    fireEvent.change(titleInput, { target: { value: '   ' } });
    
    // Submit the form directly
    const form = titleInput.closest('form');
    fireEvent.submit(form!);
    
    await waitFor(() => {
      expect(screen.getByText('Activity title is required')).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ActivityProposalForm {...defaultProps} />);
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('submits form with title only', async () => {
    const { apiClient } = require('../services/apiClient');
    const mockActivity = { id: '1', title: 'Test Activity', isChosen: false };
    apiClient.post.mockResolvedValue({ data: { activity: mockActivity } });

    render(<ActivityProposalForm {...defaultProps} />);
    
    const titleInput = screen.getByLabelText('Activity Title *');
    const submitButton = screen.getByRole('button', { name: 'Propose Activity' });
    
    fireEvent.change(titleInput, { target: { value: 'Test Activity' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/groups/test-group-id/activities', {
        title: 'Test Activity',
        description: undefined,
      });
      expect(mockOnActivityCreated).toHaveBeenCalledWith(mockActivity);
    });
  });

  it('submits form with title and description', async () => {
    const { apiClient } = require('../services/apiClient');
    const mockActivity = { id: '1', title: 'Test Activity', description: 'Test Description', isChosen: false };
    apiClient.post.mockResolvedValue({ data: { activity: mockActivity } });

    render(<ActivityProposalForm {...defaultProps} />);
    
    const titleInput = screen.getByLabelText('Activity Title *');
    const descriptionInput = screen.getByLabelText('Description (optional)');
    const submitButton = screen.getByRole('button', { name: 'Propose Activity' });
    
    fireEvent.change(titleInput, { target: { value: 'Test Activity' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/groups/test-group-id/activities', {
        title: 'Test Activity',
        description: 'Test Description',
      });
      expect(mockOnActivityCreated).toHaveBeenCalledWith(mockActivity);
    });
  });

  it('handles API errors gracefully', async () => {
    const { apiClient } = require('../services/apiClient');
    apiClient.post.mockRejectedValue({ message: 'Failed to create activity' });

    render(<ActivityProposalForm {...defaultProps} />);
    
    const titleInput = screen.getByLabelText('Activity Title *');
    const submitButton = screen.getByRole('button', { name: 'Propose Activity' });
    
    fireEvent.change(titleInput, { target: { value: 'Test Activity' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to create activity')).toBeInTheDocument();
    });
  });

  it('disables submit button when title is empty', () => {
    render(<ActivityProposalForm {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: 'Propose Activity' });
    expect(submitButton).toBeDisabled();
    
    const titleInput = screen.getByLabelText('Activity Title *');
    fireEvent.change(titleInput, { target: { value: 'Test' } });
    
    expect(submitButton).not.toBeDisabled();
  });
});