import { defineConfig } from 'cypress';

export default defineConfig( {
  e2e: {
    baseUrl: 'http://localhost:4200',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    chromeWebSecurity: false,
    // Headless runs (deploy.sh) retry a failed test up to twice: on a cold
    // dev server or a busy machine, a Firestore emulator write can stall and
    // time out once, then pass on a warm retry. `cypress open` never retries.
    retries: { runMode: 2, openMode: 0 },
  },
} );
