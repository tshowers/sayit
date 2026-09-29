import { AuthorProfileUrlPipe } from './author-profile-url.pipe';

describe( 'AuthorProfileUrlPipe', () => {
  const pipe = new AuthorProfileUrlPipe();

  it( 'returns null for a missing post', () => {
    expect( pipe.transform( null ) ).toBeNull();
    expect( pipe.transform( undefined ) ).toBeNull();
  } );

  it( 'does not link TODD system posts or Newsstand posts', () => {
    expect( pipe.transform( { user: 'TODD', userId: 'u1' } as any ) ).toBeNull();
    expect( pipe.transform( { category: 'news', userId: 'u1' } as any ) ).toBeNull();
  } );

  it( 'prefers the author handle', () => {
    expect( pipe.transform( { authorHandle: 'acme', userId: 'u1' } as any ) ).toEqual( ['/business', 'acme'] );
  } );

  it( 'falls back to userId, then the legacy user field', () => {
    expect( pipe.transform( { userId: 'u1', user: 'legacy' } as any ) ).toEqual( ['/business', 'u1'] );
    expect( pipe.transform( { user: 'legacy' } as any ) ).toEqual( ['/business', 'legacy'] );
  } );

  it( 'does not link posts that only carry a TODD contact id', () => {
    expect( pipe.transform( { authorContactId: 'c1' } as any ) ).toBeNull();
  } );
} );
