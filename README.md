# SayIt

Standalone SayIt app (extracted from TODD), served at https://sayit.taliferro.tech from the `todd-sayit` Firebase Hosting site in the `taliferrotech` project.

## Development

```bash
npm start            # http://localhost:4200
```

## Tests

```bash
npm run test:ci      # Karma unit tests, headless
npm run e2e          # Cypress against the Firebase Auth + Firestore emulators
npm run cy:open      # Cypress UI (start `npm run emulators:start` and `npm start` first)
```

The emulators need a JRE (`brew install openjdk`; `deploy.sh` puts it on `PATH` for you). They run on ports 9399 (auth), 8380 (Firestore) and 4601 (UI), and the e2e dev server runs on 4700, so they don't clash with the other products' emulators. `firestore.rules` is emulator-only and is never deployed.

## Deploy

```bash
npm run deploy:hosting   # ./deploy.sh
```

`deploy.sh` builds the production bundle, runs the unit and e2e tests, commits any changes, and deploys `hosting:todd-sayit`. It stops before committing or deploying if any step fails.
