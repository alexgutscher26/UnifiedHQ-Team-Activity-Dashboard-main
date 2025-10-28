# GitHub OAuth Integration Setup

This project now includes GitHub OAuth integration for a proper SaaS experience. Users can connect their GitHub accounts to see real commits and pull requests.

## Setup for Development

1. **Create a GitHub OAuth App:**
   - Go to [GitHub Settings > Developer Settings > OAuth Apps](https://github.com/settings/developers)
   - Click "New OAuth App"
   - Set Application name: "Team Dashboard"
   - Set Homepage URL: `http://localhost:3000`
   - Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
   - Click "Register application"
   - Copy the Client ID and generate a Client Secret

2. **Set Environment Variables:**
   ```bash
   GITHUB_CLIENT_ID=your_github_oauth_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
   ```

3. **User Experience:**
   - Users sign in with their GitHub account
   - Users can select any repository they have access to
   - The app automatically uses their OAuth token
   - No manual configuration needed
   - Real-time activity data from their selected repository

## Production Setup

For production deployment, update the OAuth app settings:
- Homepage URL: `https://yourdomain.com`
- Authorization callback URL: `https://yourdomain.com/api/auth/callback/github`

Set these environment variables:
```bash
GITHUB_CLIENT_ID=your_production_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_production_github_oauth_client_secret
BETTER_AUTH_URL=https://yourdomain.com
```

## Features

- **Recent Commits**: Shows the last 10 commits with author, message, and timestamp
- **Pull Requests**: Shows recent PRs (open, closed, merged) with status and details
- **Real-time Updates**: Refresh button to fetch latest data
- **External Links**: Direct links to GitHub commits and PRs
- **Error Handling**: Clear error messages for configuration issues

## API Endpoints

- `GET /api/github?owner=...&repo=...&token=...` - Fetches GitHub data
- Returns commits and pull requests in a unified format
- Includes error handling and rate limiting considerations

## Security Notes

- Personal access tokens are stored in localStorage for development
- For production, use environment variables
- Tokens should have minimal required permissions (repo scope)
- Consider using GitHub Apps for more granular permissions in production

## Troubleshooting

- **"GitHub configuration missing"**: Set up the configuration in the dashboard
- **"Failed to connect to GitHub repository"**: Check your token permissions and repository access
- **"Network error"**: Verify your internet connection and GitHub API status
- **Empty results**: The repository might not have recent commits or PRs

## Next Steps

- Implement real-time updates with webhooks
- Add filtering and search capabilities
- Integrate with Slack apis
