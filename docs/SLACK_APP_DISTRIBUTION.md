# Slack App Distribution Setup Guide

## Overview

This guide will help you configure your Slack app for distribution, making it much easier for users to connect their Slack workspaces without manual channel invitations.

## Step 1: Enable App Distribution

1. **Go to your Slack App**: https://api.slack.com/apps
2. **Select your app** (UnifiedHQ Integration)
3. **Navigate to "Manage Distribution"** in the left sidebar
4. **Click "Enable Distribution"**

## Step 2: Configure App Information

### Basic Information
- **App Name**: UnifiedHQ Integration
- **Short Description**: "Connect your Slack workspace to UnifiedHQ for unified activity tracking"
- **Long Description**: "UnifiedHQ Integration allows you to connect your Slack workspace and monitor channel activity alongside your GitHub repositories. Get a unified view of all your team's activities in one dashboard."

### App Icon
- Upload a 512x512px icon (PNG format)
- This will be displayed in the Slack App Directory

### App Categories
- Select: **Productivity** or **Developer Tools**

## Step 3: Update OAuth Scopes

### Bot Token Scopes (Required for Distribution)
Add these scopes to your Bot Token Scopes:
- `channels:history` - Read messages in channels
- `channels:read` - View basic information about channels
- `groups:read` - View basic information about private channels
- `im:history` - Read messages in direct messages
- `mpim:history` - Read messages in group direct messages
- `users:read` - View people in workspace
- `team:read` - View workspace details
- `channels:join` - Join public channels

### User Token Scopes (Keep Existing)
Keep your existing User Token Scopes:
- `channels:read`
- `channels:history`
- `groups:read`
- `im:history`
- `mpim:history`
- `users:read`
- `team:read`
- `channels:join`

## Step 4: Update Environment Variables

Add the Bot Token to your `.env`:

```env
# Existing User OAuth (keep these)
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_REDIRECT_URI=http://localhost:3000/api/integrations/slack/callback

# New Bot Token (add this)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
```

## Step 5: Update Code for Bot Token

The bot token allows the app to:
- Automatically join public channels
- Access channels without manual invitation
- Work more reliably across different workspaces

## Step 6: Submit for Review (Optional)

### For Public Distribution
1. **Complete all required fields** in App Information
2. **Test thoroughly** with multiple workspaces
3. **Submit for review** to Slack App Directory
4. **Wait for approval** (usually 1-2 weeks)

### For Internal/Private Distribution
1. **Skip the review process**
2. **Share the app directly** with users
3. **Users install via**: https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID

## Benefits of App Distribution

✅ **No manual channel invitations** - App can join public channels automatically
✅ **Professional setup** - Users just install the app to their workspace
✅ **Better permissions** - App gets proper bot permissions
✅ **Scalable** - Works with any number of users/workspaces
✅ **Reliable** - Less prone to permission issues

## Testing the Distribution

1. **Install the app** to a test workspace
2. **Verify bot permissions** - Check that the bot can join channels
3. **Test channel access** - Ensure the bot can read messages
4. **Test the integration** - Connect via UnifiedHQ and sync activities

## Next Steps

After enabling distribution:
1. Update the code to use bot tokens
2. Test with multiple workspaces
3. Submit for public distribution (if desired)
4. Update user documentation
