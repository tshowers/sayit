import { LinkifyPipe } from './linkify-pipe';

describe( 'LinkifyPipe', () => {
  const pipe = new LinkifyPipe();

  it( 'replaces each URL with a "shared link" anchor', () => {
    expect( pipe.transform( 'see https://a.com and http://b.com/x' ) ).toBe(
      'see <a href="https://a.com" target="_blank">shared link</a> and <a href="http://b.com/x" target="_blank">shared link</a>'
    );
  } );

  it( 'leaves text without URLs unchanged', () => {
    expect( pipe.transform( 'no links here' ) ).toBe( 'no links here' );
  } );

  it( 'passes non-strings through', () => {
    expect( pipe.transform( 42 ) ).toBe( 42 as any );
    expect( pipe.transform( null ) ).toBeNull();
  } );
} );
