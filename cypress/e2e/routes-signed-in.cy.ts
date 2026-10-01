/**
 * Signed-in coverage using the Firebase Auth emulator: appReady in
 * app.config.ts creates (or signs in) the test user before the app boots,
 * so the route guards see a real signed-in user on their first emission.
 * Calls to the TODD backend are stubbed - these tests are about SayIt's own
 * pages, not the API.
 */
const TENANT = 'yH3nWanUv0RqDCNfwXBOXLWuxt52';
const profilesPath = `tenants/${TENANT}/say-it-profiles`;

describe( 'SayIt routes - signed in', () => {
  const credentials = () => ( { email: `sayit-${Date.now()}-${Math.floor( Math.random() * 1e6 )}@example.com`, password: 'CypressTest123!' } );

  beforeEach( () => {
    cy.intercept( { url: 'https://api.taliferro.tech/api/**' }, { statusCode: 200, body: { success: true } } );
  } );

  it( 'shows the board instead of the sign-in gate at /', () => {
    cy.visitWithFirebaseEmulators( '/', credentials() );
    cy.get( '[data-cy="chat-board-shell"]', { timeout: 20000 } ).should( 'exist' );
    cy.get( '[data-cy="guest-banner"]' ).should( 'not.exist' );
    cy.get( 'button[aria-label="Log out"]' ).should( 'exist' );
  } );

  it( 'offers signed-in web users the app, and remembers when they dismiss it', () => {
    cy.visitWithFirebaseEmulators( '/', credentials() );
    cy.get( '[data-cy="app-promo-bar"]', { timeout: 20000 } ).should( 'contain.text', 'Say It' );
    cy.get( '[data-cy="app-promo-dismiss"]' ).click();
    cy.get( '[data-cy="app-promo-bar"]' ).should( 'not.exist' );
    cy.reload();
    cy.get( '[data-cy="chat-board-shell"]', { timeout: 20000 } ).should( 'exist' );
    cy.get( '[data-cy="app-promo-bar"]' ).should( 'not.exist' );
  } );

  it( 'renders the interest inbox at /interests', () => {
    cy.visitWithFirebaseEmulators( '/interests', credentials() );
    cy.location( 'pathname' ).should( 'eq', '/interests' );
    cy.get( '[data-cy="interest-inbox-shell"]', { timeout: 15000 } ).should( 'contain.text', 'SayIt Inbox' );
  } );

  it( 'renders the profile editor at /profile', () => {
    cy.visitWithFirebaseEmulators( '/profile', credentials() );
    cy.location( 'pathname' ).should( 'eq', '/profile' );
    cy.get( '[data-cy="profile-intent-card"]', { timeout: 15000 } ).should( 'exist' );
  } );

  it( 'lists public orgs in the directory and filters by search', () => {
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

    cy.visitWithFirebaseEmulators( '/businesses', credentials() );
    cy.get( '[data-cy="directory-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.contains( 'h1', 'Orgs' );
    cy.contains( '[data-cy="directory-card"]', `Acme Plumbing ${stamp}` ).should( 'contain.text', 'Seattle, WA' );
    cy.contains( '[data-cy="directory-card"]', `Zen Yoga ${stamp}` );
    cy.contains( '[data-cy="directory-card"]', `Hidden Co ${stamp}` ).should( 'not.exist' );

    cy.get( '[data-cy="directory-search"]' ).type( `Zen Yoga ${stamp}` );
    cy.get( '[data-cy="directory-card"]' ).should( 'have.length', 1 ).and( 'contain.text', `Zen Yoga ${stamp}` );

    cy.get( '[data-cy="directory-search"]' ).clear().type( 'no-business-matches-this' );
    cy.get( '[data-cy="directory-empty"]' ).should( 'contain.text', 'No organizations match' );
  } );

  it( 'opens an org page from the directory', () => {
    const id = `cy-biz-${Date.now()}`;
    cy.seedFirestoreDoc( `${profilesPath}/${id}`, {
      uid: id, publicProfile: true, businessName: `Directory Link Co ${id}`, businessCategory: 'Consulting', lastUpdated: new Date(),
    } );

    cy.visitWithFirebaseEmulators( '/businesses', credentials() );
    cy.get( '[data-cy="directory-search"]', { timeout: 15000 } ).type( id );
    cy.contains( '[data-cy="directory-card"]', `Directory Link Co ${id}` ).click();
    cy.location( 'pathname' ).should( 'match', /^\/business\// );
    cy.get( '[data-cy="business-profile-shell"]', { timeout: 15000 } ).should( 'contain.text', `Directory Link Co ${id}` );
  } );
} );
