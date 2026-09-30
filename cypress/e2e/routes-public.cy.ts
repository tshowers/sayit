/**
 * Signed-out coverage for every route in app.routes.ts. Every visit goes
 * through visitWithFirebaseEmulators (no credentials) so Firestore reads hit
 * the local emulator instead of the real taliferrotech project, and each
 * test seeds exactly the data it needs.
 */
const TENANT = 'yH3nWanUv0RqDCNfwXBOXLWuxt52';
const profilesPath = `tenants/${TENANT}/say-it-profiles`;

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

  it( 'lists public businesses in the directory and filters by search', () => {
    const stamp = Date.now();
    cy.seedFirestoreDoc( `${profilesPath}/cy-dir-acme-${stamp}`, {
      uid: `cy-dir-acme-${stamp}`, publicProfile: true, businessName: `Acme Plumbing ${stamp}`, businessCategory: 'Plumbing', location: 'Seattle, WA',
      lastUpdated: new Date(),
    } );
    cy.seedFirestoreDoc( `${profilesPath}/cy-dir-zen-${stamp}`, {
      uid: `cy-dir-zen-${stamp}`, publicProfile: true, businessName: `Zen Yoga ${stamp}`, businessCategory: 'Fitness', lastUpdated: new Date(),
    } );
    cy.seedFirestoreDoc( `${profilesPath}/cy-dir-private-${stamp}`, {
      uid: `cy-dir-private-${stamp}`, publicProfile: false, businessName: `Hidden Co ${stamp}`,
    } );

    cy.visitWithFirebaseEmulators( '/businesses' );
    cy.get( '[data-cy="directory-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.contains( 'h1', 'Browse Businesses' );
    cy.contains( '[data-cy="directory-card"]', `Acme Plumbing ${stamp}` ).should( 'contain.text', 'Seattle, WA' );
    cy.contains( '[data-cy="directory-card"]', `Zen Yoga ${stamp}` );
    cy.contains( '[data-cy="directory-card"]', `Hidden Co ${stamp}` ).should( 'not.exist' );

    cy.get( '[data-cy="directory-search"]' ).type( `Zen Yoga ${stamp}` );
    cy.get( '[data-cy="directory-card"]' ).should( 'have.length', 1 ).and( 'contain.text', `Zen Yoga ${stamp}` );

    cy.get( '[data-cy="directory-search"]' ).clear().type( 'no-business-matches-this' );
    cy.get( '[data-cy="directory-empty"]' ).should( 'contain.text', 'No businesses match that view yet' );
  } );

  it( 'opens a business page from the directory', () => {
    const id = `cy-biz-${Date.now()}`;
    cy.seedFirestoreDoc( `${profilesPath}/${id}`, {
      uid: id, publicProfile: true, businessName: `Directory Link Co ${id}`, businessCategory: 'Consulting', lastUpdated: new Date(),
    } );

    cy.visitWithFirebaseEmulators( '/businesses' );
    cy.get( '[data-cy="directory-search"]', { timeout: 15000 } ).type( id );
    cy.contains( '[data-cy="directory-card"]', `Directory Link Co ${id}` ).click();
    cy.location( 'pathname' ).should( 'match', /^\/business\// );
    cy.get( '[data-cy="business-profile-shell"]', { timeout: 15000 } ).should( 'contain.text', `Directory Link Co ${id}` );
  } );

  it( 'sends signed-out visitors from /interests to sign in, remembering where they were going', () => {
    cy.visitWithFirebaseEmulators( '/interests' );
    cy.wait( '@toddLogin' ).its( 'request.url' ).should( 'include', 'client=sayit-web-local' );
    // Back on SayIt's origin, the pending login carries the page they wanted.
    cy.visitWithFirebaseEmulators( '/not-authorized' );
    cy.window().then( ( win ) => {
      const pending = JSON.parse( win.sessionStorage.getItem( 'sayit_hosted_login_pending' ) || '{}' );
      expect( pending.returnUrl ).to.equal( '/interests' );
    } );
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
    cy.get( '.post-view-signin-hint a' ).should( 'have.attr', 'href', `/login?returnUrl=%2Fpost%2F${id}` );
    cy.get( '.post-view-comment-form' ).should( 'not.exist' );
  } );

  it( 'sends old /?post= share links to the post view', () => {
    cy.visitWithFirebaseEmulators( '/?post=legacy-post-id' );
    cy.location( 'pathname' ).should( 'eq', '/post/legacy-post-id' );
  } );

  it( 'sends signed-out visitors from /profile to /not-authorized', () => {
    cy.visitWithFirebaseEmulators( '/profile' );
    cy.location( 'pathname' ).should( 'eq', '/not-authorized' );
    cy.get( '[data-cy="not-authorized-shell"]' ).should( 'contain.text', 'Not authorized' );
    cy.contains( 'a', 'Back to Say It' ).should( 'have.attr', 'href', '/' );
  } );

  it( 'redirects unknown routes home', () => {
    cy.visitWithFirebaseEmulators( '/this-route-does-not-exist' );
    cy.location( 'pathname' ).should( 'eq', '/' );
  } );

  it( 'shows the build version in the footer', () => {
    cy.visitWithFirebaseEmulators( '/not-authorized' );
    cy.get( 'footer.site-footer' ).should( 'contain.text', 'Version:' );
  } );
} );
