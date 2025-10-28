# GitHub Integration Setup

This document explains how to set up GitHub integration for UnifiedHQ.

## Prerequisites

1. A GitHub account
2. A GitHub OAuth App created in your GitHub account

## GitHub OAuth App Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the following details:
   - **Application name**: UnifiedHQ
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/api/integrations/github/callback` (or your production URL)
4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# GitHub OAuth
GH_CLIENT_ID="your-github-client-id"
GH_CLIENT_SECRET="your-github-client-secret"
```

## Features

The GitHub integration provides:

- **OAuth Authentication**: Users can sign in with GitHub or connect their GitHub account
- **Activity Tracking**: Fetches and displays recent GitHub activity including:
  - Commits and pushes
  - Pull requests (opened, closed, reviewed)
  - Issues (opened, closed, commented)
  - Repository events (created, forked, starred)
  - Releases
- **Real-time Sync**: Manual sync button to fetch latest activity
- **Token Management**: Automatic token refresh and error handling
- **Unified Dashboard**: All GitHub activity displayed in the main activity feed

## Usage

1. **Connect GitHub**: Go to `/integrations` and click "Connect" on the GitHub card
2. **View Activity**: GitHub activity will appear in the main dashboard activity feed
3. **Sync Activity**: Use the "Sync" button to fetch the latest GitHub activity
4. **Disconnect**: Use the "Disconnect" button to remove GitHub integration

## API Endpoints

- `GET /api/integrations/github/connect` - Initiate GitHub OAuth flow
- `GET /api/integrations/github/callback` - Handle OAuth callback
- `POST /api/github/sync` - Sync GitHub activity
- `GET /api/github/sync` - Check GitHub connection status
- `POST /api/integrations/github/disconnect` - Disconnect GitHub
- `GET /api/activities` - Fetch all user activities

## Database Schema

The integration uses two new tables:

- **Connection**: Stores OAuth tokens for each integration
- **Activity**: Stores fetched activity data with deduplication

## Security

- OAuth tokens are stored securely in the database
- Token expiration is handled gracefully with user notifications
- All API endpoints require authentication
- Rate limiting is applied to prevent abuse

## Troubleshooting

### Common Issues

1. **"GitHub not connected"**: User needs to connect their GitHub account via the integrations page
2. **"Token expired"**: User needs to reconnect their GitHub account
3. **"Failed to fetch activity"**: Check GitHub API rate limits and token validity

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` to see detailed error messages in the console.
