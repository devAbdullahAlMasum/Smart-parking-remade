# Smart Parking Monorepo

This is a monorepo for the Smart Parking system, managed with Turborepo. It contains only three apps: a fullstack Next.js app, a Raspberry Pi device agent, and a native mobile app.

## Features

- **TypeScript** - For type safety and improved developer experience
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **Next.js** - Fullstack frontend and backend in one app
- **daisyUI** - Dark dashboard and display UI components
- **Turso** - LibSQL database for parking state and sessions
- **Drizzle ORM** - Thin SQL layer over the Turso database
- **Ably** - Realtime updates for the display and mobile app
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Setup

The fullstack app is the main backend and frontend. It stores state in Turso and uses Ably for realtime updates.

Copy `apps/fullstack/.env.example` to `apps/fullstack/.env.local` and set:

```bash
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
ABLY_API_KEY
DEVICE_API_KEY
DISPLAY_QR_VALUE
```

For the Pi device agent, copy `apps/pi/.env.example` to `apps/pi/.env` and set:

```bash
CLOUD_API_URL
DEVICE_API_KEY
SERIAL_PORT
SERIAL_BAUD_RATE
```

The native app asks for the fullstack app URL on first launch.

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the fullstack app.
Use the Expo Go app to run the mobile application.

## Project Structure

```
smart-parking-monorepo/
├── apps/
│   ├── fullstack/   # Next.js app with dashboard, scan page, API routes, Turso, and Ably
│   ├── native/      # Mobile application (React Native, Expo)
│   └── pi/          # Raspberry Pi device agent for serial I/O and command polling
├── packages/
│   ├── env/         # Environment configuration
│   └── config/      # Shared package configuration
```

## Available Scripts

- `pnpm dev`: Start all workspace apps in development mode
- `pnpm build`: Build the workspace
- `pnpm lint`: Lint the workspace
- `pnpm dev:fullstack`: Start only the Next.js fullstack app
- `pnpm dev:pi`: Start only the Raspberry Pi device agent
- `pnpm dev:native`: Start only the React Native/Expo development server
- `pnpm check-types`: Check TypeScript types across the workspace
