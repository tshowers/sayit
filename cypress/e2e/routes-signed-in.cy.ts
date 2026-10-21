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

  it( 'shows the board instead of the sign-in gate at /board', () => {
    cy.visitWithFirebaseEmulators( '/board', credentials() );
    cy.get( '[data-cy="chat-board-shell"]', { timeout: 20000 } ).should( 'exist' );
    cy.get( '[data-cy="guest-banner"]' ).should( 'not.exist' );
    cy.get( 'button[aria-label="Log out"]' ).should( 'exist' );
  } );

  it( 'shows the board as a grid and loads more posts near the bottom', () => {
    const stamp = Date.now();
    for ( let i = 0; i < 30; i++ ) {
      cy.seedFirestoreDoc( `posts/cy-grid-${stamp}-${i}`, {
        content: `Grid post ${i} ${stamp}`, displayName: 'Ada', userId: 'cy-author', category: 'general', timestamp: new Date( stamp - i * 60000 ),
      } );
    }

    cy.visitWithFirebaseEmulators( '/board', credentials() );
    cy.get( '.sayit-post-grid .sy-card', { timeout: 20000 } ).should( 'have.length', 24 );
    cy.contains( '.sy-card', `Grid post 0 ${stamp}` );
    cy.get( '.sayit-feed-hint' ).should( 'not.exist' );

    // Bootstrap sets scroll-behavior: smooth on <html>, and under Cypress the
    // smooth scroll can stall partway, so load more never sees the bottom.
    // Scroll instantly, like a wheel or trackpad does.
    cy.document().then( ( doc ) => { doc.documentElement.style.scrollBehavior = 'auto'; } );
    cy.scrollTo( 'bottom' );
    cy.get( '.sayit-post-grid .sy-card' ).should( 'have.length.greaterThan', 24 );
  } );

  it( 'filters the board by Selling / Looking for and remembers One at a time', () => {
    const stamp = Date.now();
    const seed = ( id: string, kind: string | null ) => cy.seedFirestoreDoc( `posts/${id}-${stamp}`, {
      content: `${id} ${stamp}`, displayName: 'Ada', userId: 'cy-author', category: 'general', timestamp: new Date(),
      ...( kind ? { kind } : {} ),
    } );
    seed( 'kind-selling', 'selling' );
    seed( 'kind-looking', 'looking-for' );
    seed( 'kind-none', null );

    cy.visitWithFirebaseEmulators( '/board', credentials() );
    cy.contains( '.sy-card', `kind-none ${stamp}`, { timeout: 20000 } );
    cy.contains( '.sy-card', `kind-selling ${stamp}` ).find( '.sy-card__tag' ).should( 'have.text', 'Selling' );

    cy.get( '[data-cy="kind-filter-looking-for"]' ).click();
    cy.contains( '.sy-card', `kind-looking ${stamp}` );
    cy.contains( '.sy-card', `kind-selling ${stamp}` ).should( 'not.exist' );
    cy.contains( '.sy-card', `kind-none ${stamp}` ).should( 'not.exist' );
    cy.get( '[data-cy="kind-filter-all"]' ).click();
    cy.contains( '.sy-card', `kind-none ${stamp}` );

    cy.get( '[data-cy="board-view-single"]' ).click();
    cy.get( '.sayit-post-single .sy-card' ).should( 'exist' );
    cy.get( 'button[aria-label="Next post"]' ).should( 'exist' );
    cy.reload();
    cy.get( '.sayit-post-single .sy-card', { timeout: 20000 } ).should( 'exist' );
    cy.get( '[data-cy="board-view-grid"]' ).click();
    cy.get( '.sayit-post-grid .sy-card' ).should( 'exist' );
  } );

  it( 'shows one Orgs row per person when a claimed seeded profile duplicates theirs', () => {
    const stamp = Date.now();
    const person = `cy-person-${stamp}`;
    cy.seedFirestoreDoc( `${profilesPath}/${person}`, {
      uid: person, publicProfile: true, displayName: `Dup Person ${stamp}`, lastUpdated: new Date(),
    } );
    cy.seedFirestoreDoc( `${profilesPath}/seed-${stamp}`, {
      uid: person, claimedByUid: person, publicProfile: true, businessName: `Dup Person ${stamp}`, businessCategory: 'Consulting',
      profileSource: 'lead_vault_seed', seedStatus: 'claimed', directoryVisibility: 'member_profile', lastUpdated: new Date(),
    } );

    cy.visitWithFirebaseEmulators( '/businesses', credentials() );
    cy.get( '[data-cy="directory-search"]', { timeout: 15000 } ).type( `Dup Person ${stamp}` );
    cy.get( '[data-cy="directory-card"]' ).should( 'have.length', 1 ).and( 'contain.text', 'Consulting' );
  } );

  it( 'offers signed-in web users the app, and remembers when they dismiss it', () => {
    cy.visitWithFirebaseEmulators( '/board', credentials() );
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
