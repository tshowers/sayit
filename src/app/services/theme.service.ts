import { Injectable, signal } from '@angular/core';

export type SayItTheme = 'light' | 'dark';

const STORAGE_KEY = 'sayit-theme';
const THEME_COLORS: Record<SayItTheme, string> = { light: '#f5ead8', dark: '#1b1917' };

/**
 * Light/dark theme for the whole app.
 *
 * index.html sets <html data-theme> before first paint (same storage key), so this
 * service only reads that value, keeps following the system setting until the visitor
 * picks a theme, and remembers the pick once they do.
 */
@Injectable( {
  providedIn: 'root'
} )
export class ThemeService {
  readonly theme = signal<SayItTheme>( this.readInitialTheme() );

  constructor () {
    this.apply( this.theme() );

    if ( typeof window === 'undefined' || !window.matchMedia ) return;
    window.matchMedia( '(prefers-color-scheme: dark)' ).addEventListener( 'change', ( event ) => {
      if ( this.storedTheme() ) return; // an explicit pick wins over the system
      this.set( event.matches ? 'dark' : 'light', false );
    } );
  }

  toggle (): void {
    this.set( this.theme() === 'dark' ? 'light' : 'dark' );
  }

  set ( theme: SayItTheme, remember = true ): void {
    this.theme.set( theme );
    this.apply( theme );
    if ( !remember ) return;
    try {
      localStorage.setItem( STORAGE_KEY, theme );
    } catch { }
  }

  private apply ( theme: SayItTheme ): void {
    if ( typeof document === 'undefined' ) return;
    const root = document.documentElement;
    root.setAttribute( 'data-theme', theme );
    root.setAttribute( 'data-bs-theme', theme );
    document.querySelector( 'meta[name="theme-color"]' )?.setAttribute( 'content', THEME_COLORS[theme] );
  }

  private storedTheme (): SayItTheme | null {
    try {
      const value = localStorage.getItem( STORAGE_KEY );
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  private readInitialTheme (): SayItTheme {
    const stored = this.storedTheme();
    if ( stored ) return stored;
    if ( typeof document !== 'undefined' ) {
      const attr = document.documentElement.getAttribute( 'data-theme' );
      if ( attr === 'light' || attr === 'dark' ) return attr;
    }
    return typeof window !== 'undefined' && window.matchMedia?.( '(prefers-color-scheme: dark)' ).matches ? 'dark' : 'light';
  }
}
