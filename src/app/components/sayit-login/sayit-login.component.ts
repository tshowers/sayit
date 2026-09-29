import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { AuthContextService } from '../../services/auth-context.service';

/**
 * /login is a handoff for returning members, guards and deep links: it
 * goes straight to TODD's hosted login (the same page every TODD app
 * uses) and comes back through /auth/callback. New visitors start at
 * /get-started instead.
 */
@Component( {
  selector: 'app-sayit-login',
  standalone: true,
  template: `<div data-cy="sign-in-shell" style="max-width: 480px; margin: 4rem auto; text-align: center; padding: 0 1rem;"><p>Taking you to sign in...</p></div>`,
} )
export class SayitLoginComponent implements OnInit {
  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthContextService,
  ) { }

  async ngOnInit (): Promise<void> {
    const returnUrl = String( this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '' ).trim() || '/';
    if ( await firstValueFrom( this.authService.isLoggedIn().pipe( take( 1 ) ) ) ) {
      await this.router.navigateByUrl( returnUrl );
      return;
    }
    // Let the shell render first so the handoff is visible (and testable).
    setTimeout( () => this.authService.signIn( returnUrl ), 100 );
  }
}
