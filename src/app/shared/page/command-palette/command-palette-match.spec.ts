import { Router } from '@angular/router';
import { COMMAND_PALETTE_ENTRIES } from './command-palette-entries';
import { navigateToEntry, searchEntries } from './command-palette-match';

describe( 'command palette search', () => {
  it( 'returns the first entries for an empty query', () => {
    expect( searchEntries( '   ', 3 ) ).toEqual( COMMAND_PALETTE_ENTRIES.slice( 0, 3 ) );
  } );

  it( 'ranks an exact keyword match first', () => {
    expect( searchEntries( 'directory' )[0].id ).toBe( 'sayit-businesses' );
    expect( searchEntries( 'surveys' )[0].id ).toBe( 'app-pulse' );
  } );

  it( 'requires every word in the query to match', () => {
    expect( searchEntries( 'business directory' ).map( e => e.id ) ).toEqual( ['sayit-businesses'] );
    expect( searchEntries( 'directory zzzz' ) ).toEqual( [] );
  } );

  it( 'ignores case and surrounding punctuation', () => {
    expect( searchEntries( '"PULSE!"' )[0].id ).toBe( 'app-pulse' );
  } );

  it( 'respects the limit', () => {
    expect( searchEntries( 'a', 2 ).length ).toBeLessThanOrEqual( 2 );
  } );
} );

describe( 'command palette navigation', () => {
  it( 'routes internal entries through the Angular router', () => {
    const router = jasmine.createSpyObj<Router>( 'Router', ['navigate'] );
    router.navigate.and.resolveTo( true );
    const entry = COMMAND_PALETTE_ENTRIES.find( e => e.id === 'sayit-businesses' )!;

    navigateToEntry( router, entry );

    expect( router.navigate ).toHaveBeenCalledWith( ['/businesses'], { queryParams: undefined } );
  } );

  it( 'opens new-tab external entries with window.open', () => {
    const router = jasmine.createSpyObj<Router>( 'Router', ['navigate'] );
    const openSpy = spyOn( window, 'open' );
    const entry = COMMAND_PALETTE_ENTRIES.find( e => e.id === 'app-music' )!;

    navigateToEntry( router, entry );

    expect( openSpy ).toHaveBeenCalledWith( 'https://music.taliferro.com', '_blank', 'noopener' );
    expect( router.navigate ).not.toHaveBeenCalled();
  } );
} );
