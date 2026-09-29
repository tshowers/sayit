import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { legacyPostLinkGuard } from './legacy-post-link.guard';

describe( 'legacyPostLinkGuard', () => {
  const run = ( queryParams: Record<string, string> ) => {
    TestBed.configureTestingModule( { providers: [provideRouter( [] )] } );
    const route = { queryParamMap: convertToParamMap( queryParams ) } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext( () => legacyPostLinkGuard( route, {} as RouterStateSnapshot ) );
  };

  it( 'lets the home page load normally', () => {
    expect( run( {} ) ).toBeTrue();
  } );

  it( 'ignores a blank post parameter', () => {
    expect( run( { post: '  ' } ) ).toBeTrue();
  } );

  it( 'redirects /?post=<id> to /post/<id>', () => {
    const result = run( { post: 'abc123' } ) as UrlTree;
    expect( TestBed.inject( Router ).serializeUrl( result ) ).toBe( '/post/abc123' );
  } );
} );
