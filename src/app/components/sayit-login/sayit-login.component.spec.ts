import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthContextService } from '../../services/auth-context.service';
import { SayitLoginComponent } from './sayit-login.component';

describe( 'SayitLoginComponent', () => {
  const create = ( loggedIn: boolean, queryParams: Record<string, string> = {} ) => {
    const router = jasmine.createSpyObj<Router>( 'Router', ['navigateByUrl'] );
    router.navigateByUrl.and.resolveTo( true );
    const auth = jasmine.createSpyObj<AuthContextService>( 'AuthContextService', ['isLoggedIn', 'signIn'] );
    auth.isLoggedIn.and.returnValue( of( loggedIn ) );
    TestBed.configureTestingModule( {
      imports: [SayitLoginComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthContextService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap( queryParams ) } } },
      ],
    } );
    const fixture = TestBed.createComponent( SayitLoginComponent );
    fixture.detectChanges();
    return { router, auth };
  };

  it( 'hands off to TODD login with the returnUrl', fakeAsync( () => {
    const { auth } = create( false, { returnUrl: '/post/abc' } );
    tick( 150 );
    expect( auth.signIn ).toHaveBeenCalledOnceWith( '/post/abc' );
  } ) );

  it( 'returns home by default', fakeAsync( () => {
    const { auth } = create( false );
    tick( 150 );
    expect( auth.signIn ).toHaveBeenCalledOnceWith( '/' );
  } ) );

  it( 'skips the handoff when already signed in', fakeAsync( () => {
    const { auth, router } = create( true, { returnUrl: '/interests' } );
    tick( 150 );
    expect( router.navigateByUrl ).toHaveBeenCalledWith( '/interests' );
    expect( auth.signIn ).not.toHaveBeenCalled();
  } ) );
} );
