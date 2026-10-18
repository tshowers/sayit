/**
 * One returning member's whole visit, sign in to sign out: in through TODD's
 * (stubbed) hosted login and /auth/callback, post from the board, like it,
 * comment and delete the comment, delete the post, follow an org, save the
 * profile, then log out and find the members-only pages locked again.
 * Firestore writes land in the emulator and are checked there; the TODD
 * backend is stubbed, so the profile save is checked by what it sends.
 */
import { emulatorCustomToken } from '../support/emulator-token';

const TENANT = 'yH3nWanUv0RqDCNfwXBOXLWuxt52';
const profilesPath = `tenants/${TENANT}/say-it-profiles`;
const FIRESTORE_EMULATOR_DOCS = 'http://127.0.0.1:8380/v1/projects/taliferrotech/databases/(default)/documents';

function readFirestoreDoc ( path: string ) {
  return cy.request( {
    url: `${FIRESTORE_EMULATOR_DOCS}/${path}`,
    headers: { Authorization: 'Bearer owner' },
    failOnStatusCode: false,
  } );
}

/**
 * cy.request runs once and is not retried, so poll until a write the page
 * started has landed in the emulator.
 */
function waitForFirestoreDoc ( path: string, check: ( response: Cypress.Response<any> ) => boolean, attempts = 20 ): void {
  readFirestoreDoc( path ).then( ( response ) => {
    if ( check( response ) ) return;
    if ( attempts <= 1 ) throw new Error( `Firestore ${path} never reached the expected state` );
    cy.wait( 250 );
    waitForFirestoreDoc( path, check, attempts - 1 );
  } );
}

const listHas = ( response: Cypress.Response<any>, field: string, value: string ) =>
  ( response.body?.fields?.[field]?.arrayValue?.values || [] ).some( ( v: any ) => v.stringValue === value );

describe( 'SayIt member journey - sign in to sign out', () => {
  it( 'signs in, posts, likes, comments, follows, saves the profile and signs out', () => {
    const run = `${Date.now()}`;
    const uid = `cy-member-${run}`;
    const orgId = `cy-journey-org-${run}`;
    const postText = `Need a sign painter ${run}`;
    const commentText = `Still looking ${run}`;

    // A returning member: profile already complete, so no "finish your profile" nudge.
    cy.seedFirestoreDoc( `${profilesPath}/${uid}`, {
      uid, displayName: 'Grace at Hopper Co', intentText: 'I help teams ship software', businessName: 'Hopper Co',
      publicProfile: true, profileIntentCompleted: true, lastUpdated: new Date(),
    } );
    cy.seedFirestoreDoc( `${profilesPath}/${orgId}`, {
      uid: orgId, publicProfile: true, businessName: `Journey Signs ${run}`, businessCategory: 'Signage', lastUpdated: new Date(),
    } );

    const sayitProfile: any[] = [];
    cy.intercept( { url: 'https://api.taliferro.tech/api/**' }, { statusCode: 200, body: { success: true } } );
    cy.intercept( 'POST', '**/api/openai', {
      statusCode: 200,
      body: { response: JSON.stringify( { displayName: 'x', category: 'general', rating: 1, explanation: 'Fine.' } ) },
    } );
    cy.intercept( 'POST', '**/api/sayit/profile/complete', ( req ) => { sayitProfile.push( req.body ); req.reply( { success: true } ); } );
    cy.intercept( 'GET', 'https://todd.taliferro.tech/login*', { statusCode: 200, body: '<html><body>TODD login</body></html>' } ).as( 'toddLogin' );

    cy.log( 'Sign in: /login -> TODD -> /auth/callback -> back where they asked to go' );
    cy.visitWithFirebaseEmulators( '/login?returnUrl=%2Fboard' );
    cy.wait( '@toddLogin' ).then( ( { request } ) => {
      const state = new URL( request.url ).searchParams.get( 'state' ) || '';
      expect( state ).to.have.length.greaterThan( 10 );
      cy.visitWithFirebaseEmulators( `/auth/callback?token=${emulatorCustomToken( uid )}&state=${state}` );
    } );
    cy.location( 'pathname', { timeout: 40000 } ).should( 'eq', '/board' );
    cy.get( 'button[aria-label="Log out"]', { timeout: 20000 } ).should( 'exist' );
    cy.get( '[data-cy="guest-banner"]' ).should( 'not.exist' );
    cy.get( '[data-cy="profile-incomplete-banner"]' ).should( 'not.exist' );

    cy.log( 'Post from the board' );
    cy.get( 'button[aria-label="Create a post"]' ).trigger( 'mouseenter' );
    cy.get( '.sayit-composer-panel' ).should( 'have.class', 'open' );
    // The greeting uses the saved profile, which loads just after sign-in;
    // posting before it lands would credit the post to "User".
    cy.get( '[data-cy="composer-kind-looking-for"]' ).click();
    cy.get( 'input[name="message"]' ).should( 'have.attr', 'placeholder', 'Hi, Grace at Hopper Co say it' )
      .type( `${postText}{enter}` );
    cy.contains( '.sy-card', postText, { timeout: 20000 } ).as( 'card' );
    cy.get( '@card' ).find( '.sy-card__name' ).should( 'contain.text', 'Grace at Hopper Co' );
    cy.get( 'input[name="message"]' ).should( 'have.value', '' );

    cy.get( '@card' ).find( 'a[aria-label="Open post"]' ).invoke( 'attr', 'href' ).then( ( href ) => {
      const postId = String( href ).split( '/' ).pop() as string;
      expect( postId ).to.have.length.greaterThan( 5 );

      readFirestoreDoc( `posts/${postId}` ).its( 'body.fields' ).should( ( fields: any ) => {
        expect( fields.userId.stringValue ).to.equal( uid );
        expect( fields.content.stringValue ).to.equal( postText );
        expect( fields.category.stringValue ).to.equal( 'general' );
        expect( fields.kind.stringValue ).to.equal( 'looking-for' );
      } );

      cy.log( 'Like it' );
      cy.contains( '.sy-card', postText ).find( 'button[aria-label="Like"]' ).click();
      cy.contains( '.sy-card', postText ).find( 'button[aria-label="Unlike"]' ).should( 'have.attr', 'aria-pressed', 'true' );
      waitForFirestoreDoc( `${profilesPath}/${uid}`, ( r ) => listHas( r, 'favoritePostIds', postId ) );

      cy.log( 'Comment, then delete the comment' );
      cy.contains( '.sy-card', postText ).find( 'button[aria-label="Comments"]' ).click();
      cy.contains( '.sy-card', postText ).find( '.sy-sheet' ).within( () => {
        cy.contains( '.sy-sheet__empty', 'No comments yet.' );
        cy.get( 'input[aria-label="Add a comment"]' ).type( commentText );
        cy.get( 'button[aria-label="Post comment"]' ).click();
        cy.contains( '.sy-comment', commentText, { timeout: 15000 } ).find( 'button[aria-label="Delete comment"]' ).click();
        cy.contains( '.sy-comment', commentText ).should( 'not.exist' );
        cy.contains( '.sy-sheet__empty', 'No comments yet.' );
      } );
      cy.request( {
        url: `${FIRESTORE_EMULATOR_DOCS}/posts/${postId}/comments`,
        headers: { Authorization: 'Bearer owner' },
      } ).its( 'body.documents' ).should( 'be.undefined' );

      cy.log( 'Delete the post' );
      cy.on( 'window:confirm', ( text ) => {
        expect( text ).to.include( postText );
        return true;
      } );
      cy.contains( '.sy-card', postText ).find( 'button[aria-label="Delete this post"]' ).click();
      cy.contains( '.sy-card', postText, { timeout: 15000 } ).should( 'not.exist' );
      waitForFirestoreDoc( `posts/${postId}`, ( r ) => r.status === 404 );
    } );

    cy.log( 'Follow an org - and the session survives a fresh page load' );
    cy.visitWithFirebaseEmulators( '/businesses' );
    cy.get( '[data-cy="directory-search"]', { timeout: 15000 } ).type( `Journey Signs ${run}` );
    cy.contains( '[data-cy="directory-card"]', `Journey Signs ${run}` ).find( '.org-follow' )
      .should( 'have.attr', 'aria-pressed', 'false' ).click();
    cy.contains( '[data-cy="directory-card"]', `Journey Signs ${run}` ).find( '.org-follow' )
      .should( 'have.attr', 'aria-pressed', 'true' ).and( 'contain.text', 'Following' );
    // The button flips before the write lands - wait for it before reloading.
    waitForFirestoreDoc( `${profilesPath}/${uid}`, ( r ) => listHas( r, 'watchlistProfileIds', orgId ) );
    cy.reload();
    cy.get( '[data-cy="directory-search"]', { timeout: 15000 } ).type( `Journey Signs ${run}` );
    cy.contains( '[data-cy="directory-card"]', `Journey Signs ${run}` ).find( '.org-follow' )
      .should( 'have.attr', 'aria-pressed', 'true' );

    cy.log( 'Edit and save the profile' );
    cy.visitWithFirebaseEmulators( '/profile' );
    // Wait for the saved profile to prefill, so typing isn't overwritten by it.
    cy.get( '#piDisplayName', { timeout: 15000 } ).should( 'have.value', 'Grace at Hopper Co' );
    cy.get( '#piDisplayName' ).clear().type( 'Grace H' );
    cy.get( '#piLocation' ).clear().type( 'Tacoma, WA' );
    cy.get( '#piIntent' ).clear().type( 'Looking for a sign painter' );
    cy.contains( 'button', 'Save Profile' ).click();
    cy.get( '.profile-intent-success' ).should( 'contain.text', 'Your SayIt profile has been updated.' );
    cy.wrap( sayitProfile ).should( 'have.length', 1 ).then( () => {
      expect( sayitProfile[0] ).to.deep.include( {
        uid,
        displayName: 'Grace H',
        location: 'Tacoma, WA',
        intentText: 'Looking for a sign painter',
        businessName: 'Hopper Co',
        profileIntentCompleted: true,
      } );
    } );

    cy.log( 'Log out' );
    cy.visitWithFirebaseEmulators( '/board' );
    cy.get( 'button[aria-label="Log out"]', { timeout: 20000 } ).click();
    cy.location( 'pathname' ).should( 'eq', '/board' );
    cy.get( '[data-cy="guest-banner"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.get( 'button[aria-label="Log out"]' ).should( 'not.exist' );
    cy.get( '.sy-card' ).should( 'not.exist' );

    cy.log( 'Signed out stays signed out, even after a fresh load' );
    cy.visitWithFirebaseEmulators( '/profile' );
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
    cy.location( 'search' ).should( 'eq', '?returnUrl=%2Fprofile' );
    cy.visitWithFirebaseEmulators( '/interests' );
    cy.location( 'pathname' ).should( 'eq', '/get-started' );
  } );
} );
