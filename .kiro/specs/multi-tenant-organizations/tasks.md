# Implementation Plan

- [ ] 1. Database schema updates and migrations
  - Update Prisma schema to add Organization, OrganizationMember, and OrganizationInvitation models
  - Add organizationId foreign keys to existing tenant-scoped models (Activity, Connection, etc.)
  - Create and run database migrations for schema changes
    - _Requirements: 4.1, 4.2, 8.1, 8.2_

- [ ] 2. Core organization services and utilities
- [ ] 2.1 Implement organization management service
  - Create OrganizationService with CRUD operations for organizations
  - Implement organization slug generation and validation utilities
  - Add organization membership management methods
  - _Requirements: 1.1, 1.3, 6.4, 6.5_

- [ ] 2.2 Implement permission and role management service
  - Create PermissionService with role-based access control logic
  - Define permission enums and role-permission mappings
  - Implement membership validation and role checking methods
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 2.3 Create invitation system service
  - Implement secure token generation for invitations
  - Create invitation sending and acceptance logic
  - Add invitation expiration and validation handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.4 Write unit tests for core services
  - Test organization CRUD operations with mocked database
  - Test permission checking logic with different roles
  - Test invitation token generation and validation
  - _Requirements: 1.1, 2.1, 5.1_

- [ ] 3. Middleware and request context
- [ ] 3.1 Implement organization context middleware
  - Create middleware to extract organization slug from URL
  - Add organization validation and membership checking
  - Implement request header injection for organization context
  - _Requirements: 6.1, 6.2, 6.3, 4.3_

- [ ] 3.2 Create database query middleware for tenant isolation
  - Implement Prisma middleware for automatic organization filtering
  - Add organizationId injection for create operations
  - Ensure all tenant-scoped queries include organization filter
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 3.3 Update authentication integration
  - Modify Better Auth configuration to include organization context
  - Update session handling to store current organization
  - Implement organization switching in authentication flow
  - _Requirements: 3.4, 3.5, 1.4_

- [ ] 3.4 Write integration tests for middleware
  - Test organization context extraction from URLs
  - Test tenant isolation with different organization contexts
  - Test authentication flow with organization switching
  - _Requirements: 6.1, 4.1, 3.4_

- [ ] 4. Data migration for existing users
- [ ] 4.1 Create personal organizations for existing users
  - Write migration script to create personal organizations
  - Generate unique slugs for each user's personal organization
  - Assign owner role to users in their personal organizations
  - _Requirements: 8.1, 1.1, 1.2, 1.3_

- [ ] 4.2 Migrate existing data to organization-scoped structure
  - Update existing Activity records with organizationId
  - Migrate Connection records to be organization-scoped
  - Update SelectedRepository and SelectedChannel records
  - Migrate cache and preference data to organizations
  - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [ ] 4.3 Update all database queries to include organization filtering
  - Modify existing API routes to filter by organization
  - Update service layer methods to include organizationId
  - Ensure all data access includes tenant isolation
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 4.4 Write migration validation tests
  - Test data integrity after migration
  - Verify organization isolation works correctly
  - Test existing functionality with migrated data
  - _Requirements: 8.1, 8.2, 8.5_

- [ ] 5. API routes and endpoints
- [ ] 5.1 Create organization management API routes
  - Implement POST /api/organizations for creating organizations
  - Add GET /api/organizations for listing user organizations
  - Create PUT /api/organizations/[id] for updating organizations
  - Add DELETE /api/organizations/[id] for organization deletion
  - _Requirements: 1.1, 3.1, 7.4_

- [ ] 5.2 Implement team management API routes
  - Create POST /api/organizations/[id]/invitations for sending invites
  - Add POST /api/invitations/[token]/accept for accepting invites
  - Implement GET /api/organizations/[id]/members for listing members
  - Create PUT /api/organizations/[id]/members/[userId] for role updates
  - Add DELETE /api/organizations/[id]/members/[userId] for removing members
  - _Requirements: 2.1, 2.4, 2.5, 5.3, 5.5_

- [ ] 5.3 Update existing API routes for organization context
  - Modify /api/activities to filter by organization
  - Update /api/integrations to be organization-scoped
  - Modify /api/github and /api/slack routes for tenant isolation
  - Update /api/ai-summary and related routes
  - _Requirements: 4.1, 4.4, 6.1_

- [ ] 5.4 Write API integration tests
  - Test organization CRUD operations via API
  - Test team invitation flow through API endpoints
  - Test organization-scoped data access via existing APIs
  - _Requirements: 1.1, 2.1, 4.1_

- [ ] 6. Frontend components and UI
- [ ] 6.1 Create organization context provider and hooks
  - Implement React context for organization state management
  - Create useOrganization hook for accessing organization data
  - Add usePermissions hook for role-based UI rendering
  - _Requirements: 3.1, 3.2, 5.1, 5.4_

- [ ] 6.2 Build organization switcher component
  - Create dropdown component for switching organizations
  - Implement organization switching logic with navigation
  - Add organization creation option in switcher
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [ ] 6.3 Implement team management interface
  - Create team members list component with role display
  - Build invitation form for adding new members
  - Add role management interface for admins/owners
  - Implement member removal functionality
  - _Requirements: 2.1, 2.4, 5.3, 5.5_

- [ ] 6.4 Create organization settings page
  - Build organization profile editing form
  - Add organization deletion interface for owners
  - Implement billing and subscription management UI
  - _Requirements: 7.1, 7.4, 7.5_

- [ ] 6.5 Update navigation and layout components
  - Modify main navigation to include organization context
  - Update breadcrumbs to show organization hierarchy
  - Add organization branding/customization options
  - _Requirements: 6.1, 6.2, 7.1_

- [ ] 6.6 Write component unit tests
  - Test organization switcher functionality
  - Test team management component interactions
  - Test permission-based UI rendering
  - _Requirements: 3.1, 2.1, 5.1_

- [ ] 7. App router updates and dynamic routing
- [ ] 7.1 Implement dynamic organization routing
  - Create [orgSlug] dynamic route structure
  - Move existing pages under organization-scoped routes
  - Update page components to use organization context
  - _Requirements: 6.1, 6.2, 6.5_

- [ ] 7.2 Update layout components for organization context
  - Modify root layout to include organization provider
  - Create organization-scoped layout component
  - Update navigation components for organization awareness
  - _Requirements: 6.1, 3.4, 3.5_

- [ ] 7.3 Implement invitation acceptance page
  - Create /invitations/[token] page for accepting invites
  - Add invitation validation and user authentication flow
  - Implement redirect to organization after acceptance
  - _Requirements: 2.3, 2.4, 2.5_

- [ ] 7.4 Create organization onboarding flow
  - Build organization creation wizard for new users
  - Add team setup and invitation sending interface
  - Implement integration setup within organization context
  - _Requirements: 1.1, 1.2, 2.1_

- [ ] 7.5 Write end-to-end tests for routing
  - Test organization-scoped navigation flows
  - Test invitation acceptance and redirect flow
  - Test organization switching with URL updates
  - _Requirements: 6.1, 2.3, 3.4_

- [ ] 8. Integration and final wiring
- [ ] 8.1 Update existing integrations for organization scope
  - Modify GitHub integration to be organization-specific
  - Update Slack integration for organization-scoped channels
  - Ensure AI summary generation respects organization boundaries
  - _Requirements: 4.3, 4.4, 7.3_

- [ ] 8.2 Implement organization-aware caching
  - Update Redis caching to include organization context
  - Modify cache keys to prevent cross-organization data leaks
  - Implement cache invalidation for organization changes
  - _Requirements: 4.1, 4.2_

- [ ] 8.3 Add error handling and validation
  - Implement organization-specific error boundaries
  - Add validation for organization slugs and permissions
  - Create user-friendly error pages for organization issues
  - _Requirements: 6.3, 5.2, 5.4_

- [ ] 8.4 Performance optimization and monitoring
  - Add database indexes for organization-scoped queries
  - Implement query optimization for multi-tenant access patterns
  - Add monitoring for organization-specific performance metrics
  - _Requirements: 4.1, 4.2_

- [ ] 8.5 Write comprehensive integration tests
  - Test complete organization creation and setup flow
  - Test team collaboration features across organizations
  - Test data isolation between different organizations
  - _Requirements: 1.1, 2.1, 4.1_