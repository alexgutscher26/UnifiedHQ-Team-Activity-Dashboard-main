# Slack Integration Setup Guide

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Slack Integration
SLACK_CLIENT_ID=your_slack_client_id_here
SLACK_CLIENT_SECRET=your_slack_client_secret_here
SLACK_REDIRECT_URI=http://localhost:3000/api/integrations/slack/callback
```

For production, update the redirect URI to your production domain:
```env
SLACK_REDIRECT_URI=https://yourdomain.com/api/integrations/slack/callback
```

## Slack App Setup

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Enter app name (e.g., "UnifiedHQ Integration")
5. Select your workspace

### 2. Configure OAuth & Permissions

1. In your app settings, go to "OAuth & Permissions"
2. Add the following scopes to "Bot Token Scopes":
   - `channels:read` - View basic information about public channels
   - `channels:history` - View messages in public channels
   - `groups:read` - View basic information about private channels
   - `im:history` - View messages and other content in direct messages
   - `mpim:history` - View messages and other content in group direct messages
   - `users:read` - View people in a workspace
   - `team:read` - View the name, email domain, and icon for workspaces
   - `channels:join` - Join public channels in a workspace

3. Set the redirect URL:
   - Development: `http://localhost:3000/api/integrations/slack/callback`
   - Production: `https://yourdomain.com/api/integrations/slack/callback`

### 3. Install App to Workspace

1. Click "Install to Workspace" in the OAuth & Permissions section
2. Review the permissions and click "Allow"
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
4. Copy the "Client ID" and "Client Secret" from "App Credentials"

### 4. Update Environment Variables

Replace the placeholder values in your `.env` file with the actual values from Slack:

```env
SLACK_CLIENT_ID=A1234567890.1234567890
SLACK_CLIENT_SECRET=your_actual_client_secret_here
SLACK_REDIRECT_URI=http://localhost:3000/api/integrations/slack/callback
```

## Database Migration

Run the Prisma migration to add the new Slack-related tables:

```bash
npx prisma migrate dev --name add_slack_integration
```

This will create:
- `SelectedChannel` table for storing user's selected channels
- `SlackCache` table for caching Slack API responses
- Add `teamId` and `teamName` fields to the `Connection` table

## Testing the Integration

1. Start your development server: `bun run dev`
2. Go to `/integrations` in your app
3. Click "Connect Slack" on the Slack integration card
4. Authorize the app in Slack
5. You should be redirected back with a success message
6. The app will auto-select the first 3 public channels
7. Use "Manage Channels" to customize which channels to track
8. Click "Sync Now" to fetch recent messages
9. Check the activity feed to see Slack messages alongside GitHub activity

## Features

- **OAuth Authentication**: Secure connection to Slack workspace
- **Channel Selection**: Choose which channels to monitor
- **Message Syncing**: Fetch recent messages from selected channels
- **Caching**: Efficient API usage with memory and database caching
- **Activity Feed**: Unified view of GitHub and Slack activities
- **Real-time Updates**: Live updates via Server-Sent Events
- **Error Handling**: Graceful handling of expired tokens and rate limits

## Troubleshooting

### Common Issues

1. **"Slack not connected" error**
   - Check that `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` are set correctly
   - Verify the redirect URI matches exactly

2. **"Invalid redirect URI" error**
   - Ensure the redirect URI in Slack app settings matches your environment variable
   - Check for trailing slashes or protocol mismatches

3. **"Insufficient permissions" error**
   - Verify all required scopes are added to your Slack app
   - Reinstall the app to your workspace after adding scopes

4. **"Token expired" error**
   - Slack tokens don't expire, but the app may have been uninstalled
   - Reconnect the integration to get a new token

5. **No channels showing**
   - Check that the user has access to channels in the workspace
   - Verify the `channels:read` scope is properly configured

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=slack:*
```

This will show detailed logs of Slack API calls and caching behavior.

## Security Notes

- Never commit your `.env` file with real credentials
- Use environment-specific redirect URIs
- Regularly rotate your Slack app credentials
- Monitor API usage to stay within rate limits
- Consider implementing webhook subscriptions for real-time updates (future enhancement)
