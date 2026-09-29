import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import { SayitLoginComponent } from './sayit-login.component';

describe( 'SayitLoginComponent', () => {
  const create = ( queryParams: Record<string, string> ) => {
    const router = jasmine.createSpyObj<Router>( 'Router', ['navigateByUrl'] );
    TestBed.configureTestingModule( {
      imports: [SayitLoginComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap( queryParams ) } } },
      ],
    } );
    // The auth gate modal talks to Firebase Auth; these tests only cover the
    // redirect logic, so render nothing.
    TestBed.overrideComponent( SayitLoginComponent, { set: { imports: [], template: '' } } );
    return { component: TestBed.createComponent( SayitLoginComponent ).componentInstance, router };
  };

  it( 'returns to the returnUrl after signing in', () => {
    const { component, router } = create( { returnUrl: '/post/abc' } );
    component.onSignedIn();
    expect( router.navigateByUrl ).toHaveBeenCalledWith( '/post/abc' );
  } );

  it( 'goes home after signing in when there is no returnUrl', () => {
    const { component, router } = create( {} );
    component.onSignedIn();
    expect( router.navigateByUrl ).toHaveBeenCalledWith( '/' );
  } );

  it( 'goes home when the modal is closed', () => {
    const { component, router } = create( { returnUrl: '/interests' } );
    component.onClosed();
    expect( router.navigateByUrl ).toHaveBeenCalledWith( '/' );
  } );
} );
