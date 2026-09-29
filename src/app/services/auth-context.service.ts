import { Injectable } from '@angular/core';
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut, User } from 'firebase/auth';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * SayIt is a single-tenant, public-facing app — everything reads/writes under
 * the Taliferro master tenant (see TopDogComponent.isSayItContext() in TODD,
 * which this replaces for the standalone build). There is no per-tenant or
 * per-user tenant resolution here by design.
 */
@Injectable( { providedIn: 'root' } )
export class AuthContextService {
  readonly tenantId = environment.taliferroTenantId;

  getUser (): Observable<User | null> {
    return new Observable( ( subscriber ) => {
      const auth = getAuth();
      const unsubscribe = onAuthStateChanged( auth, ( user ) => subscriber.next( user ) );
      return unsubscribe;
    } );
  }

  getUserId (): Observable<string> {
    return new Observable( ( subscriber ) => {
      const auth = getAuth();
      const unsubscribe = onAuthStateChanged( auth, ( user ) => subscriber.next( user?.uid || '' ) );
      return unsubscribe;
    } );
  }

  isLoggedIn (): Observable<boolean> {
    return new Observable( ( subscriber ) => {
      const auth = getAuth();
      const unsubscribe = onAuthStateChanged( auth, ( user ) => subscriber.next( !!user ) );
      return unsubscribe;
    } );
  }

  getCurrentUserIdSync (): string {
    return getAuth().currentUser?.uid || '';
  }

  async signOut (): Promise<void> {
    await signOut( getAuth() );
  }

  private readonly pendingLoginStorageKey = 'sayit_hosted_login_pending';

  /**
   * Leaves for TODD's hosted login (todd.taliferro.tech/login), the page
   * every TODD web app signs in through. `state` is stashed with the
   * returnUrl in sessionStorage and checked again in AuthCallbackComponent,
   * so a forged callback can't sign anyone in. The `sayit-web` clients are
   * registered in todd-backend's authClients.js.
   */
  signIn ( returnUrl: string = '/' ): void {
    const state = crypto.randomUUID();
    sessionStorage.setItem( this.pendingLoginStorageKey, JSON.stringify( { state, returnUrl } ) );
    const host = window.location.hostname;
    const client = host === 'localhost' || host === '127.0.0.1' ? 'sayit-web-local' : 'sayit-web';
    window.location.href = `https://todd.taliferro.tech/login?client=${client}&state=${state}`;
  }

  /** Reads back and clears what signIn() stashed; null unless `state` matches. */
  consumePendingLogin ( state: string | null ): { returnUrl?: string; } | null {
    const raw = sessionStorage.getItem( this.pendingLoginStorageKey );
    sessionStorage.removeItem( this.pendingLoginStorageKey );
    if ( !raw ) return null;
    try {
      const pending = JSON.parse( raw ) as { state: string; returnUrl?: string; };
      return state && pending.state === state ? { returnUrl: pending.returnUrl } : null;
    } catch {
      return null;
    }
  }

  async signInWithCustomToken ( token: string ): Promise<User> {
    return ( await signInWithCustomToken( getAuth(), token ) ).user;
  }
}
