<p align="center">
  <img src="public/assets/sayit/sayit-banner.png" alt="SayIt" />
</p>

# SayIt

SayIt is a community board where people post what they need and businesses respond. The Angular web app was extracted from TODD and is served at https://sayit.taliferro.tech from the `todd-sayit` Firebase Hosting site in the `taliferrotech` project.

The free iOS app is the main product. The web app shares the same account and data, so it still works fully, but its most important job is opening shared post links. Signed-out visitors land on an "app first" hero, and on iPhone, `/post/*` links open straight in the app through universal links.

## Features

| Route | What it does | Sign-in |
| --- | --- | --- |
| `/` | The board: a feed of posts with comments, "I'm Interested", link previews, embedded videos and a news panel built from RSS feeds. Signed-out visitors see the app promo hero. | Public |
| `/get-started` | Onboarding wizard (Start → Your post → About you → Sign in). It drafts a first post from the visitor's answers, then publishes it once they sign in. Every guarded route redirects here with `returnUrl`. | Public |
| `/login` | Sign in for returning members | Public |
| `/post/:id` | A single shared post. Public so links work for anyone; commenting and other actions stay hidden until the visitor signs in. | Public |
| `/businesses` | Business directory | Required |
| `/business/:identifier` | A business profile | Required |
| `/profile` | Edit your SayIt profile | Required |
| `/interests` | Inbox of "I'm Interested" responses to your posts | Required |
| `/auth/callback` | Completes sign-in redirects | Public |

Old share links in the `/?post=<id>` format are redirected to `/post/<id>` by `legacyPostLinkGuard`.

## Architecture

- **Angular 19** with standalone components, lazy-loaded routes and Bootstrap 5. Shared UI comes from `@taliferro/ui` (`../../taliferro-ui`, a local file dependency, so that repo must be checked out next to `web-products`).
- **Design:** matches the iOS app's Organic design system, with a light/dark theme switched through a `data-theme` toggle (`ThemeService`, `shared/theme-toggle`).
- **Firebase Auth:** the same `taliferrotech` project as the other Taliferro Tech products. Sessions don't carry across subdomains, so signing in to SayIt is separate.
- **Firestore:**
  - `posts` and `posts/{id}/comments` hold board content.
  - `post-interests` holds "I'm Interested" records.
  - `tenants/{taliferroTenantId}/say-it-profiles` holds member and business profiles.
  - `tenants/{taliferroTenantId}/sayit-config` holds directory seeding config.
- **TODD backend** (`https://api.taliferro.tech/api`): onboarding and profile completion (`/onboarding/profile`, `/sayit/profile/complete`), seeding tracking, AI post drafting (`/openai`) and email (`/send-email`). `idTokenInterceptor` adds the signed-in user's Firebase ID token to requests that go to our own backend, and never to third-party APIs.
- **Third parties:** linkpreview.net for link cards, plus an RSS-to-JSON service for the news panel.
- **iOS integration:** `public/.well-known/apple-app-site-association` maps `/post/*` to the `tech.taliferro.sayitios` app. `shared/app-download.ts` controls the App Store links. Leave `SAYIT_IOS_APPLE_ID` empty until the app is live; the promo shows "coming soon" until then.

### Project layout

```
src/app/
  chat-board/            Home feed (/)
  get-started/           Onboarding wizard
  post-view/             Shared post page
  interest-inbox/        "I'm Interested" inbox
  sayit-business-*/      Directory and business profile
  sayit-profile-editor/  Profile editing
  components/            Login, post/news displayers, profile intent card
  services/              Firestore data, backend APIs, auth context, theme, etc.
  guards/                Sign-in guard, legacy post-link redirect
  core/interceptors/     Firebase ID-token interceptor
  pipes/                 Linkify, time, truncate, video and AI-text helpers
  shared/                Top bar, platform menu, app promo, footer, theme toggle
```

## Development

```bash
npm install
npm start            # http://localhost:4200
```

The Firebase config and backend URL are in `src/environments/` (`environment.ts` and `environment.prod.ts`).

Every build regenerates `public/assets/version.json` via `scripts/generate-version.js` (it runs as `prebuild`).

## Tests

```bash
npm run test:ci      # Karma unit tests, headless
npm run e2e          # Cypress against the Firebase Auth + Firestore emulators
npm run cy:open      # Cypress UI (start `npm run emulators:start` and `npm start` first)
```

The emulators need a JRE (`brew install openjdk`; `deploy.sh` puts it on `PATH` for you). They run on these ports, chosen so they don't clash with the other products' emulators:

- 9399: auth
- 8380: Firestore
- 4601: emulator UI
- 4700: e2e dev server

`firestore.rules` is emulator-only and is never deployed.

Cypress connects to the emulators through a bootstrap gate in `app.config.ts`. It only activates when `window.Cypress` is present and a localStorage flag is set, so production and normal dev sessions never touch it. The specs live in `cypress/e2e/` and cover public routes, signed-in routes and the get-started wizard.

## Deploy

```bash
npm run deploy:hosting   # ./deploy.sh
```

`deploy.sh` builds the production bundle, runs the unit and e2e tests, commits any changes, and deploys `hosting:todd-sayit`. It stops before committing or deploying if any step fails.

Hosting serves `dist/sayit/browser` with an SPA rewrite to `index.html`, and serves the apple-app-site-association file as `application/json`.
