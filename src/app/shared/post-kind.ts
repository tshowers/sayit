/**
 * What a post is for, stored on the post as `kind`. Same values and labels
 * as the iOS app (sayit-ios SayItIOS/Logic/PostKind.swift); no kind is a
 * plain thought, event or update ("Just sharing").
 */
export type PostKind = 'selling' | 'looking-for';

export const POST_KINDS: PostKind[] = ['selling', 'looking-for'];

export const POST_KIND_LABEL: Record<PostKind, string> = {
  'selling': 'Selling',
  'looking-for': 'Looking for',
};

/** Reads a stored kind the way the app does, accepting the older spellings. */
export function parsePostKind ( stored: unknown ): PostKind | null {
  switch ( String( stored ?? '' ).toLowerCase().replace( /_/g, '-' ) ) {
    case 'selling':
    case 'offering':
      return 'selling';
    case 'looking-for':
    case 'lookingfor':
    case 'buying':
    case 'looking':
      return 'looking-for';
    default:
      return null;
  }
}
