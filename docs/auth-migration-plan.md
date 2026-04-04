# Auth Migration Plan

## Recommended approach

- Keep guest mode as the default entry path.
- Use DB-backed opaque cookie sessions for authenticated users.
- Reuse the existing `PlayerSession` model for guest continuity and run ownership.

## Guest to account upgrade

1. A guest starts with a `typ_nique_guest` cookie tied to `PlayerSession.guestTokenHash`.
2. Game sessions created in guest mode belong to that `PlayerSession`.
3. When the guest signs up or logs in, the API:
   - creates or validates the `User`
   - links the current `PlayerSession` to `User.id`
   - backfills guest `GameSession.userId` rows for that player session
   - issues a new authenticated cookie session
4. Personal history, daily ranking, and personal bests now resolve through `userId`.

## Operational steps

1. Pull the new code.
2. Run `pnpm db:generate`.
3. Run `pnpm db:migrate`.
4. Restart `api` and `web`.

## Notes

- Guest play continues to work even without creating an account.
- Logging out clears the auth cookie but preserves the browser guest cookie.
- Protected account history endpoints require an authenticated session.
