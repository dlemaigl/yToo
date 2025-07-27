# Group Deletion Feature Design

## Overview

This feature enables group creators to delete groups they have created through a RESTful API endpoint. The implementation leverages existing database cascade constraints to ensure proper cleanup of all related data while providing real-time notifications to affected group members.

The design builds upon the existing Group model's `delete()` method and extends the current API structure with proper authorization, validation, and notification mechanisms.

## Architecture

### API Layer
- **Endpoint**: `DELETE /api/groups/:id`
- **Authentication**: Bearer token required
- **Authorization**: Only group creator can delete
- **Validation**: UUID format validation for group ID
- **Response**: JSON confirmation with appropriate HTTP status codes

### Service Layer
- **Group Deletion Service**: Orchestrates the deletion process
- **Notification Service**: Handles real-time member notifications via WebSocket
- **Transaction Management**: Ensures atomicity using database transactions

### Data Layer
- **Database Cascade**: Leverages existing `ON DELETE CASCADE` constraints
- **Transaction Scope**: Wraps deletion in database transaction for consistency
- **Cleanup Order**: Database handles proper deletion order automatically

## Components and Interfaces

### 1. API Route Handler

```javascript
// DELETE /api/groups/:id
router.delete('/:id', 
  authenticateToken, 
  validateUUID('id'),
  async (req, res) => {
    // Implementation details in tasks
  }
);
```

**Input Validation:**
- Group ID must be valid UUID format
- User must be authenticated
- User must be the group creator

**Response Formats:**
- `200`: Successful deletion with confirmation message
- `403`: Unauthorized (not group creator)
- `404`: Group not found
- `500`: Server error during deletion

### 2. Group Deletion Service

```javascript
class GroupDeletionService {
  static async deleteGroup(groupId, requestingUserId) {
    // Verify authorization
    // Get group members for notifications
    // Execute deletion with transaction
    // Send notifications
  }
}
```

**Responsibilities:**
- Authorization verification
- Member list retrieval for notifications
- Transaction management
- Notification coordination

### 3. WebSocket Notification System

**Event**: `group:deleted`
**Payload:**
```javascript
{
  groupId: string,
  groupName: string,
  deletedAt: timestamp,
  message: string
}
```

**Delivery Method:**
- Broadcast to all group members except the deleter
- Use existing `broadcastToGroupExcept()` method
- Send before group deletion to ensure delivery

### 4. Database Transaction Flow

```sql
BEGIN;
  -- Get group members for notifications (before deletion)
  SELECT user_id FROM group_members WHERE group_id = $1;
  
  -- Delete group (cascades to all related tables)
  DELETE FROM groups WHERE id = $1 AND creator_id = $2;
COMMIT;
```

**Cascade Order** (handled automatically by database):
1. `votes` table (references activities)
2. `activities` table (references groups)
3. `group_members` table (references groups)
4. `groups` table (main record)

## Data Models

### Existing Models Used

**Group Model Extensions:**
- No changes needed to existing `delete()` method
- Leverage existing `getMembers()` for notification list
- Use existing `findById()` for validation

**Database Schema:**
- Existing cascade constraints handle cleanup:
  - `group_members.group_id` → `groups.id ON DELETE CASCADE`
  - `activities.group_id` → `groups.id ON DELETE CASCADE`
  - `votes.activity_id` → `activities.id ON DELETE CASCADE`

### Data Flow

1. **Pre-deletion**: Retrieve group members for notifications
2. **Deletion**: Execute `DELETE FROM groups WHERE id = ? AND creator_id = ?`
3. **Cascade**: Database automatically removes:
   - All group memberships
   - All group activities
   - All votes on group activities
4. **Post-deletion**: Send notifications to retrieved member list

## Error Handling

### Authorization Errors
- **403 Forbidden**: When non-creator attempts deletion
- **401 Unauthorized**: When authentication token is invalid/missing

### Validation Errors
- **400 Bad Request**: When group ID format is invalid
- **404 Not Found**: When group doesn't exist or user has no access

### System Errors
- **500 Internal Server Error**: Database transaction failures
- **503 Service Unavailable**: WebSocket notification failures (non-blocking)

### Error Response Format
```javascript
{
  error: "Error message",
  code: "ERROR_CODE", // Optional
  details: {} // Optional additional context
}
```

### Transaction Rollback
- Database transaction ensures atomicity
- If deletion fails, no partial cleanup occurs
- WebSocket notification failures don't affect deletion success

## Testing Strategy

### Unit Tests

**Group Route Tests:**
- Test authorization (creator vs non-creator)
- Test validation (invalid UUID format)
- Test error responses (404, 403, 500)
- Test successful deletion response

**Service Layer Tests:**
- Test transaction management
- Test member notification logic
- Test error handling and rollback

### Integration Tests

**Database Integration:**
- Verify cascade deletion works correctly
- Test transaction atomicity
- Verify no orphaned records remain

**WebSocket Integration:**
- Test notification delivery to group members
- Test notification exclusion of deleter
- Test graceful handling of offline members

### End-to-End Tests

**Complete Flow:**
- Create group with multiple members
- Delete group as creator
- Verify all data cleaned up
- Verify notifications received
- Verify group no longer accessible

**Security Tests:**
- Attempt deletion by non-creator
- Attempt deletion with invalid tokens
- Verify proper authorization checks

### Test Data Cleanup
- Use database transactions in tests
- Rollback test data after each test
- Use unique test identifiers to avoid conflicts

## Security Considerations

### Authorization
- Verify requesting user is group creator
- Use existing JWT authentication middleware
- Check authorization before any deletion operations

### Input Validation
- Validate UUID format for group ID
- Sanitize any user inputs (though minimal for DELETE)
- Use parameterized queries (already implemented)

### Data Integrity
- Use database transactions for atomicity
- Leverage existing cascade constraints
- Prevent partial deletions through proper error handling

### Audit Trail
- Log group deletion events
- Include group ID, creator ID, and timestamp
- Use existing logging infrastructure

## Performance Considerations

### Database Performance
- Single DELETE query with cascade (efficient)
- Existing indexes on foreign keys optimize cascade
- Transaction scope minimized for performance

### WebSocket Performance
- Retrieve member list before deletion (single query)
- Use existing `broadcastToGroupExcept()` method
- Non-blocking notification delivery

### Scalability
- Deletion complexity: O(1) for group + O(n) for cascaded records
- WebSocket notifications: O(m) where m = group members
- No additional database queries needed beyond existing patterns

### Monitoring
- Track deletion frequency and performance
- Monitor cascade deletion timing
- Alert on transaction failures or timeouts