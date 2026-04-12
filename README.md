# Smart Parking Monorepo

This is a monorepo for the Smart Parking system, managed with Turborepo. It contains a Convex backend, web application, and native mobile application.

## Features

- **TypeScript** - For type safety and improved developer experience
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI developments
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Convex** - Reactive backend-as-a-service platform
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
bun run dev:convex:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

Copy environment variables from `apps/convex/.env.local` to `apps/*/.env`.

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the web application.
Use the Expo Go app to run the mobile application.
Your app will connect to the Convex cloud backend automatically.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@smart-parking/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
smart-parking-monorepo/
├── apps/
│   ├── web/         # Web application (React + Vite)
│   ├── native/      # Mobile application (React Native, Expo)
│   └── convex/      # Convex backend functions and schema
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── convex/      # Shared Convex utilities
│   ├── env/         # Environment configuration
│   └── config/      # Shared package configuration
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run lint`: Lint all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:native`: Start the React Native/Expo development server
- `bun run dev:convex`: Start the Convex backend
- `bun run dev:convex:setup`: Setup and configure your Convex project
- `bun run deploy:convex`: Deploy the Convex backend
- `bun run check-types`: Check TypeScript types across all apps
