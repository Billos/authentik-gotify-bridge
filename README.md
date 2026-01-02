# authentik-gotify-bridge

A bridge between Authentik and Gotify for notifications.

## Prerequisites

- Node.js (v14 or higher)
- yarn

## Installation

```bash
yarn install
```

## Development

Run the application in development mode with automatic restart on file changes:

```bash
yarn dev
```

This will start the application with tsx in watch mode, automatically restarting when changes are detected in the `src` directory.

## Building

Build the TypeScript project to JavaScript:

```bash
yarn build
```

The compiled JavaScript files will be placed in the `dist` directory.

## Production

Run the built application:

```bash
yarn start
```

## Scripts

- `yarn dev` - Run in development mode with watch mode
- `yarn build` - Compile TypeScript to JavaScript
- `yarn start` - Run the compiled application
- `yarn clean` - Remove the dist directory

## Project Structure

```
├── src/           # TypeScript source files
│   └── index.ts   # Application entry point
├── dist/          # Compiled JavaScript files (generated)
├── tsconfig.json  # TypeScript configuration
└── package.json   # Project dependencies and scripts
```