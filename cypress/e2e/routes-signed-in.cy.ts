/**
 * Signed-in coverage using the Firebase Auth emulator: appReady in
 * app.config.ts creates (or signs in) the test user before the app boots,
 * so the route guards see a real signed-in user on their first emission.
 * Calls to the TODD backend are stubbed - these tests are about SayIt's own
 * pages, not the API.
 */
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
} );
