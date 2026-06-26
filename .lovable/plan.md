# Bug Fix Pass — 10 fixes across 4 files

I'll apply all 10 fixes exactly as specified, in one pass, with no UI/feature changes beyond what's listed.

## Files touched

- `src/components/notifications-bell.tsx` — Bugs 1, 10
- `src/components/family-detail.tsx` — Bugs 2, 3, 5, 6, 8, 9
- `src/components/saved-views.tsx` — Bug 4
- `src/components/advanced-table-filters.tsx` — Bug 7

## Changes per bug

1. **notifications-bell**: add `.eq("recipient_auth_id", user.id)`, raise limit to 50, add error handling, show "A mostrar as 50 mais recentes" footer when `items.length >= 50`.
2. **family-detail / acoesFamilia**: switch `enabled` to `!!family && membros !== undefined`, verify empty-array early return, add `placeholderData: keepPreviousData` (import from `@tanstack/react-query`).
3. **family-detail / bulkAssignProjeto**: replace single `Promise.all` with batches of 5.
4. **saved-views**: add `cancelled` flag + cleanup in the `loadViews` effect; tighten `canEditActive` to check `created_by === currentUserId` using `useAuth()` session.
5. **family-detail / tab reset**: use `useRef` (`prevFamilyId`) so `defaultTab` only applies on first open; reset ref when dialog closes.
6. **family-detail / confirms**: replace all 5 `window.confirm()` calls with a single reusable `AlertDialog` driven by `confirmState`.
7. **advanced-table-filters / uid()**: prefer `crypto.randomUUID()` with fallback.
8. **family-detail / inner Tabs**: rename inner values to `membros-inner` / `voluntarios-inner` (and matching `defaultValue`) to avoid collision with outer `value="membros"`.
9. **family-detail / Ações loading**: show `Skeleton` placeholders while `loadingMembros` is true.
10. **notifications-bell / realtime cb**: wrap `fetchItems()` with `.catch(console.error)`.

## Verification

- After edits, rely on the automatic typecheck/build to confirm everything compiles.
- No DB migrations, no schema/query changes beyond Bug 1's added filter.

Confirm to proceed.