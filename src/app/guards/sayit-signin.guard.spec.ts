import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';

import { AuthContextService } from '../services/auth-context.service';
import { sayItSignInGuard } from './sayit-signin.guard';

describe( 'sayItSignInGuard', () => {
  const run = ( user: any, url = '/interests' ) => {
    TestBed.configureTestingModule( {
      providers: [
        provideRouter( [] ),
        { provide: AuthContextService, useValue: { getUser: () => of( user ) } },
      ],
    } );
    const result = TestBed.runInInjectionContext( () =>
      sayItSignInGuard( {} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot ) ) as Observable<boolean | UrlTree>;
    return firstValueFrom( result );
  };

  it( 'lets a signed-in user through', async () => {
    expect( await run( { uid: 'u1' } ) ).toBeTrue();
  } );

  it( 'sends a signed-out user to the get-started wizard with a returnUrl', async () => {
    const result = await run( null, '/post/abc' );
    const router = TestBed.inject( Router );
    expect( router.serializeUrl( result as UrlTree ) ).toBe( '/get-started?returnUrl=%2Fpost%2Fabc' );
  } );
} );
