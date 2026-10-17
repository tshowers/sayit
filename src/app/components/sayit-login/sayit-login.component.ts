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
  template: `
    <div class="sign-in-shell" data-cy="sign-in-shell">
      <span class="sign-in-spinner" aria-hidden="true"></span>
      <p>Taking you to sign in...</p>
    </div>
  `,
  styles: [`
    .sign-in-shell {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px;
      text-align: center;
      color: var(--text);
    }
    .sign-in-shell p { margin: 0; font-size: 17px; font-weight: 600; }
    .sign-in-spinner {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 4px solid var(--surface2);
      border-top-color: var(--blue);
      animation: sign-in-spin 0.9s linear infinite;
    }
    @keyframes sign-in-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .sign-in-spinner { animation-duration: 2.4s; } }
  `],
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
