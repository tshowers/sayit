import { Injectable } from '@angular/core';
import { getAuth, onAuthStateChanged, signOut, User } from 'firebase/auth';
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
}
