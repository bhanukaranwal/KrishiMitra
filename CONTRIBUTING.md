# Contributing to KrishiMitra

Thank you for your interest in contributing to KrishiMitra! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Process](#contributing-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Security](#security)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Docker and Docker Compose
- Git
- Basic understanding of agriculture and sustainability concepts

### Finding Issues

- Check the [Issues](https://github.com/krishimitra/platform/issues) page
- Look for `good first issue` or `help wanted` labels
- Join our [Community Discussions](https://github.com/krishimitra/platform/discussions)

## Development Setup

1. **Fork and Clone**
git clone https://github.com/YOUR_USERNAME/krishimitra-platform.git
cd krishimitra-platform

text

2. **Install Dependencies**
npm run install:all

text

3. **Setup Environment**
cp .env.example .env

Edit .env with your configuration
text

4. **Start Development Environment**
npm run setup:dev

text

5. **Verify Setup**
npm run test

text

## Contributing Process

### 1. Branch Strategy

- `main` - Production ready code
- `develop` - Integration branch for features
- `feature/feature-name` - New features
- `bugfix/bug-name` - Bug fixes
- `hotfix/hotfix-name` - Critical production fixes

### 2. Making Changes

1. **Create a branch**
git checkout -b feature/your-feature-name develop

text

2. **Make your changes**
- Follow coding standards
- Add tests for new functionality
- Update documentation

3. **Commit your changes**
git add .
git commit -m "feat: add crop yield prediction API"

text

4. **Push and create PR**
git push origin feature/your-feature-name

text

### 3. Pull Request Guidelines

- Use clear, descriptive titles
- Reference related issues (#123)
- Include comprehensive description
- Add screenshots for UI changes
- Ensure all tests pass
- Request review from maintainers

## Coding Standards

### JavaScript/TypeScript

- Use TypeScript for new code
- Follow ESLint configuration
- Use Prettier for formatting
- Prefer functional programming
- Use meaningful variable names

// Good
const calculateCarbonCredits = (farmArea: number, methodology: string): number => {
// Implementation
};

// Bad
const calc = (a, m) => {
// Implementation
};

text

### Python

- Follow PEP 8 style guide
- Use Black for formatting
- Use type hints
- Write docstrings for functions
- Use meaningful variable names

def predict_crop_yield(
farm_data: pd.DataFrame,
weather_data: pd.DataFrame,
model_type: str = "xgboost"
) -> np.ndarray:
"""
Predict crop yield using ML models.

text
Args:
    farm_data: Farm characteristics data
    weather_data: Weather information
    model_type: ML model to use for prediction
    
Returns:
    Predicted yield values
"""
# Implementation
text

### Git Commit Messages

Follow conventional commits format:

<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

text

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
feat(api): add carbon credit estimation endpoint
fix(mobile): resolve login authentication issue
docs(readme): update installation instructions

text

## Testing Requirements

### Unit Tests

- Write tests for all new functions
- Maintain >90% code coverage
- Use Jest for JavaScript/TypeScript
- Use pytest for Python

// Example test
describe('CarbonCreditCalculator', () => {
it('should calculate credits correctly for agroforestry', () => {
const calculator = new CarbonCreditCalculator();
const result = calculator.calculate({
area: 10,
methodology: 'VM0042',
trees: 1000
});

text
expect(result).toBeGreaterThan(0);
expect(result).toBeLessThan(1000);
});
});

text

### Integration Tests

- Test API endpoints
- Test database operations
- Test external service integrations

### End-to-End Tests

- Test critical user flows
- Use Playwright for browser testing
- Include mobile app testing

## Documentation

### Code Documentation

- Comment complex logic
- Use JSDoc/TypeDoc for functions
- Include usage examples

### API Documentation

- Update OpenAPI/Swagger specs
- Include request/response examples
- Document error codes

### User Documentation

- Update user guides
- Include screenshots
- Translate to local languages

## Security

### Security Guidelines

- Never commit sensitive data
- Use environment variables
- Validate all inputs
- Follow OWASP guidelines
- Encrypt sensitive data

### Reporting Security Issues

Please report security vulnerabilities to `security@krishimitra.com` rather than creating public issues.

## Performance Guidelines

- Optimize database queries
- Implement proper caching
- Use pagination for large datasets
- Compress images and assets
- Monitor performance metrics

## Accessibility

- Follow WCAG 2.1 AA guidelines
- Test with screen readers
- Provide alt text for images
- Ensure keyboard navigation
- Use semantic HTML

## Internationalization

- Use i18n keys instead of hardcoded strings
- Support RTL languages
- Consider cultural differences
- Test with different locales

## Review Process

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Security considerations addressed
- [ ] Performance impact considered
- [ ] Accessibility requirements met
- [ ] Breaking changes documented

### Review Timeline

- Initial review within 2 business days
- Final approval within 1 week
- Hot fixes reviewed within 24 hours

## Release Process

1. Feature freeze on develop branch
2. Create release candidate branch
3. Testing and bug fixes
4. Merge to main branch
5. Tag release
6. Deploy to production
7. Update changelog

## Community

### Communication Channels

- [GitHub Discussions](https://github.com/krishimitra/platform/discussions)
- [Discord Server](https://discord.gg/krishimitra)
- [Slack Workspace](https://krishimitra.slack.com)
- [Twitter](https://twitter.com/krishimitra)

### Meetings

- Weekly contributor calls (Wednesdays 3 PM IST)
- Monthly planning meetings
- Quarterly review sessions

## Recognition

Contributors are recognized through:

- Contributor wall on website
- GitHub contributor graphs
- Special mentions in releases
- Swag and merchandise
- Conference speaking opportunities

## Getting Help

If you need help:

1. Check existing documentation
2. Search closed issues
3. Ask in discussions
4. Contact maintainers
5. Join community calls

## License

By contributing to KrishiMitra, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to KrishiMitra and helping build sustainable agriculture technology! 🌾
