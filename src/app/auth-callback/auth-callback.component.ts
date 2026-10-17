import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AuthContextService } from '../services/auth-context.service';
import { SayItOnboardingService } from '../services/sayit-onboarding.service';

/**
 * Lands here from TODD's hosted login with ?token=<custom token>&state=...
 * Verifies `state` against what AuthContextService.signIn() stashed,
 * redeems the token, then publishes anything the /get-started wizard
 * built. A wizard post opens straight away so the new member sees it live.
 */
@Component( {
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="callback-shell" data-cy="auth-callback-shell">
      <ng-container *ngIf="!errorMessage">
        <span class="callback-spinner" aria-hidden="true"></span>
        <p>{{ status }}</p>
      </ng-container>
      <ng-container *ngIf="errorMessage">
        <p class="callback-error">{{ errorMessage }}</p>
        <a class="callback-retry" routerLink="/login">Try again</a>
      </ng-container>
    </div>
  `,
  styles: [`
    .callback-shell {
      min-height: 70vh;
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px 16px;
      text-align: center;
      color: var(--text);
    }
    .callback-shell p { margin: 0; font-size: 17px; font-weight: 600; }
    .callback-spinner {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 4px solid var(--surface2);
      border-top-color: var(--blue);
      animation: callback-spin 0.9s linear infinite;
    }
    @keyframes callback-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .callback-spinner { animation-duration: 2.4s; } }
    .callback-shell .callback-error {
      padding: 12px 18px;
      border-radius: var(--radius-md);
      background: var(--t-pink);
      color: var(--t-pink-fg);
      font-size: 15px;
    }
    .callback-retry {
      display: inline-flex;
      align-items: center;
      height: 46px;
      padding: 0 22px;
      border-radius: 999px;
      background: var(--blue);
      color: #fff;
      font-size: 15px;
      font-weight: 700;
    }
    .callback-retry:hover { color: #fff; filter: brightness(0.94); }
  `],
} )
export class AuthCallbackComponent implements OnInit {
  status = 'Signing you in...';
  errorMessage = '';

  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthContextService,
    private readonly onboarding: SayItOnboardingService,
  ) { }

  async ngOnInit (): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get( 'token' );
    const state = this.route.snapshot.queryParamMap.get( 'state' );
    const pending = this.authService.consumePendingLogin( state );

    if ( !token || !pending ) {
      this.errorMessage = 'This sign-in link is invalid or expired. Please try signing in again.';
      return;
    }

    try {
      await this.authService.signInWithCustomToken( token );
      if ( this.onboarding.hasPendingDraft() ) this.status = 'Posting...';
      const { postId } = await this.onboarding.submitIfPending();
      if ( postId ) {
        await this.router.navigate( ['/post', postId], { queryParams: { welcome: 1 } } );
        return;
      }
      await this.router.navigateByUrl( pending.returnUrl || '/' );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Sign-in failed. Please try again.';
    }
  }
}
