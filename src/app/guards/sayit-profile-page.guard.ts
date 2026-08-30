import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';

import { AuthContextService } from '../services/auth-context.service';

export const sayItProfilePageGuard: CanActivateFn = () => {
  const authContext = inject( AuthContextService );
  const router = inject( Router );

  return authContext.getUser().pipe(
    take( 1 ),
    map( ( user ) => user ? true : router.createUrlTree( ['/not-authorized'] ) ),
  );
};
