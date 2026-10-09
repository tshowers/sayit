/**
 * Link previews on posts. The backend's posts trigger saves `linkPreview` on a
 * post that links somewhere (title, summary, image, site name, and for YouTube
 * and Vimeo `video: { provider, id }`). The board card and the post page read
 * it through these helpers. Posts saved before the server did this have no
 * `video`, so the id is also read from the link itself. TikTok is not played
 * in place; it shows as an ordinary link card.
 */

export interface PostVideo {
  provider: 'youtube' | 'vimeo';
  id: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const YOUTUBE_ID = /^[\w-]{11}$/;

/** The first link in a post's text, without trailing punctuation. */
export function firstUrlIn ( text: string | null | undefined ): string | null {
  const match = String( text || '' ).match( URL_PATTERN );
  return match ? match[0].replace( /[).,!?;:'"\]]+$/, '' ) : null;
}

/** A playable YouTube or Vimeo link, or null. */
export function videoForUrl ( rawUrl: string | null | undefined ): PostVideo | null {
  let url: URL;
  try {
    url = new URL( String( rawUrl || '' ) );
  } catch {
    return null;
  }
  const host = url.hostname.replace( /^(www\.|m\.|music\.)/, '' ).toLowerCase();
  const segments = url.pathname.split( '/' ).filter( Boolean );

  if ( host === 'youtu.be' && YOUTUBE_ID.test( segments[0] || '' ) ) return { provider: 'youtube', id: segments[0] };
  if ( host === 'youtube.com' || host === 'youtube-nocookie.com' ) {
    const v = url.searchParams.get( 'v' );
    if ( v && YOUTUBE_ID.test( v ) ) return { provider: 'youtube', id: v };
    if ( ['shorts', 'embed', 'live', 'v'].includes( segments[0] ) && YOUTUBE_ID.test( segments[1] || '' ) ) return { provider: 'youtube', id: segments[1] };
  }
  if ( host === 'vimeo.com' || host === 'player.vimeo.com' ) {
    const id = segments.find( ( segment ) => /^\d{6,}$/.test( segment ) );
    if ( id ) return { provider: 'vimeo', id };
  }
  return null;
}

/** The post's link: the saved preview's URL, else the first link in its text. */
export function postLinkUrl ( post: any ): string | null {
  const saved = String( post?.linkPreview?.url || post?.link || '' ).trim();
  return saved || firstUrlIn( post?.content );
}

/** The video to play in place for a post, if it links to YouTube or Vimeo. */
export function postVideo ( post: any ): PostVideo | null {
  const saved = post?.linkPreview?.video;
  if ( saved && ( saved.provider === 'youtube' || saved.provider === 'vimeo' ) && saved.id ) {
    return { provider: saved.provider, id: String( saved.id ) };
  }
  return videoForUrl( postLinkUrl( post ) );
}

/** The player URL for a video. */
export function videoEmbedUrl ( video: PostVideo, autoplay = true ): string {
  const id = encodeURIComponent( video.id );
  return video.provider === 'youtube'
    ? `https://www.youtube.com/embed/${id}?rel=0&playsinline=1${autoplay ? '&autoplay=1' : ''}`
    : `https://player.vimeo.com/video/${id}?playsinline=1${autoplay ? '&autoplay=1' : ''}`;
}

/** A video's thumbnail when the preview has no image. */
export function videoThumbnail ( video: PostVideo ): string {
  return video.provider === 'youtube' ? `https://i.ytimg.com/vi/${encodeURIComponent( video.id )}/hqdefault.jpg` : '';
}

/**
 * The words of a post with its previewed link taken out, since the card shows
 * the link. A post that was only a link comes back empty.
 */
export function textWithoutLink ( post: any ): string {
  const content = String( post?.content || '' );
  if ( !post?.linkPreview ) return content.trim();
  const url = firstUrlIn( content );
  if ( !url ) return content.trim();
  return content
    .replace( url, ' ' )
    .replace( /[(\[]\s*[)\]]/g, '' ) // "(link)" leaves empty brackets
    .replace( /[ \t]+([.,!?;:])/g, '$1' )
    .replace( /[ \t]{2,}/g, ' ' )
    .replace( /\s*\n\s*\n\s*/g, '\n\n' )
    .trim();
}
