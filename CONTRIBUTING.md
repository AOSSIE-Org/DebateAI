# Contributing to DebateAI

⭐ First off, thank you for considering contributing to this project! ⭐

We welcome contributions from everyone. By participating in this project, you agree to abide by our Code of Conduct.

## 🚨 IMPORTANT: Discord Communication is Mandatory

**All project communication MUST happen on Discord. We do not pay attention to GitHub notifications.**

- Join our [Discord server](https://discord.gg/hjUhu33uAn) before starting any work
- Post your PR/issue updates in the relevant Discord channel (**MANDATORY**)
- All discussions, questions, and updates should be on Discord
- GitHub is for code only - Discord is for communication

**PRs without Discord updates will not be reviewed or may face delays.**

## 📋 Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
- [Coding with AI](#coding-with-ai)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Style Guidelines](#code-style-guidelines)
- [Debugging Pre-commit Hooks](#debugging-pre-commit-hooks)
- [Community Guidelines](#community-guidelines)

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- Clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots/Video (if applicable)
- Environment details (OS, browser, versions, etc.)

### Suggesting Features

Feature suggestions are welcome! Please:

- Check if the feature has already been suggested
- Provide a clear description of the feature
- Explain why this feature would be useful
- Include examples of how it would work

### Contributing Code

1. **Submit an Issue First**: For features, bugs, or enhancements, create an issue first
2. **Get Assigned**: Wait to be assigned before starting work (preferable)
3. **Submit Your PR**: Once assigned, create a PR addressing the issue
4. **Unrelated PRs**: Pull requests unrelated to issues may be closed or take longer to review

## 🤖 Coding with AI

We accept the use of AI-powered tools (GitHub Copilot, ChatGPT, Claude, Cursor, etc.) for contributions, whether for code, tests, or documentation.

⚠️ However, transparency is required: if you use AI assistance, please mention it in your PR description. This helps maintainers during code review and ensures the quality of contributions.

What we expect:
- **Disclose AI usage**: A simple note like "Used GitHub Copilot for autocompletion" or "Generated initial test structure with ChatGPT" is sufficient.
- **Specify the scope**: Indicate which parts of your contribution involved AI assistance.
- **Review AI-generated content**: Ensure you understand and have verified any AI-generated code before submitting.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Go** 1.21+ (for backend)
- **Docker** & **Docker Compose** (recommended for full stack)
- **Python 3.x** (for transcription service)

### Setup

1. **Fork the Repository**
   ```bash
   # Click the 'Fork' button at the top right of this page
   ```

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/DebateAI.git
   cd DebateAI
   ```

3. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/AOSSIE-Org/DebateAI.git
   ```

4. **Copy environment variables**
   ```bash
   cp .env.example .env
   # Fill in the required values
   ```

5. **Start with Docker Compose**
   ```bash
   docker-compose up --build
   ```

   Or run services individually:

   **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   **Backend:**
   ```bash
   cd backend
   go mod tidy
   go run cmd/server/main.go
   ```

## 🔄 Development Workflow

### 1. Create a Feature Branch

Always work on a new branch, never on `main` or `dev`:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the project's code style
- Add comments where necessary
- Update documentation if needed

### 3. Test Your Changes

```bash
# Frontend linting
cd frontend && npm run lint

# Backend tests
cd backend && go test ./...
```

### 4. Commit Your Changes

Write clear, concise commit messages:

```bash
git add .
git commit -m "feat: add user authentication"
# or
git commit -m "fix: resolve navigation bug"
```

**Commit Message Format:**
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

### 5. Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

### 6. Push Your Changes

```bash
git push origin feature/your-feature-name
```

## 📤 Pull Request Guidelines

### Before Submitting

- [ ] Your code follows the project's style guidelines
- [ ] You've tested your changes thoroughly
- [ ] You've updated relevant documentation
- [ ] Your commits are clean and well-organized
- [ ] You've rebased with the latest upstream changes
- [ ] You've thought from the reviewer's perspective and made your PR easy to review

### Submitting a Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template with:
   - Clear description of changes
   - Link to related issue(s)
   - Screenshots (if UI changes)
   - Testing steps

### After Submission

- Post your PR in the project's Discord channel for visibility (**IMPORTANT**)
- Respond to review comments promptly
- Make requested changes in new commits
- Be patient - maintainers will review when available
- Use `[WIP]` in your PR title for incomplete PRs

### Reviewing PRs

- Instead of opening duplicate PRs, help review and improve existing ones.
- When reviewing, assess whether the change is actually necessary before diving into implementation details.

## 📝 Code Style Guidelines

### General Guidelines

- Use meaningful variable and function names
- Keep functions small and focused
- Add comments for complex logic
- Remove console.logs before committing
- Avoid code duplication
- Avoid unnecessary complexity

### JavaScript/TypeScript (Frontend)
- Use ES6+ syntax
- Prefer `const` over `let`, avoid `var`
- Use arrow functions where appropriate
- Follow ESLint rules configured in `eslint.config.js`
- Use React hooks best practices

### Go (Backend)
- Follow standard Go formatting (`gofmt`)
- Follow Go naming conventions (camelCase for unexported, PascalCase for exported)
- Add error handling for all operations
- Write table-driven tests where applicable

### Python (Transcription Service)
- Follow PEP 8 style guide
- Use type hints where applicable

## 🔧 Debugging Pre-commit Hooks

Pre-commit hooks help maintain code quality. To install:

```bash
pip install pre-commit
pre-commit install
```

### Common Errors and Solutions

#### Trailing Whitespace / End of File Fixer
```bash
# Pre-commit auto-fixes these. Just re-stage and commit:
git add .
git commit -m "your message"
```

#### Detect Secrets
```bash
# Remove the secret and use environment variables
# Or update baseline for false positives:
detect-secrets scan > .secrets.baseline
git add .secrets.baseline
```

#### Bypassing Pre-commit (Emergency Only)
```bash
git commit --no-verify -m "emergency fix"
```

### Running Pre-commit Manually

```bash
pre-commit run --all-files
pre-commit run trailing-whitespace --all-files
```

## 🌟 Community Guidelines

### Communication

- Be respectful and inclusive
- Provide constructive feedback
- Help others when you can
- Ask questions - no question is too small!

### Progress Updates

- If your work is taking longer than expected, comment on Discord with updates
- Issues should be completed within 5-30 days depending on complexity
- If you can no longer work on an issue, let maintainers know on Discord

### Getting Help

- Check existing documentation first
- Search closed issues for similar problems
- Ask in Discord
- Tag maintainers if your PR is unattended for 1-2 weeks on Discord

## 🎯 Issue Assignment

- One contributor per issue (unless specified otherwise)
- If there are no active PRs for an issue for 2+ days, mention your intent under the issue and begin
- Avoid working on issues which are assigned to someone, even if they are inactive
- Check for existing PRs before starting to avoid duplication

Thank you for contributing to DebateAI! Your efforts help make this project better for everyone. 🚀
