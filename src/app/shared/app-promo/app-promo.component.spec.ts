import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { isSayItAppLive, sayItAppStoreUrl } from '../app-download';
import { AppPromoComponent } from './app-promo.component';

describe( 'Say It app download', () => {
  it( 'has no App Store link until there is an Apple ID', () => {
    expect( sayItAppStoreUrl( '' ) ).toBe( '' );
    expect( sayItAppStoreUrl( '123' ) ).toBe( 'https://apps.apple.com/app/id123' );
  } );

  it( 'is not live without an Apple ID, and never calls Apple', async () => {
    const fetchSpy = spyOn( window, 'fetch' );
    expect( await isSayItAppLive( '' ) ).toBeFalse();
    expect( fetchSpy ).not.toHaveBeenCalled();
  } );

  it( 'is live once Apple\'s lookup finds the app', async () => {
    spyOn( window, 'fetch' ).and.resolveTo( new Response( JSON.stringify( { resultCount: 1 } ) ) );
    expect( await isSayItAppLive( '123' ) ).toBeTrue();
  } );

  it( 'treats a failed lookup as not live', async () => {
    spyOn( window, 'fetch' ).and.rejectWith( new Error( 'offline' ) );
    expect( await isSayItAppLive( '123' ) ).toBeFalse();
  } );
} );

describe( 'AppPromoComponent', () => {
  beforeEach( () => {
    localStorage.removeItem( 'sayit_app_promo_dismissed' );
    TestBed.configureTestingModule( { imports: [AppPromoComponent], providers: [provideRouter( [] )] } );
  } );

  afterEach( () => localStorage.removeItem( 'sayit_app_promo_dismissed' ) );

  const render = async ( variant: 'hero' | 'bar' | 'link' ) => {
    const fixture = TestBed.createComponent( AppPromoComponent );
    fixture.componentInstance.variant = variant;
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    return fixture;
  };

  it( 'leads the landing page with the app, and keeps the web a tap away', async () => {
    const el: HTMLElement = ( await render( 'hero' ) ).nativeElement;
    expect( el.textContent ).toContain( 'Say It is best on iPhone' );
    expect( el.querySelector( '[data-cy="app-coming-soon"]' ) ).withContext( 'no Apple ID yet' ).toBeTruthy();
    expect( el.querySelector( '[data-cy="app-store-link"]' ) ).toBeNull();
    expect( el.querySelector( '[data-cy="guest-get-started"]' )?.getAttribute( 'href' ) ).toBe( '/get-started' );
  } );

  it( 'remembers when a signed-in user dismisses the bar', async () => {
    const fixture = await render( 'bar' );
    const el: HTMLElement = fixture.nativeElement;
    ( el.querySelector( '[data-cy="app-promo-dismiss"]' ) as HTMLButtonElement ).click();
    fixture.detectChanges();
    expect( el.querySelector( '[data-cy="app-promo-bar"]' ) ).toBeNull();

    const again: HTMLElement = ( await render( 'bar' ) ).nativeElement;
    expect( again.querySelector( '[data-cy="app-promo-bar"]' ) ).toBeNull();
  } );
} );
