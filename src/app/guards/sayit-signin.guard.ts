import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { AuthContextService } from '../services/auth-context.service';

export const sayItSignInGuard: CanActivateFn = (route, state) => {
  const authContext = inject(AuthContextService);
  const router = inject(Router);

  return authContext.getUser().pipe(
    take(1),
    map((user) => {
      if (user) {
        return true;
      }

      // Everyone signs in through the get-started wizard first; returning
      // members use its "Already have an account?" link (which keeps returnUrl).
      return router.createUrlTree(['/get-started'], {
        queryParams: {
          returnUrl: state.url,
        },
      });
    }),
  );
};
