# 财梯 Web Application

Converted from WeChat mini-program to Vue 3 web application. This financial planning tool helps users calculate deposit strategies with quarterly rollovers and interest calculations.

## Features

- Deposit planning with quarterly rollovers
- Interest calculation algorithms
- Early withdrawal penalty tracking
- Deficit tracking and simulation
- Progress tracking for execution

## Project Structure

```
src/
├── components/
│   ├── Index.vue      # Home page with form inputs
│   ├── Detail.vue     # Plan detail display
│   ├── Execute.vue    # Interactive execution tracker
│   └── Profile.vue    # Saved plans manager
└── utils/
    └── format.js      # Core financial algorithms
```

## Setup

### Option 1: Using Batch File (Windows - Recommended)

1. Double-click `start_project.bat` in the project folder
2. The script will automatically:
   - Install dependencies (if not already installed)
   - Start the development server
3. Open your browser to http://localhost:5173

### Option 2: Manual Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## Original Conversion Details

This project was converted from a WeChat mini-program to a web application while preserving all core functionality and business logic.
