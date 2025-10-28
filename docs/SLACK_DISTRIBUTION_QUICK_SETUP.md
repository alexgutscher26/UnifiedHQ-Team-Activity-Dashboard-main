# Slack App Distribution - Quick Setup Guide

## 🚀 Enable App Distribution

### 1. Configure Your Slack App

1. **Go to**: https://api.slack.com/apps
2. **Select your app**: UnifiedHQ Integration
3. **Navigate to**: "Manage Distribution" (left sidebar)
4. **Click**: "Enable Distribution"

### 2. Add Bot Token Scopes

In **OAuth & Permissions** → **Bot Token Scopes**, add:
- `channels:history`
- `channels:read` 
- `groups:read`
- `im:history`
- `mpim:history`
- `users:read`
- `team:read`
- `channels:join`

### 3. Get Your Bot Token

After adding scopes, you'll see:
- **Bot User OAuth Token**: `xoxb-...` (copy this)

### 4. Update Environment Variables

Add to your `.env`:
```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
```

### 5. Install App to Workspace

1. **Go to**: "Install App" in your Slack app settings
2. **Click**: "Install to Workspace"
3. **Review permissions** and click "Allow"

## 🎯 Benefits of App Distribution

✅ **No manual channel invitations** - Bot can join public channels automatically
✅ **Better permissions** - Bot gets proper workspace permissions  
✅ **Professional setup** - Users just install the app
✅ **Scalable** - Works with any number of workspaces
✅ **Reliable** - Less permission issues

## 📋 Testing Steps

1. **Install the app** to your workspace
2. **Go to UnifiedHQ** → Integrations
3. **Click "Connect Slack"** 
4. **Select channels** (should work without manual invitation)
5. **Sync activities** - should work smoothly!

## 🔄 For Public Distribution

If you want to distribute publicly:

1. **Complete App Information** (name, description, icon)
2. **Submit for Review** to Slack App Directory
3. **Wait for approval** (1-2 weeks)
4. **Users can install** from Slack App Directory

## 💡 Current Status

- ✅ **Bot token support** added to code
- ✅ **Database migration** completed
- ✅ **Auto-join channels** functionality
- ✅ **Better channel access** with bot permissions

**Next**: Install the app to your workspace and test the improved integration!
