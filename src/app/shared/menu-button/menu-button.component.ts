import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MenuHostService } from '../../services/menu-host.service';

/**
 * The round Menu button for the universal menu. While one is on screen the
 * menu's floating pill hides (see MenuHostService), so pages without the full
 * topbar can still keep the menu in their own header.
 */
@Component( {
  selector: 'app-menu-button',
  standalone: true,
  template: `
    <button type="button" class="sayit-menu-button" (click)="menuHost.open()" data-sound="off" aria-haspopup="dialog" aria-label="Open menu" title="Menu" data-cy="topbar-menu">
      <i class="fa-solid fa-bars" aria-hidden="true"></i>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; flex: none; }
    .sayit-menu-button {
      width: 40px;
      height: 40px;
      min-height: 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      background: var(--text);
      color: var(--bg);
      transition: opacity 0.15s ease, transform 0.12s ease;
    }
    .sayit-menu-button:hover { opacity: 0.85; }
    .sayit-menu-button:active { transform: scale(0.94); }
    @media (max-width: 480px) {
      .sayit-menu-button { width: 36px; height: 36px; }
    }
  `]
} )
export class MenuButtonComponent implements OnInit, OnDestroy {
  readonly menuHost = inject( MenuHostService );

  ngOnInit (): void {
    this.menuHost.registerInlineTrigger();
  }

  ngOnDestroy (): void {
    this.menuHost.unregisterInlineTrigger();
  }
}
