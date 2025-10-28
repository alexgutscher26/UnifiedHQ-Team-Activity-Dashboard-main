# GitHub Templates and Workflows

This directory contains templates and workflows for managing issues, pull requests, and automated checks in the UnifiedHQ project.

## 📁 Directory Structure

```
.github/
├── ISSUE_TEMPLATE/           # Issue templates
│   ├── bug_report.md         # Bug report template
│   ├── feature_request.md    # Feature request template
│   ├── question.md           # Question template
│   └── config.yml            # Issue template configuration
├── PULL_REQUEST_TEMPLATE/    # Pull request templates
│   ├── pull_request_template.md      # Main PR template
│   ├── hotfix_template.md            # Hotfix PR template
│   └── documentation_template.md     # Documentation PR template
├── workflows/                # GitHub Actions workflows
│   └── pr-checks.yml         # PR validation workflow
├── PULL_REQUEST_GUIDELINES.md # PR guidelines
└── README.md                 # This file
```

## 🐛 Issue Templates

### Bug Report
Use the bug report template when reporting issues or bugs. It includes:
- Clear problem description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Screenshots/videos
- Error messages and logs

### Feature Request
Use the feature request template when suggesting new features. It includes:
- Problem statement
- Proposed solution
- User stories
- Technical considerations
- Mockups/examples
- Success metrics

### Question
Use the question template when asking questions about the project. It includes:
- Clear question formulation
- Context and background
- What you've already tried
- Specific information needed

## 🔄 Pull Request Templates

### Main PR Template
The default template for most pull requests. Includes:
- Description and motivation
- Type of change
- Testing requirements
- Code quality checklist
- Performance considerations
- Security considerations
- Deployment requirements

### Hotfix Template
For critical fixes that need immediate deployment. Includes:
- Emergency fix description
- Urgency level
- Immediate testing
- Deployment plan
- Risk assessment
- Rollback plan

### Documentation Template
For documentation updates. Includes:
- Documentation changes
- Content review checklist
- Accuracy verification
- Style and format checks

## 🔧 GitHub Actions

### PR Checks Workflow
Automated checks that run on every pull request:
- **Lint and Format**: ESLint and Prettier checks
- **Type Check**: TypeScript compilation check
- **Build Check**: Ensures the application builds successfully
- **Security Audit**: npm audit for vulnerabilities
- **PR Size Check**: Warns if PR is too large

## 📋 Usage Guidelines

### For Contributors

1. **Creating Issues**:
   - Choose the appropriate template
   - Fill out all relevant sections
   - Provide clear descriptions and context
   - Include screenshots or code examples when helpful

2. **Creating Pull Requests**:
   - Use the main template for most changes
   - Use hotfix template for critical fixes
   - Use documentation template for docs updates
   - Complete all relevant checklists
   - Link related issues

3. **Following Guidelines**:
   - Read the PR guidelines before creating PRs
   - Follow the contributing guide
   - Ensure all checks pass
   - Respond to feedback promptly

### For Maintainers

1. **Reviewing Issues**:
   - Check if the template was used correctly
   - Verify all necessary information is provided
   - Add appropriate labels
   - Assign to relevant team members

2. **Reviewing Pull Requests**:
   - Use the review checklist in the guidelines
   - Check code quality and standards
   - Verify testing requirements
   - Ensure project-specific rules are followed

3. **Managing Workflows**:
   - Monitor workflow runs
   - Address any failures
   - Update workflows as needed

## 🎯 Best Practices

### Issue Management
- Use clear, descriptive titles
- Add appropriate labels
- Assign to team members
- Close issues when resolved
- Link related issues and PRs

### Pull Request Management
- Keep PRs focused and small
- Use descriptive titles and descriptions
- Request appropriate reviewers
- Address feedback promptly
- Merge when ready

### Workflow Management
- Monitor workflow runs
- Fix failing checks quickly
- Update workflows as project evolves
- Document workflow changes

## 🔍 Customization

### Adding New Templates
1. Create a new `.md` file in the appropriate directory
2. Follow the existing template structure
3. Update this README to document the new template
4. Test the template by creating a test issue/PR

### Modifying Existing Templates
1. Edit the template file
2. Test the changes
3. Update documentation if needed
4. Communicate changes to the team

### Adding New Workflows
1. Create a new `.yml` file in the workflows directory
2. Follow GitHub Actions best practices
3. Test the workflow
4. Document the workflow in this README

## 📚 Resources

### GitHub Documentation
- [Issue Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [Pull Request Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
- [GitHub Actions](https://docs.github.com/en/actions)

### Project Documentation
- [Contributing Guide](../CONTRIBUTING.md)
- [Pull Request Guidelines](PULL_REQUEST_GUIDELINES.md)
- [Project README](../README.md)

## 🤝 Contributing

To improve these templates and workflows:

1. Create an issue to discuss changes
2. Create a pull request with your improvements
3. Follow the existing template structure
4. Update documentation as needed
5. Test your changes thoroughly

## 📞 Support

If you have questions about using these templates:

1. Check the project documentation
2. Search existing issues
3. Create a new issue with the question template
4. Ask in team discussions

---

**These templates help maintain consistency and quality across the project. Please use them and suggest improvements! 🚀**
