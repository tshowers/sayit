import { Component, Input, computed, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

/** Sun/moon switch between the light and dark Organic themes. */
@Component( {
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button type="button" class="theme-toggle" [class.theme-toggle--text]="variant === 'text'" (click)="themeService.toggle()"
      [attr.aria-label]="label()" [title]="label()" [attr.aria-pressed]="isDark()" data-cy="theme-toggle">
      <i class="fa-solid" [class.fa-sun]="isDark()" [class.fa-moon]="!isDark()" aria-hidden="true"></i>
      @if ( variant === 'text' ) {
        <span>{{ isDark() ? 'Light mode' : 'Dark mode' }}</span>
      }
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .theme-toggle {
      position: relative;
      width: 2.75rem;
      height: 2.75rem;
      min-height: 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text);
      transition: background 0.18s ease, transform 0.12s ease;
    }
    .theme-toggle:hover { background: var(--color-hover); }
    .theme-toggle:active { transform: scale(0.94); }
    .theme-toggle--text {
      width: auto;
      height: auto;
      gap: 0.35rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 600;
    }
    .theme-toggle--text:hover { background: var(--color-hover); }
    @media (max-width: 767.98px) {
      .theme-toggle:not(.theme-toggle--text) { width: 2.35rem; height: 2.35rem; }
    }
  `]
} )
export class ThemeToggleComponent {
  @Input() variant: 'icon' | 'text' = 'icon';

  readonly themeService = inject( ThemeService );
  readonly isDark = computed( () => this.themeService.theme() === 'dark' );
  readonly label = computed( () => this.isDark() ? 'Switch to light mode' : 'Switch to dark mode' );
}
