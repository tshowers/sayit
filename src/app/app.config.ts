import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { idTokenInterceptor } from './core/interceptors/id-token.interceptor';
import { provideCanonicalUrl } from './shared/canonical-url';

initializeApp( environment.firebaseConfig );

/**
 * Cypress-only bootstrap gate for the Firebase Local Emulator Suite.
 * cypress/support/commands.ts's visitWithFirebaseEmulators stashes
 * __useFirebaseEmulators (and optionally __cypressEmulatorCredentials) in
 * localStorage via onBeforeLoad, before any app code runs, so this can
 * point the SDK at localhost and sign the test user in before the route
 * guards take their first onAuthStateChanged emission (take(1)). Gated on
 * window.Cypress, which Cypress injects into every page it drives and which
 * is never present in a normal browser session, so production and regular
 * dev use take the immediately-resolved branch below untouched. Firestore
 * is imported dynamically so it stays out of the initial bundle (the pages
 * that use it are lazy-loaded).
 */
export const appReady: Promise<void> = ( async () => {
  if ( typeof window === 'undefined' || !( window as any ).Cypress || window.localStorage.getItem( '__useFirebaseEmulators' ) !== 'true' ) {
    return;
  }

  const auth = getAuth();
  connectAuthEmulator( auth, 'http://127.0.0.1:9399', { disableWarnings: true } );
  const { connectFirestoreEmulator, getFirestore } = await import( 'firebase/firestore' );
  connectFirestoreEmulator( getFirestore(), '127.0.0.1', 8380 );

  const raw = window.localStorage.getItem( '__cypressEmulatorCredentials' );
  if ( !raw ) return;

  const { email, password } = JSON.parse( raw ) as { email: string; password: string; };
  try {
    await createUserWithEmailAndPassword( auth, email, password );
  } catch ( error: any ) {
    if ( error?.code !== 'auth/email-already-in-use' ) throw error;
    await signInWithEmailAndPassword( auth, email, password );
  }
} )();

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideCanonicalUrl(),
    provideHttpClient(withInterceptors([idTokenInterceptor])),
  ]
};
