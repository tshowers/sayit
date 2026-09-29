import { TruncatePipe } from './truncate.pipe';

describe( 'TruncatePipe', () => {
  const pipe = new TruncatePipe();

  it( 'returns an empty string for empty input', () => {
    expect( pipe.transform( '' ) ).toBe( '' );
    expect( pipe.transform( null as any ) ).toBe( '' );
  } );

  it( 'leaves strings at or under the limit alone', () => {
    expect( pipe.transform( 'short', 5 ) ).toBe( 'short' );
  } );

  it( 'cuts long strings at the limit and adds the trail', () => {
    expect( pipe.transform( 'abcdefghij', 4 ) ).toBe( 'abcd...' );
    expect( pipe.transform( 'abcdefghij', 4, '…' ) ).toBe( 'abcd…' );
  } );

  it( 'defaults to 25 characters', () => {
    expect( pipe.transform( 'x'.repeat( 30 ) ) ).toBe( 'x'.repeat( 25 ) + '...' );
  } );
} );
