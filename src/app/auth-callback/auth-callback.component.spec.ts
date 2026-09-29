import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';

import { AuthContextService } from '../services/auth-context.service';
import { SayItOnboardingService } from '../services/sayit-onboarding.service';
import { AuthCallbackComponent } from './auth-callback.component';

describe( 'AuthCallbackComponent', () => {
  const setup = ( params: Record<string, string>, pending: { returnUrl?: string; } | null, postId?: string ) => {
    const auth = jasmine.createSpyObj<AuthContextService>( 'AuthContextService', ['consumePendingLogin', 'signInWithCustomToken'] );
    auth.consumePendingLogin.and.returnValue( pending );
    auth.signInWithCustomToken.and.resolveTo( {} as any );
    const onboarding = jasmine.createSpyObj<SayItOnboardingService>( 'SayItOnboardingService', ['hasPendingDraft', 'submitIfPending'] );
    onboarding.hasPendingDraft.and.returnValue( !!postId );
    onboarding.submitIfPending.and.resolveTo( postId ? { postId } : {} );

    TestBed.configureTestingModule( {
      imports: [AuthCallbackComponent],
      providers: [
        provideRouter( [] ),
        { provide: AuthContextService, useValue: auth },
        { provide: SayItOnboardingService, useValue: onboarding },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap( params ) } } },
      ],
    } );
    const router = TestBed.inject( Router );
    spyOn( router, 'navigate' ).and.resolveTo( true );
    spyOn( router, 'navigateByUrl' ).and.resolveTo( true );
    const component = TestBed.createComponent( AuthCallbackComponent ).componentInstance;
    return { component, auth, onboarding, router };
  };

  it( 'rejects a callback whose state does not match', async () => {
    const { component, auth } = setup( { token: 't', state: 'forged' }, null );
    await component.ngOnInit();
    expect( component.errorMessage ).toContain( 'invalid or expired' );
    expect( auth.signInWithCustomToken ).not.toHaveBeenCalled();
  } );

  it( 'signs in, publishes the wizard post, and opens it', async () => {
    const { component, auth, onboarding, router } = setup( { token: 't', state: 's' }, { returnUrl: '/' }, 'p1' );
    await component.ngOnInit();
    expect( auth.signInWithCustomToken ).toHaveBeenCalledWith( 't' );
    expect( onboarding.submitIfPending ).toHaveBeenCalled();
    expect( router.navigate ).toHaveBeenCalledWith( ['/post', 'p1'], { queryParams: { welcome: 1 } } );
  } );

  it( 'returns to where the member was headed when there is no wizard post', async () => {
    const { component, router } = setup( { token: 't', state: 's' }, { returnUrl: '/interests' } );
    await component.ngOnInit();
    expect( router.navigateByUrl ).toHaveBeenCalledWith( '/interests' );
  } );
} );
