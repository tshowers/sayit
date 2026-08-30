import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { firstValueFrom, Subscription, take } from 'rxjs';
import { SayItDataService } from '../../services/sayit-data.service';
import { LoggerService } from '../../services/logger.service';
import {
  SayItProfileApiService,
  SayItIntentProfile,
  SayItProfileRecommendations
} from '../../services/sayit-profile-api.service';
import { Router } from '@angular/router';

@Component( {
  selector: 'app-profile-intent-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-intent-card.component.html',
  styleUrl: './profile-intent-card.component.css'
} )
export class ProfileIntentCardComponent implements OnInit, OnDestroy {
  @Input() forced = false;
  @Input() presentation: 'modal' | 'page' = 'modal';
  @Output() completed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  busy = false;
  errorMessage = '';
  saveSuccessMessage = '';

  websiteUrl = '';
  sellText = '';
  displayName = '';
  businessName = '';
  businessCategory = '';
  location = '';
  tagline = '';
  pinnedIntro = '';
  intentProfile: SayItIntentProfile | null = null;
  recommendations: SayItProfileRecommendations | null = null;

  prefillSubscription!: Subscription;

  constructor (
    private dataService: SayItDataService,
    private logger: LoggerService,
    private sayItProfileApi: SayItProfileApiService,
    private router: Router,
  ) { }

  ngOnInit (): void {
    this.prefillFromToddContact();
    this.prefillDisplayNameFromAuth();
    this.prefillFromSeededProfileByEmail();
    this.prefillFromSayItProfile();
  }

  ngOnDestroy () {
    if ( this.prefillSubscription ) this.prefillSubscription.unsubscribe();
  }

  close (): void {
    // If this modal is being used as a forced onboarding gate, do not allow dismissal.
    if ( this.forced ) return;
    this.closed.emit();
  }

  canSave (): boolean {
    const intent = ( this.sellText || '' ).trim();
    const displayName = ( this.displayName || '' ).trim();
    const website = ( this.websiteUrl || '' ).trim();

    if ( displayName.length < 2 ) return false;
    if ( intent.length < 6 ) return false;

    if ( !website ) return true;

    return this.isLikelyValidWebsite( website );
  }

  isQuickSignupMode (): boolean {
    return this.forced;
  }

  isPageMode (): boolean {
    return this.presentation === 'page';
  }

  getSaveButtonLabel (): string {
    return this.isPageMode() ? 'Save Profile' : 'Continue';
  }

  async save (): Promise<void> {
    this.errorMessage = '';
    this.saveSuccessMessage = '';

    if ( !( this.displayName || '' ).trim() ) {
      this.errorMessage = 'Please enter a display name.';
      return;
    }

    if ( ( this.displayName || '' ).trim().length < 2 ) {
      this.errorMessage = 'Display name must be at least 2 characters.';
      return;
    }

    if ( !( this.sellText || '' ).trim() ) {
      this.errorMessage = 'Please tell people what you do or need.';
      return;
    }

    if ( ( this.sellText || '' ).trim().length < 6 ) {
      this.errorMessage = 'Add a little more detail so people understand what you are trying to do.';
      return;
    }

    if ( ( this.websiteUrl || '' ).trim() && !this.isLikelyValidWebsite( this.websiteUrl ) ) {
      this.errorMessage = 'Enter a valid business website like taliferro.com or https://taliferro.com, or leave it blank.';
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if ( !user ) {
      this.errorMessage = 'You must be signed in.';
      return;
    }

    this.busy = true;
    try {
      const email = ( user.email || '' ).trim().toLowerCase();
      const displayName =
        ( this.displayName || '' ).trim() ||
        ( user.displayName && user.displayName.trim() ) ||
        ( email.includes( '@' ) ? email.split( '@' )[0] : 'User' );

      const intentText = ( this.sellText || '' ).trim();
      const rawWebsiteUrl = ( this.websiteUrl || '' ).trim();
      const websiteUrl = rawWebsiteUrl
        ? ( /^https?:\/\//i.test( rawWebsiteUrl ) ? rawWebsiteUrl : `https://${rawWebsiteUrl}` )
        : '';

      const payload: any = {
        uid: user.uid,
        websiteUrl,
        sellText: intentText,
        intentText,
        email,
        displayName,
        businessName: ( this.businessName || '' ).trim(),
        businessCategory: ( this.businessCategory || '' ).trim(),
        location: ( this.location || '' ).trim(),
        tagline: ( this.tagline || '' ).trim(),
        pinnedIntro: ( this.pinnedIntro || '' ).trim(),
        publicProfile: true,
        profileIntentCompleted: true,
      };

      const response = await firstValueFrom( this.sayItProfileApi.completeProfile( payload ) );
      this.intentProfile = response?.intentProfile || null;
      this.recommendations = response?.recommendations || null;
      this.saveSuccessMessage = response?.recommendations?.summary || 'Your SayIt profile has been updated.';
      this.logger.info( '[SayIt] profile saved (backend)', {
        uid: user.uid,
        email,
        role: this.intentProfile?.role,
        domain: this.intentProfile?.domain,
        confidence: this.intentProfile?.confidence,
        recommendationType: this.recommendations?.recommendationType
      } );
      this.completed.emit();
    } catch ( e: any ) {
      const msg = e && ( e.message || e.code ) ? String( e.message || e.code ) : 'Unable to save profile.';
      this.errorMessage = msg;
    } finally {
      this.busy = false;
    }
  }

  hasLeadVaultRecommendations (): boolean {
    return !!this.recommendations?.leadVaultSegments?.length;
  }

  hasProviderRecommendations (): boolean {
    return !!this.recommendations?.providerSuggestions?.length;
  }

  viewLeadVaultMatches (): void {
    const query =
      this.recommendations?.leadVaultSegments?.[0]?.leadVaultQuery ||
      this.recommendations?.leadVaultSegments?.[0]?.query ||
      '';

    this.router.navigate( ['/lead-vault'], {
      queryParams: query ? { query } : {}
    } );
  }

  openLeadVaultSegment ( query: string ): void {
    const normalizedQuery = ( query || '' ).trim();
    if ( !normalizedQuery ) return;

    this.router.navigate( ['/lead-vault'], {
      queryParams: { query: normalizedQuery }
    } );
  }

  getLeadVaultSegmentQuery ( segment: { leadVaultQuery?: string; query?: string; } | null | undefined ): string {
    return String( segment?.leadVaultQuery || segment?.query || '' ).trim();
  }

  formatIntentValue ( value: string ): string {
    const raw = ( value || '' ).trim();
    if ( !raw ) return '';

    return raw
      .split( '_' )
      .map( part => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
      .join( ' ' );
  }

  private prefillDisplayNameFromAuth (): void {
    try {
      if ( ( this.displayName || '' ).trim() ) return;

      const auth = getAuth();
      const user = auth.currentUser;
      if ( !user ) return;

      const fromAuth = ( user.displayName || '' ).trim();
      if ( fromAuth ) {
        this.displayName = fromAuth;
        return;
      }

      const email = ( user.email || '' ).trim().toLowerCase();
      if ( email && email.includes( '@' ) ) {
        this.displayName = email.split( '@' )[0];
      }
    } catch {
      // never block onboarding
    }
  }

  private prefillFromToddContact (): void {
    try {
      const auth = getAuth();
      const email = ( auth.currentUser?.email || '' ).trim().toLowerCase();
      if ( !email ) return;

      // Look up an existing TODD Contact by email (master tenant).
      // If found, prefill what we can.
      this.prefillSubscription = this.dataService
        .getContactByEmailForSayIt( email, email )
        .pipe( take( 1 ) )
        .subscribe( ( c: any ) => {
          if ( !c ) return;

          // Website
          const website =
            ( c.company && ( c.company.website || c.company.url || c.company.webSite ) ) ||
            c.website ||
            c.webSite ||
            '';

          // Intent / what the person is trying to do – best-effort mapping
          const sell =
            c.profession ||
            c.title ||
            c.category ||
            ( c.company && ( c.company.description || c.company.summary ) ) ||
            '';

          // Display name best-effort
          const dn =
            c.displayName ||
            c.handle ||
            ( c.firstName || c.lastName
              ? `${c.firstName || ''} ${c.lastName || ''}`.trim()
              : '' );
          const businessName =
            ( c.company && ( c.company.name || c.company.legalName ) ) ||
            c.companyName ||
            '';
          const category = c.category || c.profession || '';
          const location =
            ( c.addresses && c.addresses[0] && ( c.addresses[0].city || c.addresses[0].state ) )
              ? `${c.addresses[0].city || ''}${c.addresses[0].city && c.addresses[0].state ? ', ' : ''}${c.addresses[0].state || ''}`.trim()
              : '';

          // Only fill blanks (don’t overwrite user edits)
          if ( !this.websiteUrl && website ) this.websiteUrl = String( website );
          if ( !this.sellText && sell ) this.sellText = String( sell );
          if ( !( this.displayName || '' ).trim() && dn ) this.displayName = String( dn );
          if ( !( this.businessName || '' ).trim() && businessName ) this.businessName = String( businessName );
          if ( !( this.businessCategory || '' ).trim() && category ) this.businessCategory = String( category );
          if ( !( this.location || '' ).trim() && location ) this.location = String( location );
        } );
    } catch ( e ) {
      // silent; prefill should never break onboarding
      this.logger.warn( 'prefillFromToddContact failed', e );
    }
  }

  private async prefillFromSeededProfileByEmail (): Promise<void> {
    try {
      const auth = getAuth();
      const email = ( auth.currentUser?.email || '' ).trim().toLowerCase();
      if ( !email ) return;

      const p = await this.dataService.getSayItProfileByClaimEmailOnce( email, email );
      if ( !p || String( p?.profileSource || '' ).trim() !== 'lead_vault_seed' ) {
        return;
      }

      const websiteUrl = ( p.websiteUrl || p.website || p.url || '' ).toString().trim();
      const intentText = ( p.intentText || p.sellText || p.description || p.pinnedIntro || p.tagline || '' ).toString().trim();
      const displayName = ( p.displayName || '' ).toString().trim();
      const businessName = ( p.businessName || p.companyName || '' ).toString().trim();
      const businessCategory = ( p.businessCategory || p.industry || p.category || p.sector || '' ).toString().trim();
      const location = ( p.location || p.cityState || '' ).toString().trim();
      const tagline = ( p.tagline || '' ).toString().trim();
      const pinnedIntro = ( p.pinnedIntro || p.description || '' ).toString().trim();

      if ( !this.websiteUrl && websiteUrl ) this.websiteUrl = websiteUrl;
      if ( !this.sellText && intentText ) this.sellText = intentText;
      if ( !( this.displayName || '' ).trim() && displayName ) this.displayName = displayName;
      if ( !( this.businessName || '' ).trim() && businessName ) this.businessName = businessName;
      if ( !( this.businessCategory || '' ).trim() && businessCategory ) this.businessCategory = businessCategory;
      if ( !( this.location || '' ).trim() && location ) this.location = location;
      if ( !( this.tagline || '' ).trim() && tagline ) this.tagline = tagline;
      if ( !( this.pinnedIntro || '' ).trim() && pinnedIntro ) this.pinnedIntro = pinnedIntro;
    } catch ( e ) {
      this.logger.warn( 'prefillFromSeededProfileByEmail failed', e );
    }
  }

  /**
   * If a SayIt profile already exists for this uid, prefill the form.
   * This is the authoritative source for the Quick Profile modal.
   */
  private async prefillFromSayItProfile (): Promise<void> {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      const uid = user?.uid || '';
      if ( !uid ) return;

      const masterTenantId = environment.taliferroTenantId;
      const db = getFirestore();
      const ref = doc( db, `tenants/${masterTenantId}/say-it-profiles/${uid}` );

      this.logger.info( '[SayIt] prefillFromSayItProfile read:', ref.path );
      const snap = await getDoc( ref );

      if ( !snap.exists() ) {
        this.logger.info( `[SayIt] prefillFromSayItProfile: no doc for uid=${uid}` );
        return;
      }

      const p: any = snap.data() || {};
      const websiteUrl = ( p.websiteUrl || p.website || p.url || '' ).toString().trim();
      const intentText = ( p.intentText || p.sellText || p.sell || '' ).toString().trim();
      const displayName = ( p.displayName || '' ).toString().trim();
      const businessName = ( p.businessName || p.companyName || '' ).toString().trim();
      const businessCategory = ( p.businessCategory || p.industry || p.category || '' ).toString().trim();
      const location = ( p.location || p.cityState || '' ).toString().trim();
      const tagline = ( p.tagline || p.intentHeadline || '' ).toString().trim();
      const pinnedIntro = ( p.pinnedIntro || p.introText || '' ).toString().trim();

      if ( !this.websiteUrl && websiteUrl ) this.websiteUrl = websiteUrl;
      if ( !this.sellText && intentText ) this.sellText = intentText;
      if ( !( this.displayName || '' ).trim() && displayName ) this.displayName = displayName;
      if ( !( this.businessName || '' ).trim() && businessName ) this.businessName = businessName;
      if ( !( this.businessCategory || '' ).trim() && businessCategory ) this.businessCategory = businessCategory;
      if ( !( this.location || '' ).trim() && location ) this.location = location;
      if ( !( this.tagline || '' ).trim() && tagline ) this.tagline = tagline;
      if ( !( this.pinnedIntro || '' ).trim() && pinnedIntro ) this.pinnedIntro = pinnedIntro;

      this.logger.info( '[SayIt] prefillFromSayItProfile applied:', {
        uid,
        hasWebsite: !!websiteUrl,
        hasIntent: !!intentText,
        hasDisplayName: !!displayName,
        hasBusinessName: !!businessName,
        hasCategory: !!businessCategory
      } );
    } catch ( e ) {
      this.logger.warn( 'prefillFromSayItProfile failed', e );
    }
  }

  private isLikelyValidWebsite ( value: string ): boolean {
    const normalized = ( value || '' ).trim();
    if ( !normalized ) return true;

    if ( /^n\/?a$/i.test( normalized ) || /^none$/i.test( normalized ) ) {
      return false;
    }

    const withProtocol = /^https?:\/\//i.test( normalized ) ? normalized : `https://${normalized}`;

    try {
      const url = new URL( withProtocol );
      return !!url.hostname && url.hostname.includes( '.' ) && !url.hostname.includes( ' ' );
    } catch {
      return false;
    }
  }
}
