import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MenuButtonComponent } from '../menu-button/menu-button.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

/**
 * The app's top bar: "Say It" wordmark, For you / Orgs / Inbox tabs (as in the
 * iOS app), the theme toggle, any page actions projected after it, and the
 * Menu button for the universal menu (in place of its floating pill).
 */
@Component( {
  selector: 'app-sayit-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ThemeToggleComponent, MenuButtonComponent],
  template: `
    <header class="sayit-topbar">
      <div class="sayit-brand">
        <a class="sayit-wordmark" routerLink="/" aria-label="Say It home">
          <img src="/assets/sayit/sayit-logo.png" alt="" width="34" height="34">
          <span>Say It</span>
        </a>
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
        <app-menu-button></app-menu-button>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .sayit-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px 16px;
      flex-wrap: wrap;
      padding: 14px 0;
    }
    .sayit-brand {
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .sayit-wordmark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font: 700 24px/1 var(--font);
      letter-spacing: -0.04em;
      color: var(--text);
      text-decoration: none;
    }
    .sayit-wordmark img {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      object-fit: cover;
    }
    .sayit-wordmark:hover { color: var(--text); }
    .sayit-tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: var(--radius-pill);
      background: var(--surface);
    }
    .sayit-tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      font: 600 14px/1.2 var(--font);
      color: var(--text);
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .sayit-tab:hover {
      color: var(--text);
      background: var(--surface2);
    }
    .sayit-tab.active {
      background: var(--text);
      color: var(--bg);
    }
    .sayit-tab-badge {
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: var(--radius-pill);
      background: var(--blue);
      color: #fff;
      font: 700 11px/18px var(--font);
      text-align: center;
    }
    .sayit-topbar__actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    @media (max-width: 480px) {
      .sayit-topbar__actions {
        width: 100%;
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .sayit-topbar__actions::-webkit-scrollbar { display: none; }
      app-menu-button { margin-left: auto; }
    }
    @media (max-width: 767.98px) {
      .sayit-topbar { padding: 10px 0; }
      .sayit-brand { gap: 12px; }
      .sayit-wordmark { font-size: 22px; }
    }
  `]
} )
export class SayitTopbarComponent {
  @Input() active: 'feed' | 'orgs' | 'inbox' | '' = '';
  @Input() unreadCount = 0;
}
