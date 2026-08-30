import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthGateModalComponent } from '../auth-gate-modal/auth-gate-modal.component';

@Component( {
  selector: 'app-sayit-login',
  standalone: true,
  imports: [AuthGateModalComponent],
  templateUrl: './sayit-login.component.html'
} )
export class SayitLoginComponent {
  private readonly defaultReturnUrl = '/';

  constructor (
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) { }

  onSignedIn (): void {
    const returnUrl = String( this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '' ).trim();
    this.router.navigateByUrl( returnUrl || this.defaultReturnUrl );
  }

  onClosed (): void {
    this.router.navigateByUrl( this.defaultReturnUrl );
  }
}
