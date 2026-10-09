import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MenuHostService } from '../../services/menu-host.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

/**
 * The app's top bar: "Say It" wordmark, For you / Orgs / Inbox tabs (as in the
 * iOS app), the theme toggle, any page actions projected after it, and the
 * Menu button for the universal menu (in place of its floating pill).
 */
@Component( {
  selector: 'app-sayit-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ThemeToggleComponent],
  template: `
    <header class="sayit-topbar">
      <div class="sayit-brand">
        <a class="sayit-wordmark" routerLink="/" aria-label="Say It home">Say It</a>
        <nav class="sayit-tabs" aria-label="Say It sections">
          <a class="sayit-tab" routerLink="/" [class.active]="active === 'feed'" [attr.aria-current]="active === 'feed' ? 'page' : null">For you</a>
          <a class="sayit-tab" routerLink="/businesses" [class.active]="active === 'orgs'" [attr.aria-current]="active === 'orgs' ? 'page' : null">Orgs</a>
          <a class="sayit-tab" routerLink="/interests" [class.active]="active === 'inbox'" [attr.aria-current]="active === 'inbox' ? 'page' : null">
            Inbox<span *ngIf="unreadCount > 0" class="sayit-tab-badge">{{ unreadCount }}</span>
          </a>
        </nav>
      </div>
      <div class="sayit-topbar__actions">
        <app-theme-toggle></app-theme-toggle>
        <ng-content></ng-content>
        <button type="button" class="sayit-menu-button" (click)="menuHost.open()" aria-haspopup="dialog" aria-label="Open menu" title="Menu" data-cy="topbar-menu">
          <i class="fa-solid fa-bars" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .sayit-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem 1rem;
      flex-wrap: wrap;
      padding: 0.75rem 0;
    }
    .sayit-brand {
      display: flex;
      align-items: center;
      gap: 1.75rem;
      min-width: 0;
    }
    .sayit-wordmark {
      font-family: var(--font-heading);
      font-size: clamp(1.75rem, 3.4vw, 2.25rem);
      line-height: 1;
      color: var(--color-text);
      text-decoration: none;
    }
    .sayit-wordmark:hover { color: var(--color-text); }
    .sayit-tabs {
      display: flex;
      gap: 0.25rem;
      padding: 4px;
      border-radius: var(--radius-pill);
      background: var(--color-surface);
    }
    .sayit-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.95rem;
      border-radius: var(--radius-pill);
      font: 600 0.85rem/1.2 var(--font-body);
      color: var(--color-text);
      opacity: 0.7;
      text-decoration: none;
      transition: background 0.18s ease, opacity 0.18s ease;
    }
    .sayit-tab:hover {
      opacity: 1;
      color: var(--color-text);
      background: var(--color-hover);
    }
    .sayit-tab.active {
      opacity: 1;
      background: var(--color-text);
      color: var(--color-bg);
    }
    .sayit-tab-badge {
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: var(--radius-pill);
      background: var(--color-primary-bg);
      color: var(--color-primary-ink);
      font: 700 10.5px/18px var(--font-body);
      text-align: center;
    }
    .sayit-topbar__actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .sayit-menu-button {
      width: 2.75rem;
      height: 2.75rem;
      min-height: 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      background: var(--color-text);
      color: var(--color-bg);
      transition: opacity 0.18s ease, transform 0.12s ease;
    }
    .sayit-menu-button:hover { opacity: 0.85; }
    .sayit-menu-button:active { transform: scale(0.94); }
    @media (max-width: 767.98px) {
      .sayit-topbar { padding: 0.5rem 0; }
      .sayit-brand { gap: 0.75rem; flex-wrap: wrap; }
      .sayit-topbar__actions { gap: 0.25rem; }
      .sayit-menu-button { width: 2.35rem; height: 2.35rem; }
    }
  `]
} )
export class SayitTopbarComponent implements OnInit, OnDestroy {
  readonly menuHost = inject( MenuHostService );

  @Input() active: 'feed' | 'orgs' | 'inbox' | '' = '';
  @Input() unreadCount = 0;

  ngOnInit (): void {
    this.menuHost.registerInlineTrigger();
  }

  ngOnDestroy (): void {
    this.menuHost.unregisterInlineTrigger();
  }
}
