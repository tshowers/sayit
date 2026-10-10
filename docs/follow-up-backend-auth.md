# Follow-up: SayIt backend routes trust a `uid` from the request

Written 2026-10-09, after the App Review demo account hit "unauthorized" saving its profile in the iPhone app. That bug is fixed and deployed (see "Already done"). This note covers what's left: SayIt's backend routes decide **who** the caller is from a `uid` in the request body, which anyone can type.

Do this after Apple finishes reviewing SayIt build 5. None of it blocks the review.

## Already done (2026-10-09, deployed)

- **The bug:** `accountRoutes` applies `readAccessGuard` to every request registered after it, `sayitRoutes` included. That guard only read identity from the `x-user-id` / `x-tenant-id` / `x-user-email` headers. The iPhone app sends just a Firebase ID token, and production runs `verifiedIdentity` in `AUTH_IDENTITY_MODE=log`, which doesn't copy the token's identity into those headers. So every iPhone profile save failed.
- **The fix:** `todd-backend/functions/middleware/authContext.js` now fills `req.user` from the verified token (`req.auth`) when the headers are missing. Tests are in `__tests__/authContext.test.js`.
- **Still to do:** that fix was deployed from the working tree. Commit `authContext.js` and `__tests__/authContext.test.js` in taliferrotech.

## The problem

All of these are in `todd-backend/functions/sayitRoutes.js`:

| Route | What it trusts | What someone could do |
|---|---|---|
| `POST /sayit/profile/complete` | `req.body.uid` | Overwrite any member's SayIt profile (name, business, intro, website) and mark it public. |
| `POST /sayit/seeding/run` | `req.body.uid === SAYIT_MASTER_TENANT_ID` | Run directory seeding and send invite emails. |
| `PUT /sayit/seeding/toggle` | same | Turn seeding on or off. |
| `POST /sayit/seeding/preview-test-invite` | same | Preview invites. |
| `POST /sayit/seeding/send-test-invite` | same | Send test invite emails. |
| `PUT /sayit/scheduler/toggle` | same | Turn the SayIt scheduler on or off. |
| `GET /sayit/seeding/metrics`, `GET /sayit/scheduler/status` | nothing | Read seeding metrics and scheduler state. |
| `POST /sayit/seeding/track` | check | Confirm whether it needs auth at all (it may be a public tracking beacon). |

**Why the admin check doesn't protect anything:** `SAYIT_MASTER_TENANT_ID` isn't a secret. It's in the iOS app's `project.yml`, inside every SayIt build, and it's in the web code. Anyone who reads it can pass it as `uid`.

**Why the guard in front doesn't help either:** `readAccessGuard` only checks that *some* identity is present. With `AUTH_IDENTITY_MODE=log`, a request can still claim one by setting the `x-user-id` header to anything.

## The fix

The verified identity is already available on every request: `verifiedIdentity` sets `req.auth = {uid, tenantId, email, verified: true}` from a valid Firebase ID token. Both the SayIt website (`src/app/core/interceptors/id-token.interceptor.ts`) and the iPhone app (`BackendClient`) already send that token. So:

1. **Profile save:** require `req.auth`. Use `req.auth.uid` as the profile owner. Reject with 403 when `req.body.uid` is present and doesn't match it, so a stale client fails loudly instead of writing to the wrong profile.
2. **Admin routes:** require `req.auth.uid` to be the master admin. Use the same `MASTER_ADMIN_UID` that `middleware/verifiedIdentity.js` uses, or a shared `requireSayItAdmin` middleware, instead of comparing the body `uid` to the tenant id.
3. **Metrics and status:** put them behind the same admin check, unless a public page needs them. Check the SayIt web admin screens first.
4. **Seeding track:** decide whether it's meant to be public. If it is, rate-limit it like the other anonymous routes in `index.js`.
5. **Tests:** for each route, cover no token → 401, someone else's uid → 403, own uid → 200, and admin route as a non-admin → 403.

## Bigger picture (separate decision)

The root cause is `AUTH_IDENTITY_MODE=log`. In `enforce` mode, `verifiedIdentity` replaces spoofed identity headers with the verified ones and strips them from unsigned requests, which closes this whole class of problem for every route that reads those headers, not just SayIt's. Before switching, check the `[verifiedIdentity]` warnings in the Cloud Run logs for `identity_mismatch` and `no_token` from real web traffic. Those are the callers that would break.

## How to check after the fix

- **iPhone (TestFlight build 5 or later):** sign in as `appreview@taliferro.com`, edit the profile and save. It should succeed.
- **Web (sayit.taliferro.tech/profile):** save a profile. It should succeed.
- **curl the profile route** with no token, then with another user's `uid`. Both should be refused.
- **curl `/sayit/scheduler/toggle`** with the master tenant id but no admin token. It should be refused.
