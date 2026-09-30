import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

import { isAppleMobileDevice, isSayItAppLive, SAYIT_APP_BENEFITS, sayItAppStoreUrl } from '../app-download';

/**
 * "Say It is best on iPhone" - the web's nudge toward the app. Web and app
 * are one account, so the web keeps working; the prompt just leads with the
 * app.
 *
 * - `hero`: the landing page for signed-out visitors - app first, with
 *   "start on the web" and "sign in" as the other ways in.
 * - `bar`: a slim, dismissible strip for signed-in web users (dismissal is
 *   remembered in localStorage).
 * - `link`: one line, for the /get-started wizard.
 */
@Component( {
  selector: 'app-promo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-promo.component.html',
  styleUrl: './app-promo.component.css',
} )
export class AppPromoComponent implements OnInit {
  @Input() variant: 'hero' | 'bar' | 'link' = 'hero';

  readonly benefits = SAYIT_APP_BENEFITS;
  readonly onAppleDevice = isAppleMobileDevice();
  isLive = false;
  appStoreLink = '';
  dismissed = false;

  private readonly dismissKey = 'sayit_app_promo_dismissed';

  async ngOnInit (): Promise<void> {
    if ( this.variant === 'bar' ) {
      try { this.dismissed = localStorage.getItem( this.dismissKey ) === '1'; } catch { }
    }
    this.isLive = await isSayItAppLive();
    this.appStoreLink = this.isLive ? sayItAppStoreUrl() : '';
  }

  dismiss (): void {
    this.dismissed = true;
    try { localStorage.setItem( this.dismissKey, '1' ); } catch { }
  }
}
