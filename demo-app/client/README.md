# WorkSeal Demo App — Client

React + Vite + TypeScript frontend for the Customer Support Portal demo application.

This is the **verification target** — the controlled web app that WorkSeal verifies against its six acceptance criteria. It is not the WorkSeal product itself.

## Development

```bash
npm install
npm run dev
# Runs on http://localhost:5174
```

## Notes

- The demo backend must be running on `http://localhost:5001` before the frontend can authenticate.
- Demo credentials are configured via the backend `DEMO_USER_PASSWORD` environment variable.
- See `demo-app/Demo.md` for the full specification and `demo-app/server/.env.example` for environment setup.
