# WorkSeal Frontend

React + Vite + TypeScript frontend for the WorkSeal milestone verification platform.

## Development

```bash
npm install
npm run dev
# Runs on http://localhost:5173
```

## Build

```bash
npm run build
```

## Configuration

The frontend connects to the WorkSeal backend at `http://localhost:5000` by default (configured in `src/App.tsx`).

The backend must be running before the frontend can load workspace data.

## Notes

- This is the WorkSeal product UI — not the demo Customer Support Portal.
- The demo app frontend runs separately on `http://localhost:5174`.
- See the root `README.md` for full setup instructions.
