import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';

import { AuthContextService } from '../services/auth-context.service';
import { sayItProfilePageGuard } from './sayit-profile-page.guard';

describe( 'sayItProfilePageGuard', () => {
  const run = ( user: any ) => {
    TestBed.configureTestingModule( {
      providers: [
        provideRouter( [] ),
        { provide: AuthContextService, useValue: { getUser: () => of( user ) } },
      ],
    } );
    const result = TestBed.runInInjectionContext( () =>
      sayItProfilePageGuard( {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot ) ) as Observable<boolean | UrlTree>;
    return firstValueFrom( result );
  };

  it( 'lets a signed-in user through', async () => {
    expect( await run( { uid: 'u1' } ) ).toBeTrue();
  } );

  it( 'sends a signed-out user to /not-authorized', async () => {
    const result = await run( null );
    expect( TestBed.inject( Router ).serializeUrl( result as UrlTree ) ).toBe( '/not-authorized' );
  } );
} );
