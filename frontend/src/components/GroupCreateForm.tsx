import React, { useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import { apiClient } from '../services/apiClient';

interface GroupCreateFormProps {
  onGroupCreated: (group: any) => void;
  onCancel: () => void;
}

const GroupCreateForm: React.FC<GroupCreateFormProps> = ({ onGroupCreated, onCancel }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    if (name.trim().length > 100) {
      setError('Group name must be 100 characters or less');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/groups', {
        name: name.trim()
      });

      onGroupCreated(response.data.group);
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <h3>Create New Group</h3>
        
        <Input
          id="group-name"
          label="Group Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          placeholder="Enter group name"
          maxLength={100}
          required
        />

        <div className="form-actions">
          <Button type="submit" loading={loading}>
            Create Group
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default GroupCreateForm;