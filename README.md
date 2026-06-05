# Portal Launcher

A React + TypeScript + Tauri scaffold for Portal Launcher.

## Project structure

- `src/` — frontend React app
- `src-tauri/` — Rust backend and Tauri integration
- `package.json` — frontend dependencies and scripts
- `tsconfig.json` — TypeScript configuration
- `tailwind.config.ts` — Tailwind CSS configuration
- `vite.config.ts` — Vite configuration with alias `@` to `src`

## Notes

- The workspace has been scaffolded based on the Portal Launcher technical specification.
- The frontend includes the animated splash screen, theme store, language store, i18next setup, and route placeholders.
- The backend includes a Tauri manifest, build script, and stub command modules for the launcher features.

## Next steps

1. Install Node.js and npm / pnpm / yarn.
2. Run `npm install` in the workspace root.
3. Install Rust and the Tauri toolchain if not already installed.
4. Run `npm run dev` to start the frontend development server.
5. Run `npm run tauri` to launch the Tauri app.

## Important

The current environment does not have `npm`, `pnpm`, `yarn`, or `corepack` installed, so dependency installation must be done locally.
