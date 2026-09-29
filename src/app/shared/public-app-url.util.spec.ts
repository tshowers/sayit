import { buildSayitPostUrl, buildSayitShareUrl, getFindHomeUrl, getSayitHomeUrl, getSignatureBuilderUrl, getToddHomeUrl } from './public-app-url.util';
import { environment } from '../../environments/environment';

// Karma serves from localhost, so none of the SayIt or staging host branches
// apply here - these cover the "any other host" defaults.
describe( 'public-app-url util', () => {
  it( 'points SayIt links at the production SayIt domain', () => {
    expect( getSayitHomeUrl() ).toBe( 'https://sayit.taliferro.tech' );
  } );

  it( 'uses the environment PLATFORM_URL for the TODD home link', () => {
    expect( getToddHomeUrl() ).toBe( environment.PLATFORM_URL.replace( /\/$/, '' ) );
  } );

  it( 'returns fixed URLs for Find and the signature builder', () => {
    expect( getFindHomeUrl() ).toBe( 'https://find.taliferro.tech' );
    expect( getSignatureBuilderUrl() ).toBe( 'https://signature.taliferro.tech' );
  } );

  it( 'links shared posts to the isolated post view', () => {
    expect( buildSayitPostUrl( 'abc123' ) ).toBe( 'https://sayit.taliferro.tech/post/abc123' );
    expect( buildSayitPostUrl( ' a/b ' ) ).toBe( 'https://sayit.taliferro.tech/post/a%2Fb' );
  } );

  it( 'builds news share links', () => {
    expect( buildSayitShareUrl( 'news', ' a b ' ) ).toBe( 'https://sayit.taliferro.tech/?news=a+b' );
  } );

  it( 'falls back to the home URL when the value is blank', () => {
    expect( buildSayitPostUrl( '   ' ) ).toBe( 'https://sayit.taliferro.tech' );
    expect( buildSayitShareUrl( 'news', '   ' ) ).toBe( 'https://sayit.taliferro.tech' );
  } );
} );
