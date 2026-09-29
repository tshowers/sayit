import { ExtractVideoIdPipe } from './extract-video-id.pipe';
import { GetVideoIconPipe } from './get-video-icon.pipe';
import { GetVideoPlatformPipe } from './get-video-platform.pipe';
import { IsVideoLinkPipe } from './is-video-link.pipe';

const YOUTUBE_WATCH = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10';
const YOUTUBE_SHORT = 'https://youtu.be/dQw4w9WgXcQ?si=abc';
const VIMEO = 'https://vimeo.com/123456789';
const TIKTOK = 'https://www.tiktok.com/@someone/video/7234567890123456789';
const PLAIN = 'https://example.com/article';

describe( 'GetVideoPlatformPipe', () => {
  const pipe = new GetVideoPlatformPipe();

  it( 'identifies each supported platform', () => {
    expect( pipe.transform( YOUTUBE_WATCH ) ).toBe( 'youtube' );
    expect( pipe.transform( YOUTUBE_SHORT ) ).toBe( 'youtube' );
    expect( pipe.transform( VIMEO ) ).toBe( 'vimeo' );
    expect( pipe.transform( TIKTOK ) ).toBe( 'tiktok' );
  } );

  it( 'returns null for anything else', () => {
    expect( pipe.transform( PLAIN ) ).toBeNull();
  } );
} );

describe( 'ExtractVideoIdPipe', () => {
  const pipe = new ExtractVideoIdPipe();

  it( 'pulls the id out of YouTube watch and short links', () => {
    expect( pipe.transform( YOUTUBE_WATCH, 'youtube' ) ).toBe( 'dQw4w9WgXcQ' );
    expect( pipe.transform( YOUTUBE_SHORT, 'youtube' ) ).toBe( 'dQw4w9WgXcQ' );
  } );

  it( 'pulls the id out of Vimeo and TikTok links', () => {
    expect( pipe.transform( VIMEO, 'vimeo' ) ).toBe( '123456789' );
    expect( pipe.transform( TIKTOK, 'tiktok' ) ).toBe( '7234567890123456789' );
  } );

  it( 'returns null for an unknown platform or a non-matching URL', () => {
    expect( pipe.transform( YOUTUBE_WATCH, 'twitch' ) ).toBeNull();
    expect( pipe.transform( PLAIN, 'vimeo' ) ).toBeNull();
  } );
} );

describe( 'IsVideoLinkPipe', () => {
  const pipe = new IsVideoLinkPipe();

  it( 'is true for supported video links', () => {
    [YOUTUBE_WATCH, YOUTUBE_SHORT, VIMEO, TIKTOK].forEach( ( url ) => expect( pipe.transform( url ) ).withContext( url ).toBeTrue() );
  } );

  it( 'is false for other links', () => {
    expect( pipe.transform( PLAIN ) ).toBeFalse();
    expect( pipe.transform( 'https://www.tiktok.com/@someone' ) ).toBeFalse();
  } );
} );

describe( 'GetVideoIconPipe', () => {
  const pipe = new GetVideoIconPipe();

  it( 'returns the platform icon', () => {
    expect( pipe.transform( YOUTUBE_SHORT ) ).toBe( 'assets/youtube-icon-5.svg' );
    expect( pipe.transform( VIMEO ) ).toBe( 'assets/vimeo-icon-blue.svg' );
    expect( pipe.transform( TIKTOK ) ).toBe( 'assets/tiktok-icon-black.svg' );
  } );

  it( 'falls back to the placeholder image', () => {
    expect( pipe.transform( '' ) ).toBe( '/assets/nophoto.svg' );
    expect( pipe.transform( PLAIN ) ).toBe( '/assets/nophoto.svg' );
  } );
} );
