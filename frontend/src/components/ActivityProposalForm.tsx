import React, { useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

interface ActivityProposalFormProps {
  groupId: string;
  onActivityCreated: (activity: any) => void;
  onCancel: () => void;
}

const ActivityProposalForm: React.FC<ActivityProposalFormProps> = ({
  groupId,
  onActivityCreated,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Activity title is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { apiClient } = await import('../services/apiClient');
      const response = await apiClient.post(`/groups/${groupId}/activities`, {
        title: title.trim(),
        description: description.trim() || undefined
      });

      onActivityCreated(response.data.activity);
      
      // Reset form
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to create activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="activity-proposal-form">
        <h3>Propose New Activity</h3>
        <p className="form-description">
          Suggest an activity for the group to vote on. Your identity will remain anonymous.
        </p>
        
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="form-field">
            <label htmlFor="activity-title">Activity Title *</label>
            <Input
              id="activity-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What activity would you like to propose?"
              maxLength={100}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="activity-description">Description (optional)</label>
            <textarea
              id="activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional details about the activity..."
              maxLength={500}
              rows={3}
              disabled={isSubmitting}
              className="activity-description-input"
            />
          </div>
          
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? 'Proposing...' : 'Propose Activity'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
};

export default ActivityProposalForm;