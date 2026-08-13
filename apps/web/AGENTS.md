<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI changes are not done until verified

Any change that affects the UI (components, pages, styles, layout, theme, text, forms, responsive behaviour) is **not complete** until BOTH of the following are done:

1. **Visual test** — the dev server is already running, so open the page in a browser and verify the change using the **Playwright MCP** tools (screenshots, snapshots, clicks/typing, evaluate, responsive resize): check how it actually looks and behaves (state, hover/focus, loading, errors, mobile/desktop, interactions).
2. **UX review with `ui-ux-pro-max`** — load and apply the `ui-ux-pro-max` skill and verify the change against its design/UX guidelines.

Only after both checks pass can the task be considered finished.
