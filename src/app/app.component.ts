import { AsyncPipe } from '@angular/common';
import { Component, ViewChild, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthContextService } from './services/auth-context.service';
import { MenuHostService } from './services/menu-host.service';
import { NotificationComponent } from './shared/notification/notification.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationComponent, PlatformMenuComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( AuthContextService );
  readonly menuHost = inject( MenuHostService );
  readonly isLoggedIn$ = this.authService.isLoggedIn();
  readonly userName$ = this.authService.getUser().pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.authService.getUser().pipe( map( user => user?.email || '' ) );

  @ViewChild( PlatformMenuComponent ) private platformMenu?: PlatformMenuComponent;

  title = 'sayit';

  constructor () {
    // A page's own Menu button (the Say It top bar) asks the shared menu to open.
    effect( () => {
      if ( this.menuHost.openRequests() === 0 ) return;
      untracked( () => this.platformMenu?.open() );
    } );

    // index.html hides its static landing before paint for signed-in members.
    this.isLoggedIn$.pipe( takeUntilDestroyed() ).subscribe( ( loggedIn ) => {
      try {
        if ( loggedIn ) localStorage.setItem( 'sayit-member', '1' );
        else localStorage.removeItem( 'sayit-member' );
      } catch { /* storage blocked: the landing just shows until the app starts */ }
    } );
  }

  async signOut (): Promise<void> {
    await this.authService.signOut();
  }
}
