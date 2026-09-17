# kettera_corp_portal

React SPA for **Kettera Corp Portal** — the internal application that manages Kettera's consulting services (CRM, Project Management, Timekeeping, and future modules).

## Status

**Phase 1 landed** — schema in the sibling [`kettera_corp_data`](https://github.com/jeffdavis-kettera/kettera_corp_data) repo. Phase 2 (API) is in progress in [`kettera_corp_api`](https://github.com/jeffdavis-kettera/kettera_corp_api). This repo will get its Vite/React scaffolding in Phase 3.

See `kettera_implementation_plans/kettera-corp-portal.md` (in the plans repo) for the full plan.

## Independence rule

This repo **does not** share code, dependencies, workspace linkages, or a database with Navigator (`kettera_architect*`, `kettera_admin`, `kettera_data`). A `test/repoBoundary.test.js` will land in Phase 3 to enforce that in CI. Copying a pattern from Navigator by hand is fine; importing anything from a Navigator repo is not.

## Stack (planned for Phase 3)

- React 19 + Vite 7 + React Router 7
- Firebase Auth (same production project as Navigator: `kettera-architect`)
- Vanilla CSS with tokens copied from Navigator's theme files
- No global state library, no data-fetching library
