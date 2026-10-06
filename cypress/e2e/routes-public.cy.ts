/**
 * Signed-out coverage for every route in app.routes.ts. Every visit goes
 * through visitWithFirebaseEmulators (no credentials) so Firestore reads hit
 * the local emulator instead of the real taliferrotech project, and each
 * test seeds exactly the data it needs.
 */
describe( 'SayIt routes - signed out', () => {
  beforeEach( () => {
    // TODD's hosted login is another site - stub it so handoffs are observable offline.
    cy.intercept( 'GET', 'https://todd.taliferro.tech/login*', { statusCode: 200, body: '<html><body>TODD login</body></html>' } ).as( 'toddLogin' );
  } );

  it( 'leads guests to the app, with the web one tap away and no popup', () => {
    cy.visitWithFirebaseEmulators( '/' );
    cy.get( '[data-cy="guest-banner"]', { timeout: 15000 } ).should( 'contain.text', 'Say It is best on iPhone' );
    // No Apple ID yet, so no dead App Store link - just "coming soon".
    cy.get( '[data-cy="app-coming-soon"]' ).should( 'be.visible' );
    cy.get( '[data-cy="app-store-link"]' ).should( 'not.exist' );
    cy.get( '[data-cy="chat-board-shell"]' ).should( 'exist' );
    cy.get( '[role="dialog"]' ).should( 'not.exist' );
    // Posts are for members only.
    cy.get( 'app-post-displayer' ).should( 'not.exist' );
    cy.get( '.sy-card' ).should( 'not.exist' );
    cy.get( '[data-cy="guest-get-started"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
  } );

  it( 'sends guests who try to post to the wizard', () => {
    cy.visitWithFirebaseEmulators( '/' );
    cy.get( 'button[aria-label="Create a post"]', { timeout: 15000 } ).click();
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
  } );

  it( 'hands /login off to TODD login', () => {
    cy.visitWithFirebaseEmulators( '/login' );
    cy.wait( '@toddLogin' ).its( 'request.url' ).should( 'include', 'client=sayit-web-local' ).and( 'include', 'state=' );
  } );

  it( 'sends signed-out visitors from /interests to the wizard, and returning members on to sign in', () => {
    cy.visitWithFirebaseEmulators( '/interests' );
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
    cy.location( 'search' ).should( 'eq', '?returnUrl=%2Finterests' );
    cy.get( '[data-cy="get-started-existing"]' ).should( 'have.attr', 'href', '/login?returnUrl=%2Finterests' ).click();
    cy.wait( '@toddLogin' ).its( 'request.url' ).should( 'include', 'client=sayit-web-local' );
    // Back on SayIt's origin, the pending login carries the page they wanted.
    cy.visitWithFirebaseEmulators( '/not-authorized' );
    cy.window().then( ( win ) => {
      const pending = JSON.parse( win.sessionStorage.getItem( 'sayit_hosted_login_pending' ) || '{}' );
      expect( pending.returnUrl ).to.equal( '/interests' );
    } );
  } );

  it( 'sends signed-out visitors from Orgs and business pages to the wizard', () => {
    cy.visitWithFirebaseEmulators( '/businesses' );
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
    cy.location( 'search' ).should( 'eq', '?returnUrl=%2Fbusinesses' );
    cy.visitWithFirebaseEmulators( '/business/some-org' );
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
  } );

  it( 'sends the landing page Sign in link to the wizard first', () => {
    cy.visitWithFirebaseEmulators( '/' );
    cy.get( '[data-cy="guest-sign-in"]', { timeout: 15000 } ).click();
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
    cy.get( '[data-cy="get-started-existing"]' ).should( 'contain.text', 'Already have an account' );
  } );

  it( 'shows a shared post to signed-out visitors, read-only', () => {
    const id = `cy-post-${Date.now()}`;
    cy.seedFirestoreDoc( `posts/${id}`, {
      content: `Looking for a bookkeeper ${id}`, displayName: 'Ada', userId: 'cy-author', category: 'general', timestamp: new Date(),
    } );

    cy.visitWithFirebaseEmulators( `/post/${id}` );
    cy.location( 'pathname' ).should( 'eq', `/post/${id}` );
    cy.get( '[data-cy="post-view"]', { timeout: 15000 } ).should( 'contain.text', `Looking for a bookkeeper ${id}` );
    cy.contains( '.post-view-signin-hint', 'to join the conversation.' );
    cy.get( '.post-view-signin-hint a' ).should( 'have.attr', 'href', `/get-started?returnUrl=%2Fpost%2F${id}` );
    cy.get( '.post-view-comment-form' ).should( 'not.exist' );
  } );

  it( 'sends old /?post= share links to the post view', () => {
    cy.visitWithFirebaseEmulators( '/?post=legacy-post-id' );
    cy.location( 'pathname' ).should( 'eq', '/post/legacy-post-id' );
  } );

  it( 'sends signed-out visitors from /profile to the wizard', () => {
    cy.visitWithFirebaseEmulators( '/profile' );
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
    cy.location( 'search' ).should( 'eq', '?returnUrl=%2Fprofile' );
  } );

  it( 'shows a noindex Not Found page for unknown routes', () => {
    cy.visitWithFirebaseEmulators( '/this-route-does-not-exist' );
    cy.location( 'pathname' ).should( 'eq', '/this-route-does-not-exist' );
    cy.contains( '.not-found-shell h1', "We couldn't find that." );
    cy.get( 'meta[name="robots"]' ).should( 'have.attr', 'content', 'noindex' );
    cy.title().should( 'eq', 'Page not found | SayIt' );
    cy.get( '.not-found-shell a' ).should( 'have.attr', 'href', '/' );
  } );

  it( 'shows the build version in the footer', () => {
    cy.visitWithFirebaseEmulators( '/not-authorized' );
    cy.get( 'footer.site-footer' ).should( 'contain.text', 'Version:' );
  } );
} );
