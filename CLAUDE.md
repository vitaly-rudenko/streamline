# Streamline Development Guide

## Build Commands
- `npm run compile` - Build the extension
- `npm run watch` - Build on file changes
- `npm run lint` - Run ESLint checks
- `npm run test:unit` - Run Jest unit tests
- `npm run test:unit:watch` - Watch mode for unit tests
- `npm run test:unit -- -t "testName"` - Run specific test
- `npm run test:integration` - Run integration tests
- `npm run dev` - Compile on file changes (uses nodemon)

## Code Style Guidelines
- **Types**: Use TypeScript with strict type checking
- **Formatting**: Follow ESLint config, use proper indentation (2 spaces)
- **Imports**: Order: external libraries → project modules, use relative imports
- **Error Handling**: Use try/catch for async operations, handle errors gracefully
- **Naming**: Use camelCase for variables/functions, PascalCase for types/interfaces
- **Components**: Organize feature-related code into dedicated directories
- **Testing**: Write unit tests for utility functions and core logic
- **Documentation**: Document functions with JSDoc comments for complex logic
- **Feature Flags**: Use config system for disabling/enabling features