# Requirements Document

## Introduction

yToo is a group activity voting application that enables users to create groups, invite others via shareable links, propose activities, and democratically choose activities through majority voting. The app facilitates group decision-making by allowing members to vote on proposed activities, with the activity receiving the majority of votes being marked as the chosen one.

## Requirements

### Requirement 1

**User Story:** As a user, I want to create a new group, so that I can organize activities with friends or colleagues.

#### Acceptance Criteria

1. WHEN a user clicks "Create Group" THEN the system SHALL display a group creation form
2. WHEN a user submits a valid group name THEN the system SHALL create a new group with the user as the creator
3. WHEN a group is created THEN the system SHALL generate a unique shareable invitation link
4. WHEN a group is created THEN the system SHALL automatically add the creator as the first member

### Requirement 2

**User Story:** As a group creator, I want to invite others to my group using a shareable link, so that they can join and participate in activity voting.

#### Acceptance Criteria

1. WHEN a group creator accesses their group THEN the system SHALL display the invitation link
2. WHEN someone clicks on an invitation link THEN the system SHALL redirect them to a join group page
3. WHEN a user joins via invitation link THEN the system SHALL add them to the group member list
4. WHEN a user joins a group THEN the system SHALL notify existing members of the new addition

### Requirement 3

**User Story:** As a group member, I want to create new activity proposals anonymously, so that the group can vote on activities without knowing who proposed them.

#### Acceptance Criteria

1. WHEN a group member clicks "Propose Activity" THEN the system SHALL display an activity creation form
2. WHEN a member submits a valid activity proposal THEN the system SHALL add it to the group's activity list without revealing the proposer's identity
3. WHEN an activity is created THEN the system SHALL notify all group members without showing who created it
4. WHEN an activity is created THEN the system SHALL initialize it with zero votes

### Requirement 4

**User Story:** As a group member, I want to vote on proposed activities anonymously, so that I can express my preference without others knowing my choice.

#### Acceptance Criteria

1. WHEN a member views the group's activities THEN the system SHALL display all proposed activities with voting options
2. WHEN a member votes for an activity THEN the system SHALL record their vote without revealing it to other members
3. WHEN a member changes their vote THEN the system SHALL update their previous vote privately
4. WHEN a member votes THEN the system SHALL NOT display vote counts or voting details to any members

### Requirement 5

**User Story:** As a group member, I want to see which activity has been chosen by majority vote without knowing vote counts or who voted, so that I know what the group has decided to do while maintaining privacy.

#### Acceptance Criteria

1. WHEN votes are cast THEN the system SHALL continuously calculate vote totals privately without displaying counts
2. WHEN an activity receives more than 50% of member votes THEN the system SHALL mark it as "chosen"
3. WHEN an activity is marked as chosen THEN the system SHALL visually highlight it differently from other activities
4. WHEN multiple activities tie for majority THEN the system SHALL indicate no activity is chosen yet
5. WHEN a chosen activity loses majority due to vote changes THEN the system SHALL remove the "chosen" status
6. WHEN members view activities THEN the system SHALL NOT display vote counts, percentages, or voting statistics

### Requirement 6

**User Story:** As a user, I want to authenticate and have my own account, so that I can create groups and maintain my voting history.

#### Acceptance Criteria

1. WHEN a user visits the app THEN the system SHALL provide login/signup options
2. WHEN a user creates an account THEN the system SHALL require a unique username and password
3. WHEN a user logs in THEN the system SHALL authenticate their credentials
4. WHEN a user is authenticated THEN the system SHALL display their groups and allow group creation

### Requirement 7

**User Story:** As a group member, I want to see real-time updates when activities are chosen or new activities are proposed, so that I stay informed of group decisions while maintaining voting privacy.

#### Acceptance Criteria

1. WHEN another member votes THEN the system SHALL update chosen activity status in real-time without revealing vote details
2. WHEN a new activity is proposed THEN the system SHALL display it immediately to all members without showing the proposer
3. WHEN an activity becomes chosen THEN the system SHALL update the status for all members immediately
4. WHEN a member joins the group THEN the system SHALL update the member list for all existing members
5. WHEN activity status changes THEN the system SHALL NOT reveal voting statistics or individual votes