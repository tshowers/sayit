import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Share links used to be built as `/?post=<id>`, but nothing on the home
 * page ever read that parameter, so they landed on the generic board. This
 * sends any of those already-shared links to the isolated post view.
 */
export const legacyPostLinkGuard: CanActivateFn = ( route ) => {
  const postId = String( route.queryParamMap.get( 'post' ) || '' ).trim();
  return postId ? inject( Router ).createUrlTree( ['/post', postId] ) : true;
};
