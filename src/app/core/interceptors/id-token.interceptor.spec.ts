import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

import { environment } from '../../../environments/environment';
import { idTokenInterceptor } from './id-token.interceptor';

// Nobody is signed in during unit tests, so every request should go out
// without an Authorization header - these pin down that the interceptor
// never breaks or rewrites requests it has no token for.
describe( 'idTokenInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeAll( () => {
    if ( !getApps().length ) initializeApp( environment.firebaseConfig );
  } );

  beforeEach( () => {
    TestBed.configureTestingModule( {
      providers: [
        provideHttpClient( withInterceptors( [idTokenInterceptor] ) ),
        provideHttpClientTesting(),
      ],
    } );
    http = TestBed.inject( HttpClient );
    controller = TestBed.inject( HttpTestingController );
  } );

  afterEach( () => controller.verify() );

  it( 'leaves backend requests unchanged when signed out', async () => {
    http.get( 'https://api.taliferro.tech/api/openai' ).subscribe();
    // Backend requests wait for Firebase to restore the session first.
    await getAuth().authStateReady();
    await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
    expect( controller.expectOne( 'https://api.taliferro.tech/api/openai' ).request.headers.has( 'Authorization' ) ).toBeFalse();
  } );

  it( 'never touches third-party requests', () => {
    http.get( 'https://api.linkpreview.net/?q=x' ).subscribe();
    expect( controller.expectOne( 'https://api.linkpreview.net/?q=x' ).request.headers.has( 'Authorization' ) ).toBeFalse();
  } );

  it( 'keeps an Authorization header the caller already set', () => {
    http.get( 'https://api.taliferro.tech/api/x', { headers: { Authorization: 'Bearer caller' } } ).subscribe();
    expect( controller.expectOne( 'https://api.taliferro.tech/api/x' ).request.headers.get( 'Authorization' ) ).toBe( 'Bearer caller' );
  } );
} );
