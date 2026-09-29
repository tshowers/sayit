/**
 * The pre-sign-in wizard at /get-started: write a first post from
 * preselected answers, say who's posting, then sign in - which publishes
 * it. The full run goes through TODD's (stubbed) hosted login and back via
 * /auth/callback against the Auth and Firestore emulators.
 */
const draftKey = 'sayit_onboarding_draft';

/** The Auth emulator accepts unsigned custom tokens. */
function emulatorCustomToken ( uid: string ): string {
  const encode = ( value: object ) => btoa( JSON.stringify( value ) ).replace( /=+$/, '' ).replace( /\+/g, '-' ).replace( /\//g, '_' );
  const now = Math.floor( Date.now() / 1000 );
  return `${encode( { alg: 'none', typ: 'JWT' } )}.${encode( {
    iss: 'firebase-auth-emulator@example.com',
    sub: 'firebase-auth-emulator@example.com',
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  } )}.`;
}

describe( 'SayIt get started wizard', () => {
  beforeEach( () => {
    cy.clearLocalStorage();
    cy.intercept( 'GET', 'https://todd.taliferro.tech/login*', { statusCode: 200, body: '<html><body>TODD login</body></html>' } ).as( 'toddLogin' );
  } );

  it( 'starts one step in with every answer preselected', () => {
    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-progress"] li' ).should( 'have.length', 4 );
    cy.get( '[data-cy="get-started-progress"] li' ).eq( 0 ).should( 'have.class', 'is-done' );
    cy.contains( "You're already 1 step in" );
    cy.contains( '[data-cy="get-started-intent"]', "I'm looking for something" ).should( 'have.class', 'is-selected' );
    cy.get( '[data-cy="get-started-next"]' ).should( 'not.be.disabled' );
    cy.get( '[data-cy="get-started-existing"]' ).should( 'have.attr', 'href', '/login' );
  } );

  it( 'writes the post from taps, lets them edit it, and keeps the draft across reloads', () => {
    cy.visit( '/get-started' );
    cy.contains( '[data-cy="get-started-intent"]', "I'm offering something" ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'What are you offering?' );
    cy.contains( '[data-cy="get-started-topic"]', 'My services' ).should( 'have.class', 'is-selected' );
    cy.get( '[data-cy="get-started-topic-other"]' ).click();
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Bookkeeping' );
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', 'Which industry?' );
    cy.get( '[data-cy="get-started-category-row"]' ).should( 'contain.text', 'Any industry' ).click();
    cy.contains( '[data-cy="get-started-category"]', 'Construction' ).click();
    cy.get( '[data-cy="get-started-category-row"]' ).should( 'contain.text', 'Construction' );
    cy.get( '[data-cy="get-started-next"]' ).click();

    cy.contains( '[data-cy="get-started-question"]', "Here's your post" );
    cy.get( '[data-cy="get-started-post"]' ).should( 'have.value', 'Offering bookkeeping in construction. Happy to help - reach out!' );
    cy.get( '[data-cy="get-started-preview"]' ).should( 'contain.text', 'Offering bookkeeping in construction' );

    cy.reload();
    cy.window().then( ( win ) => {
      const draft = JSON.parse( win.localStorage.getItem( draftKey ) || '{}' );
      expect( draft ).to.include( { intent: 'offering', topic: 'Bookkeeping', category: 'construction', readyToSubmit: false } );
    } );
  } );

  it( 'requires first and last name but lets the business be skipped', () => {
    cy.visit( '/get-started' );
    for ( let i = 0; i < 4; i++ ) cy.get( '[data-cy="get-started-next"]' ).click();
    cy.contains( '[data-cy="get-started-question"]', "What's your first name?" );
    cy.get( '[data-cy="get-started-next"]' ).should( 'be.disabled' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );
    cy.contains( '[data-cy="get-started-question"]', "What's your business called?" );
    cy.get( '[data-cy="get-started-skip"]' ).click();
    cy.contains( '[data-cy="get-started-question"]', 'Last step: sign in to post it' );
    cy.contains( '.gs-preview__name', 'Ada Lovelace' );
  } );

  it( 'signs in through TODD login and lands on the published post', () => {
    const uid = `cy-wizard-${Date.now()}`;
    // Record bodies in the handlers: cy.wait() on these aliases occasionally
    // misses a request that the stub did answer.
    const toddProfile: any[] = [];
    const sayitProfile: any[] = [];
    cy.intercept( 'POST', '**/api/onboarding/profile', ( req ) => { toddProfile.push( req.body ); req.reply( { success: true } ); } );
    cy.intercept( 'POST', '**/api/sayit/profile/complete', ( req ) => { sayitProfile.push( req.body ); req.reply( { success: true } ); } );
    cy.intercept( 'POST', '**/api/openai', {
      statusCode: 200,
      body: { response: JSON.stringify( { displayName: 'x', category: 'retail', rating: 1, explanation: 'Fine.' } ) },
    } ).as( 'moderation' );

    cy.visit( '/get-started' );
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.contains( '[data-cy="get-started-topic"]', 'Referrals' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-post"]' ).clear().type( `Looking for referrals ${uid}` );
    cy.get( '[data-cy="get-started-next"]' ).click();
    cy.get( '[data-cy="get-started-input"]' ).type( 'Ada{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Lovelace{enter}' );
    cy.get( '[data-cy="get-started-input"]' ).type( 'Analytical Co{enter}' );
    cy.get( '[data-cy="get-started-sign-in"]' ).click();

    cy.wait( '@toddLogin' ).then( ( { request } ) => {
      expect( request.url ).to.include( 'client=sayit-web-local' );
      const state = new URL( request.url ).searchParams.get( 'state' ) || '';
      expect( state ).to.have.length.greaterThan( 10 );

      cy.visitWithFirebaseEmulators( `/auth/callback?token=${emulatorCustomToken( uid )}&state=${state}` );
    } );

    cy.location( 'pathname', { timeout: 20000 } ).should( 'match', /^\/post\/.+/ );
    cy.get( '[data-cy="post-view"]', { timeout: 15000 } ).should( 'contain.text', `Looking for referrals ${uid}` );
    cy.window().its( 'localStorage' ).invoke( 'getItem', draftKey ).should( 'be.null' );

    cy.wrap( toddProfile ).should( 'have.length', 1 );
    cy.wrap( sayitProfile ).should( 'have.length', 1 ).then( () => {
      expect( toddProfile[0].profile ).to.deep.equal( { firstName: 'Ada', lastName: 'Lovelace', companyName: 'Analytical Co' } );
      expect( sayitProfile[0] ).to.deep.include( {
        displayName: 'Ada at Analytical Co',
        intentText: `Looking for referrals ${uid}`,
        businessName: 'Analytical Co',
        profileIntentCompleted: true,
      } );
    } );
  } );

  it( 'rejects a callback that did not start from this browser', () => {
    cy.visitWithFirebaseEmulators( `/auth/callback?token=${emulatorCustomToken( 'cy-forged' )}&state=forged` );
    cy.get( '[data-cy="auth-callback-shell"]' ).should( 'contain.text', 'invalid or expired' );
  } );
} );
