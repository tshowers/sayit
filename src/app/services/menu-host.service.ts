import { Injectable, computed, signal } from '@angular/core';

/**
 * Lets a page show its own Menu button for the app-wide universal menu.
 *
 * The menu lives once in AppComponent. Its floating pill covers page content on
 * phones, so the Say It top bar registers here, shows a Menu button in its own
 * action row, and the floating pill hides while that button is on screen.
 */
@Injectable( {
  providedIn: 'root'
} )
export class MenuHostService {
  private readonly inlineTriggers = signal( 0 );
  /** Bumped on each request; AppComponent opens the menu when it changes. */
  readonly openRequests = signal( 0 );
  readonly hasInlineTrigger = computed( () => this.inlineTriggers() > 0 );

  registerInlineTrigger (): void {
    this.inlineTriggers.update( ( count ) => count + 1 );
  }

  unregisterInlineTrigger (): void {
    this.inlineTriggers.update( ( count ) => Math.max( 0, count - 1 ) );
  }

  open (): void {
    this.openRequests.update( ( count ) => count + 1 );
  }
}
