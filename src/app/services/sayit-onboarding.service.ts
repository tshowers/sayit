import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import { SayItDataService } from './sayit-data.service';
import { SayItService } from './say-it-service';

export type SayItIntent = 'looking' | 'offering';

export interface SayItOnboardingDraft {
  intent: SayItIntent;
  /** A chip from TOPIC_OPTIONS[intent], or free text typed under "Other". */
  topic: string;
  category: string;
  postText: string;
  /** Once the visitor edits the post text we stop rewriting it from their answers. */
  postTextEdited: boolean;
  firstName: string;
  lastName: string;
  businessName: string;
  /** Set on reaching the sign-in step - an abandoned draft is never submitted. */
  readyToSubmit: boolean;
  /** Set after each post-sign-in step succeeds, so a retry never repeats it. */
  profileSaved?: boolean;
  publishedPostId?: string;
}

export const INTENT_OPTIONS: { value: SayItIntent; label: string; }[] = [
  { value: 'looking', label: "I'm looking for something" },
  { value: 'offering', label: "I'm offering something" },
];

export const TOPIC_OPTIONS: Record<SayItIntent, string[]> = {
  looking: ['A supplier', 'A contractor', 'A service provider', 'Referrals', 'A business partner'],
  offering: ['My services', 'My products', 'Help with projects', 'A partnership', 'Referrals'],
};

/** The same categories the composer and AI moderation use. */
export const CATEGORY_OPTIONS = [
  'all', 'construction', 'trucking-logistics', 'manufacturing', 'retail', 'ecommerce',
  'real-estate', 'food-beverage', 'hospitality', 'professional-services', 'marketing',
  'technology', 'healthcare', 'finance', 'education', 'automotive', 'energy',
  'government-contracting', 'nonprofit', 'agriculture',
];

export const POST_MAX_LENGTH = 155;

export function categoryLabel ( category: string ): string {
  const value = ( category || '' ).trim().toLowerCase();
  if ( !value || value === 'all' ) return 'Any industry';
  return value.split( '-' ).map( ( part ) => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) ).join( ' ' );
}

/**
 * Holds the /get-started wizard's answers - a first post plus who's posting
 * it - and turns them into real records once the visitor has signed in:
 * the TODD profile (blank fields only), the SayIt profile (only if it isn't
 * already complete), then the post itself. Same "build first, sign in last"
 * model as Network/Pulse/Moves (ONBOARDING-PROFILE-BILLING-PLAYBOOK.md).
 *
 * The draft lives in localStorage because signing in leaves for
 * todd.taliferro.tech/login and has to survive the round trip.
 */
@Injectable( { providedIn: 'root' } )
export class SayItOnboardingService {
  private readonly storageKey = 'sayit_onboarding_draft';

  constructor (
    private readonly http: HttpClient,
    private readonly sayItService: SayItService,
    private readonly dataService: SayItDataService,
    private readonly logger: LoggerService,
  ) { }

  emptyDraft (): SayItOnboardingDraft {
    const draft: SayItOnboardingDraft = {
      intent: 'looking',
      topic: TOPIC_OPTIONS.looking[0],
      category: 'all',
      postText: '',
      postTextEdited: false,
      firstName: '',
      lastName: '',
      businessName: '',
      readyToSubmit: false,
    };
    draft.postText = this.suggestedPost( draft );
    return draft;
  }

  load (): SayItOnboardingDraft {
    const empty = this.emptyDraft();
    try {
      const raw = localStorage.getItem( this.storageKey );
      return raw ? { ...empty, ...JSON.parse( raw ) } : empty;
    } catch {
      return empty;
    }
  }

  save ( draft: SayItOnboardingDraft ): void {
    try {
      localStorage.setItem( this.storageKey, JSON.stringify( draft ) );
    } catch { }
  }

  clear (): void {
    try {
      localStorage.removeItem( this.storageKey );
    } catch { }
  }

  hasPendingDraft (): boolean {
    return this.load().readyToSubmit;
  }

  /** "Looking for a supplier in retail. Any recommendations?" */
  suggestedPost ( draft: Pick<SayItOnboardingDraft, 'intent' | 'topic' | 'category'> ): string {
    const topic = ( draft.topic || '' ).trim() || ( draft.intent === 'looking' ? 'help' : 'my services' );
    const what = topic.charAt( 0 ).toLowerCase() + topic.slice( 1 );
    const industry = draft.category && draft.category !== 'all' ? ` in ${categoryLabel( draft.category ).toLowerCase()}` : '';
    const text = draft.intent === 'looking'
      ? `Looking for ${what}${industry}. Any recommendations?`
      : `Offering ${what}${industry}. Happy to help - reach out!`;
    return text.slice( 0, POST_MAX_LENGTH );
  }

  /** "Ada at Analytical Co", else "Ada Lovelace" - the style the feed already uses. */
  displayName ( draft: SayItOnboardingDraft ): string {
    const first = draft.firstName.trim();
    const business = draft.businessName.trim();
    if ( first && business ) return `${first} at ${business}`;
    return [first, draft.lastName.trim()].filter( Boolean ).join( ' ' ) || 'User';
  }

  /**
   * Called right after sign-in (AuthCallbackComponent) and whenever the
   * board loads signed in, so a failed step retries. Never throws; returns
   * the id of the post it published, if any, so the caller can open it.
   */
  async submitIfPending (): Promise<{ postId?: string; }> {
    const draft = this.load();
    const user = this.currentUser();
    if ( !draft.readyToSubmit || !user ) return {};

    try {
      if ( !draft.profileSaved ) {
        await this.saveProfiles( draft, user );
        draft.profileSaved = true;
        this.save( draft );
      }

      if ( !draft.publishedPostId ) {
        const content = draft.postText.trim().slice( 0, POST_MAX_LENGTH );
        if ( content ) {
          const profile = await this.dataService.getSayItProfileByUidOnce( user.uid, 'SayIt onboarding' );
          const result = await this.sayItService.publishPost( {
            authorUid: user.uid,
            authorEmail: user.email || '',
            content,
            category: draft.category || 'all',
            displayName: String( profile?.displayName || '' ).trim() || this.displayName( draft ),
            photoURL: profile?.photoURL || user.photoURL || null,
            authorHandle: profile?.handle || undefined,
            moderate: true,
          } );
          draft.publishedPostId = result.id;
          this.save( draft );
        }
      }

      const postId = draft.publishedPostId;
      this.clear();
      return { postId };
    } catch ( error ) {
      this.logger.warn( '[SayItOnboarding] submit failed; will retry on next load', error );
      return {};
    }
  }

  /**
   * TODD profile via /onboarding/profile (fills blank fields only), then the
   * SayIt profile via /sayit/profile/complete - but only when the SayIt
   * profile isn't already complete, so a returning member's profile is
   * never overwritten.
   */
  private async saveProfiles ( draft: SayItOnboardingDraft, user: { uid: string; email: string | null; getIdToken (): Promise<string>; } ): Promise<void> {
    const headers = { Authorization: `Bearer ${await user.getIdToken()}` };

    try {
      await firstValueFrom( this.http.post( `${environment.backendURL}/onboarding/profile`, {
        source: 'sayit-web',
        profile: {
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          companyName: draft.businessName.trim(),
        },
      }, { headers } ) );
    } catch ( error ) {
      // The TODD profile is shared and TODD's own wizard fills gaps later;
      // it must not hold up the SayIt profile or the post.
      this.logger.warn( '[SayItOnboarding] TODD profile save failed', error );
    }

    const existing = await this.dataService.getSayItProfileByUidOnce( user.uid, 'SayIt onboarding' );
    if ( this.isCompleteSayItProfile( existing ) ) {
      this.logger.info( '[SayItOnboarding] SayIt profile already complete; leaving it as is', { uid: user.uid, keys: Object.keys( existing || {} ) } );
      return;
    }

    const intentText = draft.postText.trim();
    await firstValueFrom( this.http.post( `${environment.backendURL}/sayit/profile/complete`, {
      uid: user.uid,
      email: ( user.email || '' ).toLowerCase(),
      displayName: this.displayName( draft ),
      intentText,
      sellText: intentText,
      businessName: draft.businessName.trim() || String( existing?.businessName || '' ),
      businessCategory: String( existing?.businessCategory || ( draft.category !== 'all' ? categoryLabel( draft.category ) : '' ) ),
      websiteUrl: String( existing?.websiteUrl || '' ),
      location: String( existing?.location || '' ),
      tagline: String( existing?.tagline || '' ),
      pinnedIntro: String( existing?.pinnedIntro || '' ),
      publicProfile: true,
      profileIntentCompleted: true,
    }, { headers } ) );
  }

  /** Separate so tests can supply a signed-in user. */
  protected currentUser () {
    return getAuth().currentUser;
  }

  /** Same completeness rule the board used for its profile prompt. */
  isCompleteSayItProfile ( profile: any ): boolean {
    if ( !profile ) return false;
    if ( profile.profileIntentCompleted || profile.onboardingCompleted ) return true;
    const hasName = !!String( profile.displayName || profile.name || '' ).trim();
    const hasIntent = !!String( profile.intentText || profile.intent || profile.sellText || profile.sell || '' ).trim();
    return hasName && hasIntent;
  }
}
