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
    <div data-cy="auth-callback-shell" style="max-width: 480px; margin: 4rem auto; text-align: center; padding: 0 1rem;">
      <p *ngIf="!errorMessage">{{ status }}</p>
      <ng-container *ngIf="errorMessage">
        <p class="alert alert-danger">{{ errorMessage }}</p>
        <a routerLink="/login">Try again</a>
      </ng-container>
    </div>
  `,
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
