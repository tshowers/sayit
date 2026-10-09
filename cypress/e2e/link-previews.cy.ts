/**
 * Link previews on posts. The backend's posts trigger saves `linkPreview`
 * (title, summary, image, site name, and `video` for YouTube/Vimeo); these
 * tests seed posts as the trigger leaves them and check the board card and the
 * post page show the preview instead of the bare URL.
 */
describe( 'SayIt link previews', () => {
  const run = `${Date.now()}`;
  const credentials = () => ( { email: `sayit-lp-${run}-${Math.floor( Math.random() * 1e6 )}@example.com`, password: 'CypressTest123!' } );
  const articleUrl = 'https://www.espn.com/nfl/story/_/id/50136406/buccaneers-explode-first-win-cowboys-tnf';
  const videoUrl = 'https://youtu.be/qYIL-F9XvGg?is=6dYc_NrowHKswR_j';
  const tiktokUrl = 'https://www.tiktok.com/@sayit/video/7234567890123456789';

  before( () => {
    const now = Date.now();
    cy.seedFirestoreDoc( `posts/lp-article-${run}`, {
      content: articleUrl, displayName: 'Ada', userId: 'cy-author', category: 'general', timestamp: new Date( now ),
      linkPreview: {
        url: articleUrl, title: `Buccaneers explode for first win ${run}`, description: 'Tampa Bay held off Dallas.',
        image: 'https://a2.espncdn.com/photo.jpg', siteName: 'ESPN.com', source: 'server',
      },
    } );
    cy.seedFirestoreDoc( `posts/lp-video-${run}`, {
      content: `Worth a watch ${videoUrl}`, displayName: 'Ada', userId: 'cy-author', category: 'general', timestamp: new Date( now + 1000 ),
      linkPreview: {
        url: videoUrl, title: `Why the deal worries us ${run}`, description: 'Double Toasted',
        image: 'https://i.ytimg.com/vi/qYIL-F9XvGg/hqdefault.jpg', siteName: 'YouTube', source: 'server',
        video: { provider: 'youtube', id: 'qYIL-F9XvGg' },
      },
    } );
    cy.seedFirestoreDoc( `posts/lp-tiktok-${run}`, {
      content: tiktokUrl, displayName: 'Ada', userId: 'cy-author', category: 'general', timestamp: new Date( now + 2000 ),
      linkPreview: { url: tiktokUrl, title: `Packing hack ${run}`, description: '', image: '', siteName: 'TikTok', source: 'server' },
    } );
  } );

  beforeEach( () => {
    cy.intercept( { url: 'https://api.taliferro.tech/api/**' }, { statusCode: 200, body: { success: true } } );
  } );

  it( 'shows link and video cards on the board without the bare URL', () => {
    cy.visitWithFirebaseEmulators( '/', credentials() );

    cy.contains( '.sy-card', `Buccaneers explode for first win ${run}`, { timeout: 20000 } ).within( () => {
      cy.get( '.sy-card__site' ).should( 'have.text', 'ESPN.com' );
      cy.get( '.sy-card__media img' ).should( 'have.attr', 'src', 'https://a2.espncdn.com/photo.jpg' );
      cy.get( '.sy-card__caption' ).should( 'contain.text', 'Tampa Bay held off Dallas.' );
      cy.root().should( 'not.contain.text', articleUrl );
    } );

    cy.contains( '.sy-card', `Why the deal worries us ${run}` ).within( () => {
      cy.get( '.sy-card__play' ).should( 'exist' );
      cy.get( '.sy-card__caption' ).should( 'have.text', 'Worth a watch' );
      cy.root().should( 'not.contain.text', 'youtu.be' );
      cy.get( '.sy-card__play' ).click();
    } );
    cy.get( 'iframe.sayit-popup-video' ).should( 'have.attr', 'src' ).and( 'include', 'https://www.youtube.com/embed/qYIL-F9XvGg' );
    cy.get( '.sayit-popup-close' ).click();
    cy.get( 'iframe.sayit-popup-video' ).should( 'not.exist' );

    // TikTok is a plain link card: no in-place player.
    cy.contains( '.sy-card', `Packing hack ${run}` ).within( () => {
      cy.get( '.sy-card__play' ).should( 'not.exist' );
      cy.get( '.sy-card__linkpanel' ).should( 'contain.text', 'TikTok' );
    } );
  } );

  it( 'plays a video on the post page and keeps what the person wrote', () => {
    cy.visitWithFirebaseEmulators( `/post/lp-video-${run}` );
    cy.get( '[data-cy="post-view"]', { timeout: 15000 } ).within( () => {
      cy.get( '.post-view-message' ).should( 'have.text', 'Worth a watch' );
      cy.get( 'iframe' ).should( 'have.attr', 'src' ).and( 'include', 'https://www.youtube.com/embed/qYIL-F9XvGg' );
      cy.get( '.post-view-link-site' ).should( 'have.text', 'YouTube' );
    } );
  } );

  it( 'shows a bare article link as a card on the post page', () => {
    cy.visitWithFirebaseEmulators( `/post/lp-article-${run}` );
    cy.get( '[data-cy="post-view"]', { timeout: 15000 } ).within( () => {
      cy.get( '.post-view-message' ).should( 'not.exist' );
      cy.get( '.post-view-link-title' ).should( 'contain.text', `Buccaneers explode for first win ${run}` );
      cy.get( 'iframe' ).should( 'not.exist' );
    } );
  } );
} );
