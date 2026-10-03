import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

/**
 * The app's top bar: "Say It" wordmark, For you / Orgs / Inbox tabs (as in the
 * iOS app), the theme toggle, and any page actions projected after it.
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
      /* Leave room for the universal Menu button floating top right. */
      margin-right: 104px;
    }
    @media (max-width: 767.98px) {
      .sayit-topbar { padding: 0.5rem 0; }
      .sayit-brand { gap: 0.75rem; flex-wrap: wrap; }
      .sayit-topbar__actions { gap: 0.25rem; }
    }
  `]
} )
export class SayitTopbarComponent {
  @Input() active: 'feed' | 'orgs' | 'inbox' | '' = '';
  @Input() unreadCount = 0;
}
