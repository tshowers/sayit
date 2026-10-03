import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthContextService } from './services/auth-context.service';
import { NotificationComponent } from './shared/notification/notification.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';
import { SiteFooterComponent } from './shared/site-footer/site-footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationComponent, PlatformMenuComponent, SiteFooterComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( AuthContextService );
  readonly isLoggedIn$ = this.authService.isLoggedIn();
  readonly userName$ = this.authService.getUser().pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.authService.getUser().pipe( map( user => user?.email || '' ) );

  title = 'sayit';

  async signOut (): Promise<void> {
    await this.authService.signOut();
  }
}
