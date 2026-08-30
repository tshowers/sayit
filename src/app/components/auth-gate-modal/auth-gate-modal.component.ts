import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  getAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

@Component( {
  selector: 'app-auth-gate-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-gate-modal.component.html',
  styleUrl: './auth-gate-modal.component.css'
} )
export class AuthGateModalComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();
  @Output() signedIn = new EventEmitter<void>();
  @Input() dismissible = true;
  email = '';
  busy = false;
  successMessage = '';
  errorMessage = '';

  private readonly emailStorageKey = 'todd_emailForSignIn';
  private readonly browserHintStorageKey = 'todd_signInBrowserHint';

  ngOnInit (): void {
    // If the user opened the app from the sign-in email link, complete sign-in.
    void this.completeEmailLinkSignIn();
  }

  close (): void {
    if ( !this.dismissible ) return;
    this.closed.emit();
  }

  isValidEmail ( value: string ): boolean {
    const v = ( value || '' ).trim();
    return v.length >= 6 && v.includes( '@' ) && v.includes( '.' ) && !v.includes( ' ' );
  }

  private getBrowserHint (): string {
    const ua = String( navigator.userAgent || '' ).toLowerCase();

    if ( ua.includes( 'edg/' ) ) return 'Microsoft Edge';
    if ( ua.includes( 'opr/' ) || ua.includes( 'opera' ) ) return 'Opera';
    if ( ua.includes( 'firefox/' ) ) return 'Firefox';
    if ( ua.includes( 'chrome/' ) && !ua.includes( 'edg/' ) && !ua.includes( 'opr/' ) ) return 'Chrome';
    if ( ua.includes( 'safari/' ) && !ua.includes( 'chrome/' ) ) return 'Safari';

    return 'this browser';
  }

  async sendLink (): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    const email = ( this.email || '' ).trim();
    if ( !this.isValidEmail( email ) ) {
      this.errorMessage = 'Enter a valid email address.';
      return;
    }

    this.busy = true;
    try {
      const auth = getAuth();

      // Keep the link on the same route so SayIt can resume where it left off.
      // IMPORTANT: this URL must be whitelisted in Firebase Auth settings.
      const actionCodeSettings = {
        url: window.location.href,
        handleCodeInApp: true
      };

      await sendSignInLinkToEmail( auth, email, actionCodeSettings );

      try {
        localStorage.setItem( this.emailStorageKey, email );
      } catch { }

      try {
        localStorage.setItem( this.browserHintStorageKey, this.getBrowserHint() );
      } catch { }

      const browserHint = this.getBrowserHint();
      this.successMessage =
        `Link sent. Open the email on this device in ${browserHint} to finish sign-in. If the link opens in a different browser, sign-in may fail.`;
    } catch ( err: any ) {
      const msg =
        err && ( err.message || err.code )
          ? String( err.message || err.code )
          : 'Unable to send sign-in link.';
      this.errorMessage = msg;
    } finally {
      this.busy = false;
    }
  }

  async signInWithGoogle (): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.busy = true;

    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      // Force account chooser so users can pick the right Google identity.
      provider.setCustomParameters( { prompt: 'select_account' } );

      await signInWithPopup( auth, provider );

      // Clean up any pending email-link state
      try {
        localStorage.removeItem( this.emailStorageKey );
        localStorage.removeItem( this.browserHintStorageKey );
      } catch { }

      this.successMessage = 'Signed in with Google.';
      this.signedIn.emit();
    } catch ( err: any ) {
      const msg =
        err && ( err.message || err.code )
          ? String( err.message || err.code )
          : 'Unable to sign in with Google.';
      this.errorMessage = msg;
    } finally {
      this.busy = false;
    }
  }

  private async completeEmailLinkSignIn (): Promise<void> {
    const auth = getAuth();
    const href = window.location.href;

    if ( !isSignInWithEmailLink( auth, href ) ) return;

    this.busy = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      let email = '';
      try {
        email = localStorage.getItem( this.emailStorageKey ) || '';
      } catch { }

      let browserHint = 'the same browser you used to request the link';
      try {
        browserHint = localStorage.getItem( this.browserHintStorageKey ) || browserHint;
      } catch { }

      // If opened on a different device, localStorage won't have email.
      if ( !email ) {
        email = window.prompt( `Confirm your email to complete sign-in. Use ${browserHint} on this device if possible:` ) || '';
      }

      email = ( email || '' ).trim();
      if ( !this.isValidEmail( email ) ) {
        this.errorMessage = `Email confirmation required to complete sign-in. If the link opened in a different browser, go back to ${browserHint} and open the email there.`;
        return;
      }

      await signInWithEmailLink( auth, email, href );

      try {
        localStorage.removeItem( this.emailStorageKey );
        localStorage.removeItem( this.browserHintStorageKey );
      } catch { }

      this.successMessage = 'Signed in.';
      this.signedIn.emit();

      // Clean up the URL (remove oobCode params etc) without reloading.
      try {
        const cleanUrl =
          window.location.origin +
          window.location.pathname +
          window.location.hash;
        window.history.replaceState( {}, document.title, cleanUrl );
      } catch { }
    } catch ( err: any ) {
      const msg =
        err && ( err.message || err.code )
          ? String( err.message || err.code )
          : 'Unable to complete sign-in.';
      this.errorMessage = `${msg} If the link opened in a different browser than the one used to request it, return to that browser and try again.`;
    } finally {
      this.busy = false;
    }
  }
}