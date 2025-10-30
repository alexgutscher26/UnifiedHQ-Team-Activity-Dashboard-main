# Workflow Monitoring and Reporting System

This document describes the comprehensive workflow monitoring and reporting system implemented for UnifiedHQ. The system provides automated tracking, analysis, and reporting of GitHub Actions workflow performance.

## Overview

The workflow monitoring system consists of several components:

1. **GitHub Actions Workflow** - Automated data collection and reporting
2. **Analytics Engine** - Local analysis and insights generation
3. **Dashboard Generator** - Visual reporting and metrics display
4. **CLI Tools** - Command-line interface for monitoring operations
5. **Configuration Management** - Customizable thresholds and settings

## Components

### 1. GitHub Actions Workflow (`workflow-monitoring.yml`)

The main workflow runs on a schedule and provides:

- **Daily Reports** - Generated at 9 AM UTC
- **Weekly Reports** - Generated on Sundays at 10 AM UTC
- **Manual Triggers** - On-demand report generation
- **Performance Analysis** - Automated performance trend analysis
- **Alert System** - Notifications for critical issues

#### Key Features:

- Collects metrics from all workflow runs
- Calculates success rates and performance trends
- Generates comprehensive reports with recommendations
- Creates GitHub issues for report tracking
- Sends Slack notifications for alerts
- Automatically cleans up old reports and artifacts

### 2. Analytics Engine (`workflow-analytics.js`)

Local analytics tool for detailed workflow analysis:

```bash
# Analyze last 30 days
node scripts/workflow-analytics.js --repo "owner/repo"

# Custom date range
node scripts/workflow-analytics.js --repo "owner/repo" --days 14

# Save to custom file
node scripts/workflow-analytics.js --repo "owner/repo" --output "custom-report.json"
```

#### Features:

- **Success Rate Tracking** - Monitor workflow reliability
- **Performance Metrics** - Duration and compute time analysis
- **Trend Analysis** - Compare recent vs. historical performance
- **Pattern Detection** - Identify time-based and branch-specific issues
- **Alert Generation** - Automated issue detection
- **Recommendations** - Actionable optimization suggestions

### 3. Dashboard Generator (`workflow-dashboard.js`)

Creates interactive HTML dashboards from analytics data:

```bash
# Generate dashboard from analytics report
node scripts/workflow-dashboard.js --input analytics-report.json

# Custom output file
node scripts/workflow-dashboard.js --input data.json --output custom-dashboard.html
```

#### Dashboard Features:

- **Executive Summary** - Key metrics at a glance
- **Workflow Performance Table** - Detailed per-workflow statistics
- **Interactive Charts** - Success rates, durations, and trends
- **Alert Visualization** - Critical and warning alerts
- **Recommendations Display** - Optimization suggestions
- **Responsive Design** - Works on desktop and mobile

### 4. CLI Tool (`workflow-monitor-cli.js`)

Unified command-line interface for all monitoring operations:

```bash
# Complete monitoring cycle
bun run workflow:complete --repo "owner/repo"

# Health check
bun run workflow:health --repo "owner/repo"

# List recent reports
bun run workflow:reports

# Clean old reports
bun run workflow:clean 7
```

#### Available Commands:

- `analytics` - Run workflow analytics
- `dashboard` - Generate dashboard from data
- `complete` - Run full monitoring cycle
- `health` - Check workflow health status
- `list` - List recent reports
- `clean` - Clean old reports
- `config` - Show/update configuration

### 5. Configuration (`workflow-config.json`)

Customizable settings for monitoring behavior:

```json
{
  "monitoring": {
    "enabled": true,
    "thresholds": {
      "success_rate": {
        "critical": 80,
        "warning": 90,
        "target": 95
      }
    }
  },
  "notifications": {
    "slack": {
      "enabled": true,
      "channels": {
        "alerts": "#dev-alerts"
      }
    }
  }
}
```

## Usage Examples

### Daily Monitoring

```bash
# Check workflow health (returns exit code for CI)
bun run workflow:health --repo "myorg/myrepo"

# Generate complete report
bun run workflow:complete --repo "myorg/myrepo"
```

### Performance Analysis

```bash
# Analyze last 14 days
bun run workflow:analytics --repo "myorg/myrepo" --days 14

# Generate dashboard
bun run workflow:dashboard analytics-report.json
```

### Maintenance

```bash
# List all reports
bun run workflow:reports

# Clean reports older than 7 days
bun run workflow:clean 7

# Update configuration
node scripts/workflow-monitor-cli.js config-set monitoring.enabled true
```

## Metrics Collected

### Workflow Metrics

- **Total Runs** - Number of workflow executions
- **Success Rate** - Percentage of successful runs
- **Failed Runs** - Number of failed executions
- **Cancelled Runs** - Number of cancelled executions
- **Average Duration** - Mean execution time
- **Total Compute Time** - Sum of all execution times

### Performance Metrics

- **Fastest/Slowest Workflows** - Performance extremes
- **Most/Least Reliable** - Success rate extremes
- **Daily Activity Trends** - Run patterns over time
- **Failure Patterns** - Time-based and branch-specific issues

### Alert Conditions

- **Critical** - Success rate < 80%
- **Warning** - Success rate < 90%
- **Performance** - Duration > 30 minutes
- **Degradation** - Success rate drop > 10%

## Integration Points

### GitHub Actions

The monitoring workflow integrates with:

- **Repository Events** - Triggered by workflow runs
- **GitHub API** - Collects workflow data
- **Issues API** - Creates report issues
- **Artifacts API** - Stores reports and metrics

### Slack Integration

Notifications are sent to configured channels:

- **General Notifications** - `#dev-notifications`
- **Critical Alerts** - `#dev-alerts`
- **Reports** - `#dev-reports`

### Local Development

Scripts can be run locally for:

- **Development Testing** - Validate monitoring logic
- **Custom Analysis** - Ad-hoc performance reviews
- **Report Generation** - Create reports for specific periods

## Troubleshooting

### Common Issues

1. **Missing GitHub Token**
   ```bash
   export GITHUB_TOKEN="your-token-here"
   ```

2. **No Data Found**
   - Check repository name format: `owner/repo`
   - Verify token has repository access
   - Ensure workflows have run in the specified period

3. **Dashboard Not Loading**
   - Check input JSON file format
   - Verify all required fields are present
   - Open browser developer tools for errors

### Debug Mode

Enable verbose logging:

```bash
DEBUG=1 node scripts/workflow-analytics.js --repo "owner/repo"
```

## Best Practices

### Monitoring Schedule

- **Daily Health Checks** - Automated via GitHub Actions
- **Weekly Deep Analysis** - Review trends and patterns
- **Monthly Optimization** - Implement recommendations

### Alert Response

1. **Critical Alerts** - Immediate investigation required
2. **Warning Alerts** - Monitor closely, plan fixes
3. **Info Alerts** - Consider optimization opportunities

### Report Management

- Keep last 10 reports for historical comparison
- Archive important reports before cleanup
- Review recommendations regularly

## Security Considerations

### Token Management

- Use repository secrets for GitHub tokens
- Limit token scope to necessary permissions
- Rotate tokens regularly

### Data Privacy

- Reports contain workflow metadata only
- No source code or sensitive data is collected
- All data stays within your GitHub organization

## Future Enhancements

### Planned Features

- **Cost Analysis** - Track workflow compute costs
- **Resource Optimization** - Automated caching recommendations
- **Integration Monitoring** - Track external service dependencies
- **Predictive Analytics** - Forecast performance issues

### Integration Opportunities

- **Sentry** - Error tracking integration
- **Datadog** - Metrics forwarding
- **Prometheus** - Custom metrics export
- **PagerDuty** - Alert escalation

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review configuration settings
3. Enable debug mode for detailed logs
4. Create an issue in the repository

## Configuration Reference

### Monitoring Settings

```json
{
  "monitoring": {
    "enabled": true,
    "schedule": {
      "daily_report": "0 9 * * *",
      "weekly_report": "0 10 * * 0"
    },
    "thresholds": {
      "success_rate": {
        "critical": 80,
        "warning": 90,
        "target": 95
      },
      "duration": {
        "warning": 600,
        "critical": 1800
      }
    }
  }
}
```

### Notification Settings

```json
{
  "notifications": {
    "slack": {
      "enabled": true,
      "channels": {
        "general": "#dev-notifications",
        "alerts": "#dev-alerts"
      }
    },
    "github": {
      "create_issues": true,
      "labels": ["workflow-report", "monitoring"]
    }
  }
}
```

### Workflow-Specific Settings

```json
{
  "workflows": {
    "ci": {
      "name": "CI Pipeline",
      "priority": "high",
      "success_rate_target": 98,
      "duration_target": 300
    }
  }
}
```