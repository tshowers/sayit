import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../environments/environment';
import { SayItDataService } from './sayit-data.service';
import { SayItOnboardingDraft, SayItOnboardingService, TOPIC_OPTIONS } from './sayit-onboarding.service';
import { SayItService } from './say-it-service';

describe( 'SayItOnboardingService', () => {
  let service: SayItOnboardingService;
  let http: HttpTestingController;
  let sayItService: jasmine.SpyObj<SayItService>;
  let dataService: jasmine.SpyObj<SayItDataService>;
  const user = { uid: 'u1', email: 'Ada@Example.com', photoURL: null, getIdToken: () => Promise.resolve( 'id-token' ) };

  const readyDraft = ( overrides: Partial<SayItOnboardingDraft> = {} ): SayItOnboardingDraft => ( {
    ...service.emptyDraft(),
    firstName: 'Ada',
    lastName: 'Lovelace',
    businessName: 'Analytical Co',
    readyToSubmit: true,
    ...overrides,
  } );

  /** Lets queued promise continuations (and the HTTP calls they make) run. */
  const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

  beforeEach( () => {
    localStorage.clear();
    sayItService = jasmine.createSpyObj( 'SayItService', ['publishPost'] );
    sayItService.publishPost.and.resolveTo( { post: {}, id: 'new-post' } );
    dataService = jasmine.createSpyObj( 'SayItDataService', ['getSayItProfileByUidOnce'] );
    dataService.getSayItProfileByUidOnce.and.resolveTo( null );

    TestBed.configureTestingModule( {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SayItService, useValue: sayItService },
        { provide: SayItDataService, useValue: dataService },
      ],
    } );
    service = TestBed.inject( SayItOnboardingService );
    http = TestBed.inject( HttpTestingController );
    spyOn<any>( service, 'currentUser' ).and.returnValue( user );
  } );

  afterEach( () => localStorage.clear() );

  describe( 'defaults', () => {
    it( 'starts with every choice preselected and a ready-made post', () => {
      const draft = service.emptyDraft();
      expect( draft.intent ).toBe( 'looking' );
      expect( draft.topic ).toBe( TOPIC_OPTIONS.looking[0] );
      expect( draft.category ).toBe( 'all' );
      expect( draft.postText ).toBe( 'Looking for a supplier. Any recommendations?' );
      expect( draft.readyToSubmit ).toBeFalse();
    } );

    it( 'writes the post from the answers', () => {
      expect( service.suggestedPost( { intent: 'looking', topic: 'A contractor', category: 'construction' } ) )
        .toBe( 'Looking for a contractor in construction. Any recommendations?' );
      expect( service.suggestedPost( { intent: 'offering', topic: 'My services', category: 'trucking-logistics' } ) )
        .toBe( 'Offering my services in trucking logistics. Happy to help - reach out!' );
    } );

    it( 'keeps suggested posts within the 155 character limit', () => {
      expect( service.suggestedPost( { intent: 'looking', topic: 'x'.repeat( 300 ), category: 'all' } ).length ).toBe( 155 );
    } );

    it( 'names the poster like the feed does', () => {
      expect( service.displayName( readyDraft() ) ).toBe( 'Ada at Analytical Co' );
      expect( service.displayName( readyDraft( { businessName: ' ' } ) ) ).toBe( 'Ada Lovelace' );
    } );

    it( 'persists the draft across page loads', () => {
      service.save( readyDraft( { topic: 'Referrals' } ) );
      expect( service.load().topic ).toBe( 'Referrals' );
      expect( service.hasPendingDraft() ).toBeTrue();
    } );
  } );

  describe( 'after sign-in', () => {
    it( 'does nothing for a draft that never reached the sign-in step', async () => {
      service.save( readyDraft( { readyToSubmit: false } ) );
      expect( await service.submitIfPending() ).toEqual( {} );
      http.expectNone( () => true );
      expect( sayItService.publishPost ).not.toHaveBeenCalled();
    } );

    it( 'saves both profiles, publishes the post, and clears the draft', async () => {
      service.save( readyDraft() );
      const result = service.submitIfPending();

      await flush();
      const todd = http.expectOne( `${environment.backendURL}/onboarding/profile` );
      expect( todd.request.headers.get( 'Authorization' ) ).toBe( 'Bearer id-token' );
      expect( todd.request.body ).toEqual( {
        source: 'sayit-web',
        profile: { firstName: 'Ada', lastName: 'Lovelace', companyName: 'Analytical Co' },
      } );
      todd.flush( { success: true } );

      await flush();
      const sayit = http.expectOne( `${environment.backendURL}/sayit/profile/complete` );
      expect( sayit.request.body ).toEqual( jasmine.objectContaining( {
        uid: 'u1',
        email: 'ada@example.com',
        displayName: 'Ada at Analytical Co',
        intentText: 'Looking for a supplier. Any recommendations?',
        businessName: 'Analytical Co',
        publicProfile: true,
        profileIntentCompleted: true,
      } ) );
      sayit.flush( { success: true } );

      expect( await result ).toEqual( { postId: 'new-post' } );
      expect( sayItService.publishPost ).toHaveBeenCalledOnceWith( jasmine.objectContaining( {
        authorUid: 'u1',
        content: 'Looking for a supplier. Any recommendations?',
        category: 'all',
        displayName: 'Ada at Analytical Co',
        moderate: true,
      } ) );
      expect( localStorage.getItem( 'sayit_onboarding_draft' ) ).toBeNull();
    } );

    it( 'leaves an already complete SayIt profile alone', async () => {
      dataService.getSayItProfileByUidOnce.and.resolveTo( { displayName: 'Ada Existing', intentText: 'Bookkeeping' } );
      service.save( readyDraft() );
      const result = service.submitIfPending();

      await flush();
      http.expectOne( `${environment.backendURL}/onboarding/profile` ).flush( {} );
      await flush();
      http.expectNone( `${environment.backendURL}/sayit/profile/complete` );

      await result;
      expect( sayItService.publishPost ).toHaveBeenCalledOnceWith( jasmine.objectContaining( { displayName: 'Ada Existing' } ) );
    } );

    it( 'still publishes when the shared TODD profile save fails', async () => {
      service.save( readyDraft() );
      const result = service.submitIfPending();

      await flush();
      http.expectOne( `${environment.backendURL}/onboarding/profile` ).flush( {}, { status: 500, statusText: 'Error' } );
      await flush();
      http.expectOne( `${environment.backendURL}/sayit/profile/complete` ).flush( {} );

      expect( await result ).toEqual( { postId: 'new-post' } );
    } );

    it( 'keeps the draft when publishing fails, and never repeats finished steps on retry', async () => {
      sayItService.publishPost.and.rejectWith( new Error( 'offline' ) );
      service.save( readyDraft() );
      const first = service.submitIfPending();
      await flush();
      http.expectOne( `${environment.backendURL}/onboarding/profile` ).flush( {} );
      await flush();
      http.expectOne( `${environment.backendURL}/sayit/profile/complete` ).flush( {} );
      expect( await first ).toEqual( {} );
      expect( service.load().profileSaved ).toBeTrue();

      sayItService.publishPost.and.resolveTo( { post: {}, id: 'retry-post' } );
      expect( await service.submitIfPending() ).toEqual( { postId: 'retry-post' } );
      http.expectNone( () => true );
    } );
  } );

  afterEach( () => http.verify() );
} );
