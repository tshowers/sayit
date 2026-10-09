import { postVideo, textWithoutLink, videoEmbedUrl, videoForUrl } from './post-link';

describe( 'post-link', () => {
  it( 'reads YouTube and Vimeo ids from links', () => {
    expect( videoForUrl( 'https://youtu.be/qYIL-F9XvGg?is=6dYc_NrowHKswR_j' ) ).toEqual( { provider: 'youtube', id: 'qYIL-F9XvGg' } );
    expect( videoForUrl( 'https://m.youtube.com/watch?v=qYIL-F9XvGg&t=3' ) ).toEqual( { provider: 'youtube', id: 'qYIL-F9XvGg' } );
    expect( videoForUrl( 'https://www.youtube.com/shorts/qYIL-F9XvGg' ) ).toEqual( { provider: 'youtube', id: 'qYIL-F9XvGg' } );
    expect( videoForUrl( 'https://vimeo.com/1084537' ) ).toEqual( { provider: 'vimeo', id: '1084537' } );
  } );

  it( 'does not play TikTok or ordinary links in place', () => {
    expect( videoForUrl( 'https://www.tiktok.com/@a/video/7234567890123456789' ) ).toBeNull();
    expect( videoForUrl( 'https://www.espn.com/nfl/story/_/id/50136406/x' ) ).toBeNull();
    expect( videoForUrl( 'not a url' ) ).toBeNull();
  } );

  it( "prefers the server's saved video", () => {
    const post = { content: 'https://youtu.be/x', linkPreview: { url: 'https://youtu.be/x', video: { provider: 'vimeo', id: '1084537' } } };
    expect( postVideo( post ) ).toEqual( { provider: 'vimeo', id: '1084537' } );
  } );

  it( 'builds player URLs', () => {
    expect( videoEmbedUrl( { provider: 'youtube', id: 'qYIL-F9XvGg' } ) ).toBe( 'https://www.youtube.com/embed/qYIL-F9XvGg?rel=0&playsinline=1&autoplay=1' );
    expect( videoEmbedUrl( { provider: 'vimeo', id: '1084537' }, false ) ).toBe( 'https://player.vimeo.com/video/1084537?playsinline=1' );
  } );

  it( 'drops the previewed link from the text and keeps what the person wrote', () => {
    const preview = { url: 'https://espn.com/a' };
    expect( textWithoutLink( { content: 'https://espn.com/a', linkPreview: preview } ) ).toBe( '' );
    expect( textWithoutLink( { content: 'Go Bucs! https://espn.com/a', linkPreview: preview } ) ).toBe( 'Go Bucs!' );
    expect( textWithoutLink( { content: 'Read this (https://espn.com/a).', linkPreview: preview } ) ).toBe( 'Read this.' );
  } );

  it( 'leaves the text alone until there is a preview', () => {
    expect( textWithoutLink( { content: 'https://espn.com/a' } ) ).toBe( 'https://espn.com/a' );
  } );
} );
