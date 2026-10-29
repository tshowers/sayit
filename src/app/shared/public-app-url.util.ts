import { environment } from '../../environments/environment';

function getWindowLocation (): Location | null {
  if ( typeof window === 'undefined' || !window.location ) {
    return null;
  }

  return window.location;
}

function getHostname (): string {
  const location = getWindowLocation();
  return String( location?.hostname || '' ).trim().toLowerCase();
}

function getOrigin (): string {
  const location = getWindowLocation();
  return String( location?.origin || environment.PLATFORM_URL || '' ).trim().replace( /\/$/, '' );
}

function isStagingHost (): boolean {
  const hostname = getHostname();
  return hostname === 'staging.taliferro.tech'
    || hostname === 'staging.16ahead.com'
    || hostname === 'todd-staging.web.app';
}

function isSayitHost (): boolean {
  const hostname = getHostname();
  return hostname === 'sayit.taliferro.tech'
    || hostname === 'sayit.16ahead.com'
    || hostname === 'todd-sayit.web.app';
}

export function getToddHomeUrl (): string {
  if ( isStagingHost() ) {
    return getOrigin();
  }

  return String( environment.PLATFORM_URL || 'https://app.16ahead.com' )
    .trim()
    .replace( /\/$/, '' );
}

export function getFindHomeUrl (): string {
  return 'https://find.16ahead.com';
}

export function getSignatureBuilderUrl (): string {
  return 'https://signature.16ahead.com';
}

export function getSayitHomeUrl (): string {
  if ( isSayitHost() ) {
    return getOrigin();
  }

  if ( isStagingHost() ) {
    return `${getOrigin()}`;
  }

  return 'https://sayit.16ahead.com';
}

/** Public link to a single post - opens the isolated post view (and the iOS app, via Universal Links). */
export function buildSayitPostUrl ( postId: string ): string {
  const normalizedId = String( postId || '' ).trim();
  if ( !normalizedId ) {
    return getSayitHomeUrl();
  }

  return `${getSayitHomeUrl()}/post/${encodeURIComponent( normalizedId )}`;
}

export function buildSayitShareUrl (
  queryKey: 'news',
  queryValue: string
): string {
  const normalizedValue = String( queryValue || '' ).trim();
  if ( !normalizedValue ) {
    return getSayitHomeUrl();
  }

  const url = new URL( getSayitHomeUrl() );
  url.searchParams.set( queryKey, normalizedValue );
  return url.toString();
}
