# UnifiedHQ Customer Support Knowledge Base

## Product Overview

UnifiedHQ is a comprehensive team activity dashboard that aggregates data from multiple sources (GitHub, Slack, and more) to provide teams with a unified view of their daily activities with AI-powered insights.

### Core Features
- **GitHub Integration**: Track commits, pull requests, issues, and repository activity
- **Slack Integration**: Monitor messages, channels, and team communications  
- **AI Summaries**: Automated daily team activity summaries with OpenAI/OpenRouter
- **Real-time Dashboard**: Live updates with WebSocket connections
- **Team Analytics**: Productivity insights and performance metrics
- **Security**: OAuth 2.0 authentication with session management

## Getting Started

### Account Setup
1. **Sign Up**: Create an account using GitHub OAuth or email
2. **Team Creation**: Set up your team workspace
3. **Integration Setup**: Connect GitHub and Slack accounts
4. **Dashboard Access**: Start viewing your unified team activities

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for real-time updates
- GitHub account for repository integration
- Slack workspace admin access for team integration

## Integration Setup

### GitHub Integration
**Prerequisites:**
- GitHub account with repository access
- Organization admin rights (for team repositories)

**Setup Steps:**
1. Navigate to Settings > Integrations
2. Click "Connect GitHub"
3. Authorize UnifiedHQ OAuth application
4. Select repositories to track
5. Configure activity preferences

**Permissions Required:**
- Repository read access
- Pull request and issue access
- Commit history access
- Organization member access (for team repos)

### Slack Integration
**Prerequisites:**
- Slack workspace membership
- Admin permissions for app installation

**Setup Steps:**
1. Go to Settings > Integrations > Slack
2. Click "Add to Slack"
3. Select workspace and authorize permissions
4. Choose channels to monitor
5. Configure notification preferences

**Permissions Required:**
- Channel read access
- Message history access
- User profile access
- Workspace member list access

### AI Summary Configuration
**Prerequisites:**
- OpenAI API key or OpenRouter account
- Team admin permissions

**Setup Steps:**
1. Navigate to Settings > AI Configuration
2. Choose AI provider (OpenAI or OpenRouter)
3. Enter API credentials
4. Configure summary frequency and preferences
5. Test AI summary generation

## Dashboard Features

### Activity Feed
- **Real-time Updates**: Live stream of team activities
- **Filtering Options**: Filter by team member, integration, or activity type
- **Time Range Selection**: View activities from specific time periods
- **Activity Details**: Click any activity for detailed information

### Team Analytics
- **Productivity Metrics**: Commits, PRs, messages per team member
- **Trend Analysis**: Weekly and monthly activity trends
- **Team Performance**: Comparative analytics across team members
- **Export Options**: Download reports in CSV or PDF format

### AI Summaries
- **Daily Summaries**: Automated end-of-day team activity summaries
- **Weekly Reports**: Comprehensive weekly team performance reports
- **Custom Summaries**: Generate summaries for specific time periods
- **Summary Sharing**: Share summaries with team members or stakeholders

## Troubleshooting

### Common Issues

#### GitHub Integration Not Working
**Symptoms:**
- No GitHub activities appearing in dashboard
- "Connection failed" error messages
- Outdated repository data

**Solutions:**
1. **Check OAuth Connection:**
   - Go to Settings > Integrations > GitHub
   - Verify connection status is "Active"
   - Re-authorize if connection shows as "Expired"

2. **Repository Access:**
   - Ensure you have read access to repositories
   - Check if repository is private and permissions are correct
   - Verify organization settings allow third-party applications

3. **Rate Limiting:**
   - GitHub API has rate limits (5,000 requests/hour)
   - Wait for rate limit reset if exceeded
   - Contact support for enterprise rate limit options

#### Slack Integration Issues
**Symptoms:**
- Missing Slack messages in activity feed
- "Slack connection error" notifications
- Incomplete channel data

**Solutions:**
1. **Workspace Permissions:**
   - Verify app is installed in correct workspace
   - Check if workspace admin has approved the application
   - Ensure bot has access to selected channels

2. **Channel Access:**
   - Bot must be added to private channels manually
   - Public channels are accessible by default
   - Check channel-specific permissions

3. **Token Expiration:**
   - Slack tokens can expire or be revoked
   - Re-authorize the application in Settings
   - Contact workspace admin if permissions were changed

#### AI Summaries Not Generating
**Symptoms:**
- No daily summaries received
- "AI service unavailable" errors
- Incomplete or poor quality summaries

**Solutions:**
1. **API Configuration:**
   - Verify API key is valid and active
   - Check API quota and billing status
   - Test API connection in Settings > AI Configuration

2. **Data Availability:**
   - Summaries require minimum activity data
   - Ensure integrations are working and collecting data
   - Check if time period has sufficient activities

3. **Service Status:**
   - Check OpenAI/OpenRouter service status
   - Verify API endpoint accessibility
   - Contact support for service-specific issues

### Performance Issues

#### Slow Dashboard Loading
**Causes & Solutions:**
- **Large Data Sets**: Filter activities by date range or team member
- **Network Issues**: Check internet connection and try refreshing
- **Browser Cache**: Clear browser cache and cookies
- **Multiple Integrations**: Temporarily disable unused integrations

#### Real-time Updates Not Working
**Troubleshooting Steps:**
1. Check WebSocket connection status in browser developer tools
2. Verify firewall/proxy settings allow WebSocket connections
3. Try refreshing the page or logging out and back in
4. Contact support if issues persist across multiple browsers

## Account Management

### User Roles and Permissions
- **Owner**: Full access to all features and settings
- **Admin**: Manage integrations, users, and team settings
- **Member**: View dashboard and personal activity data
- **Viewer**: Read-only access to team dashboard

### Team Management
- **Adding Members**: Invite via email or share team join link
- **Removing Members**: Admin can remove members from team settings
- **Role Changes**: Owners and admins can modify member roles
- **Team Settings**: Configure team name, timezone, and preferences

### Billing and Subscriptions
- **Plan Types**: Free, Pro, and Enterprise tiers available
- **Usage Limits**: Each plan has different limits for integrations and AI summaries
- **Billing Cycle**: Monthly or annual billing options
- **Plan Changes**: Upgrade or downgrade anytime from account settings

## Security and Privacy

### Data Protection
- **Encryption**: All data encrypted in transit and at rest
- **OAuth 2.0**: Secure authentication without storing passwords
- **Access Control**: Role-based permissions and team isolation
- **Data Retention**: Configurable data retention policies

### Privacy Controls
- **Activity Filtering**: Choose which activities to track and display
- **Personal Data**: Control visibility of personal information
- **Data Export**: Export your data anytime from account settings
- **Account Deletion**: Complete data removal upon account deletion

### Compliance
- **GDPR Compliant**: European data protection standards
- **SOC 2 Type II**: Security and availability controls
- **Privacy Policy**: Detailed privacy practices and data handling
- **Terms of Service**: Clear usage terms and conditions

## API and Integrations

### Available APIs
- **REST API**: Access team activities and analytics programmatically
- **Webhooks**: Real-time notifications for team activities
- **GraphQL**: Flexible data querying for custom integrations
- **Rate Limits**: 1,000 requests per hour for standard plans

### Custom Integrations
- **Webhook Setup**: Configure webhooks for external systems
- **API Keys**: Generate and manage API keys for custom applications
- **Documentation**: Comprehensive API documentation available
- **Support**: Technical support for custom integration development

## Frequently Asked Questions

### General Questions

**Q: What integrations does UnifiedHQ support?**
A: Currently supports GitHub and Slack, with more integrations planned including Jira, Linear, Discord, and Microsoft Teams.

**Q: How much does UnifiedHQ cost?**
A: We offer a free tier for small teams, with Pro and Enterprise plans for larger organizations. Visit our pricing page for current rates.

**Q: Can I use UnifiedHQ with private repositories?**
A: Yes, UnifiedHQ works with both public and private repositories. You'll need appropriate access permissions for private repos.

**Q: How secure is my data?**
A: We use enterprise-grade security including encryption, OAuth 2.0, and SOC 2 compliance. We never store your passwords or sensitive credentials.

### Technical Questions

**Q: What browsers are supported?**
A: All modern browsers including Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated for the best experience.

**Q: Can I export my data?**
A: Yes, you can export your team's activity data and analytics from the account settings page in CSV or JSON format.

**Q: How often is data updated?**
A: GitHub and Slack data is updated in real-time via webhooks. Historical data is synced every 15 minutes.

**Q: What happens if I exceed my plan limits?**
A: You'll receive notifications when approaching limits. Exceeding limits may temporarily restrict new data collection until the next billing cycle or plan upgrade.

### Integration Questions

**Q: Why aren't my GitHub commits showing up?**
A: Check that the repository is connected, you have proper permissions, and the commits are pushed to the tracked branches.

**Q: Can I track multiple Slack workspaces?**
A: Yes, Pro and Enterprise plans support multiple workspace connections. Free plans are limited to one workspace.

**Q: How do I add team members to see our activities?**
A: Invite team members via email from the team settings page. They'll need to connect their own GitHub/Slack accounts to see their activities.

## Contact Support

### Support Channels
- **Email**: support@unifiedhq.com
- **Live Chat**: Available during business hours (9 AM - 6 PM EST)
- **Help Center**: Comprehensive guides and tutorials
- **Community Forum**: User community and peer support

### Response Times
- **Free Plan**: 48-72 hours via email
- **Pro Plan**: 24 hours via email, live chat during business hours
- **Enterprise Plan**: Priority support with dedicated account manager

### When to Contact Support
- Integration setup assistance
- Technical issues not resolved by troubleshooting
- Billing and subscription questions
- Feature requests and feedback
- Security concerns or data questions

### Information to Include
When contacting support, please provide:
- Account email address
- Team name or organization
- Detailed description of the issue
- Steps you've already tried
- Screenshots or error messages (if applicable)
- Browser and operating system information

---

*Last Updated: October 2024*
*Version: 1.0*