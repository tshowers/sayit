/**
 * The Say It iPhone app, for "get the app" prompts on the web.
 *
 * Put the app's Apple ID here once the App Store Connect record exists
 * (App Store Connect -> App Information -> Apple ID). Until Apple's public
 * lookup finds the app live, prompts say "Coming soon to iPhone" instead
 * of showing a dead link - nothing else changes on launch day. Same
 * approach as @taliferro/ui/platform/get-the-app.model.ts, which the paid
 * TODD apps use; Say It is free, so its wording is its own.
 */
export const SAYIT_IOS_APPLE_ID = '';

export function sayItAppStoreUrl ( appleId: string = SAYIT_IOS_APPLE_ID ): string {
  return appleId ? `https://apps.apple.com/app/id${appleId}` : '';
}

/** True once the app is live on the App Store. Never throws. */
export async function isSayItAppLive ( appleId: string = SAYIT_IOS_APPLE_ID ): Promise<boolean> {
  if ( !appleId || typeof fetch === 'undefined' ) return false;
  try {
    const response = await fetch( `https://itunes.apple.com/lookup?id=${appleId}&country=us` );
    if ( !response.ok ) return false;
    const body = await response.json();
    return Number( body?.resultCount ) > 0;
  } catch {
    return false;
  }
}

/** iPhone/iPad visitors get the stronger nudge - they can install right now. */
export function isAppleMobileDevice (): boolean {
  if ( typeof navigator === 'undefined' ) return false;
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac; touch points give it away.
  return /iPhone|iPad|iPod/.test( ua ) || ( /Macintosh/.test( ua ) && ( navigator.maxTouchPoints || 0 ) > 1 );
}

export const SAYIT_APP_BENEFITS = [
  'Message people the moment they tap I\'m interested',
  'Post a photo straight from your camera',
  'One post at a time - swipe to see what people need',
];
