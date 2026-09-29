import { AuthContextService } from './auth-context.service';

describe( 'AuthContextService hosted login state', () => {
  const service = new AuthContextService();
  const key = 'sayit_hosted_login_pending';

  afterEach( () => sessionStorage.clear() );

  it( 'accepts the matching state once', () => {
    sessionStorage.setItem( key, JSON.stringify( { state: 'abc', returnUrl: '/post/1' } ) );
    expect( service.consumePendingLogin( 'abc' ) ).toEqual( { returnUrl: '/post/1' } );
    expect( service.consumePendingLogin( 'abc' ) ).toBeNull();
  } );

  it( 'rejects a mismatched or missing state and clears the entry', () => {
    sessionStorage.setItem( key, JSON.stringify( { state: 'abc', returnUrl: '/' } ) );
    expect( service.consumePendingLogin( 'xyz' ) ).toBeNull();
    expect( sessionStorage.getItem( key ) ).toBeNull();
    expect( service.consumePendingLogin( null ) ).toBeNull();
  } );
} );
