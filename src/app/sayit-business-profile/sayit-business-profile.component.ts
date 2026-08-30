import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { getAuth } from 'firebase/auth';
import { PostDisplayerComponent } from '../components/post-displayer/post-displayer.component';
import { PreloaderComponent } from '../shared/preloader/preloader.component';
import { SayItDataService } from '../services/sayit-data.service';
import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';
import { Post } from '../shared/models/message.model';
import { PostInterestRecord, SayItService } from '../services/say-it-service';


@Component( {
  selector: 'app-sayit-business-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, PostDisplayerComponent, PreloaderComponent],
  templateUrl: './sayit-business-profile.component.html',
  styleUrl: './sayit-business-profile.component.css',
} )
export class SayitBusinessProfileComponent implements OnInit, OnDestroy {
  identifier = '';
  profile: any = null;
  visiblePosts: Post[] = [];
  isLoading = true;
  errorMessage = '';
  currentUid = '';
  currentWatchlistProfileIds: string[] = [];
  watchActionBusy = false;
  relatedProfiles: any[] = [];
  interestRecords: PostInterestRecord[] = [];

  private readonly uidPattern = /^[A-Za-z0-9_-]{20,}$/;

  private looksLikeUid ( value: string ): boolean {
    return this.uidPattern.test( String( value || '' ).trim() );
  }

  private normalizeComparableText ( value: any ): string {
    return String( value || '' )
      .trim()
      .toLowerCase();
  }

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private dataService: SayItDataService,
    private logger: LoggerService,
    private notificationService: NotificationService,
    private sayItService: SayItService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.currentUid = this.getResolvedCurrentUid();
    this.identifier = ( this.route.snapshot.paramMap.get( 'identifier' ) || '' ).trim();
    if ( !this.identifier ) {
      this.errorMessage = 'No SayIt business profile was provided.';
      this.isLoading = false;
      return;
    }

    await this.loadBusinessProfile();
    await this.loadViewerWatchlist();
  }

  ngOnDestroy (): void { }

  get profileTitle (): string {
    return this.primaryDisplayName || 'SayIt Business';
  }

  get primaryDisplayName (): string {
    return (
      this.profile?.businessName ||
      this.profile?.displayName ||
      this.profile?.companyName ||
      this.profile?.handle ||
      ''
    ).toString().trim();
  }

  get businessTagline (): string {
    return (
      this.profile?.tagline ||
      this.profile?.intentHeadline ||
      ''
    ).toString().trim();
  }

  get businessIntent (): string {
    return (
      this.profile?.intentText ||
      this.profile?.sellText ||
      this.profile?.offerSummary ||
      ''
    ).toString().trim();
  }

  get pinnedIntro (): string {
    return (
      this.profile?.pinnedIntro ||
      this.profile?.introText ||
      this.profile?.tagline ||
      this.businessIntent
    ).toString().trim();
  }

  get websiteUrl (): string {
    return (
      this.profile?.websiteUrl ||
      this.profile?.website ||
      this.profile?.url ||
      ''
    ).toString().trim();
  }

  get websiteHref (): string {
    const raw = this.websiteUrl;
    if ( !raw ) return '';
    return /^https?:\/\//i.test( raw ) ? raw : `https://${raw}`;
  }

  get primaryEmail (): string {
    if ( this.isSeededTeaser ) return '';
    return (
      this.profile?.email ||
      this.profile?.businessEmail ||
      this.profile?.contactEmail ||
      ''
    ).toString().trim();
  }

  get primaryPhone (): string {
    if ( this.isSeededTeaser ) return '';
    return (
      this.profile?.phone ||
      this.profile?.businessPhone ||
      this.profile?.contactPhone ||
      ''
    ).toString().trim();
  }

  get aboutBusiness (): string {
    return (
      this.profile?.about ||
      this.profile?.description ||
      this.profile?.companyDescription ||
      this.profile?.businessDescription ||
      this.profile?.summary ||
      this.profile?.pinnedIntro ||
      this.profile?.introText ||
      this.profile?.tagline ||
      this.businessIntent
    ).toString().trim();
  }

  get servicesSummary (): string {
    const rawServices = this.profile?.services || this.profile?.capabilities || this.profile?.specialties || this.profile?.serviceAreas;
    if ( Array.isArray( rawServices ) ) {
      return rawServices
        .map( ( value: any ) => String( value || '' ).trim() )
        .filter( ( value: string ) => !!value )
        .slice( 0, 8 )
        .join( ', ' );
    }

    return String( rawServices || this.profile?.offerSummary || this.profile?.sellText || '' ).trim();
  }

  get locationLabel (): string {
    return (
      this.profile?.location ||
      this.profile?.cityState ||
      this.profile?.city ||
      this.profile?.state ||
      this.profile?.serviceArea ||
      ''
    ).toString().trim();
  }

  get categoryLabel (): string {
    return (
      this.profile?.businessCategory ||
      this.profile?.industry ||
      this.profile?.category ||
      this.profile?.businessType ||
      ''
    ).toString().trim();
  }

  get memberSinceLabel (): string {
    const raw = this.profile?.createdAt;
    if ( !raw ) return '';

    try {
      const date = raw?.toDate ? raw.toDate() : new Date( raw );
      if ( Number.isNaN( date.getTime() ) ) return '';
      return date.toLocaleDateString( undefined, { month: 'short', year: 'numeric' } );
    } catch {
      return '';
    }
  }

  get completenessPercent (): number {
    const checks = [
      this.profile?.displayName,
      this.profile?.businessName,
      this.profile?.businessCategory || this.profile?.industry,
      this.locationLabel,
      this.websiteUrl,
      this.businessIntent,
      this.profile?.tagline,
      this.aboutBusiness,
      this.primaryEmail,
      this.primaryPhone,
      this.servicesSummary,
    ];

    const completed = checks.filter( value => String( value || '' ).trim().length > 0 ).length;
    return Math.round( ( completed / checks.length ) * 100 );
  }

  get watchCount (): number {
    return Number( this.profile?.watcherCount || 0 );
  }

  get activityLabel (): string {
    const ageDays = this.getAgeInDays( this.profile?.lastUpdated || this.profile?.createdAt );

    if ( ageDays <= 2 ) return 'Active recently';
    if ( ageDays <= 7 ) return 'Active this week';
    if ( ageDays <= 30 ) return 'Active this month';
    return 'Quiet recently';
  }

  get trustLabel (): string {
    if ( this.isSeededTeaser ) return 'Claimable teaser';

    if ( this.completenessPercent >= 85 && this.hasListedWebsite && this.watchCount >= 3 && this.isDomainAligned ) {
      return 'Verified-looking';
    }

    if ( this.completenessPercent >= 85 && this.hasListedWebsite && this.watchCount >= 3 ) {
      return 'Strong signal';
    }

    if ( this.completenessPercent >= 70 && this.hasListedWebsite ) {
      return 'Credible profile';
    }

    if ( this.completenessPercent >= 50 ) {
      return 'Growing profile';
    }

    return 'Needs more detail';
  }

  get hasListedWebsite (): boolean {
    const raw = this.websiteUrl;
    if ( !raw ) return false;

    const normalized = /^https?:\/\//i.test( raw ) ? raw : `https://${raw}`;
    try {
      const url = new URL( normalized );
      return !!url.hostname && url.hostname.includes( '.' ) && !url.hostname.includes( ' ' );
    } catch {
      return false;
    }
  }

  get isSeededTeaser (): boolean {
    return String( this.profile?.profileSource || '' ).trim() === 'lead_vault_seed'
      && String( this.profile?.directoryVisibility || '' ).trim().toLowerCase() === 'public_teaser';
  }

  get directoryStatusLabel (): string {
    if ( !this.isSeededTeaser ) return 'Active SayIt Member';

    const seedStatus = String( this.profile?.seedStatus || '' ).trim().toLowerCase();
    if ( seedStatus === 'invited' ) return 'Invited to join';
    return 'Claim this profile';
  }

  get directoryStatusCopy (): string {
    return this.isSeededTeaser
      ? 'This is a seeded directory preview built from trusted business data. Claiming the profile unlocks the full SayIt presence.'
      : 'This organization has an active SayIt profile.';
  }

  get isDomainAligned (): boolean {
    const email = String( this.profile?.email || '' ).trim().toLowerCase();
    if ( !email || !email.includes( '@' ) || !this.hasListedWebsite ) return false;

    const emailDomain = email.split( '@' )[1];
    const normalized = /^https?:\/\//i.test( this.websiteUrl ) ? this.websiteUrl : `https://${this.websiteUrl}`;
    try {
      const hostname = new URL( normalized ).hostname.toLowerCase().replace( /^www\./, '' );
      return hostname === emailDomain || hostname.endsWith( `.${emailDomain}` ) || emailDomain.endsWith( `.${hostname}` );
    } catch {
      return false;
    }
  }

  get canWatchProfile (): boolean {
    const targetId = String( this.profile?.id || this.profile?.uid || '' ).trim();
    return !!this.currentUid && !!targetId && this.currentUid !== targetId;
  }

  get isWatchingProfile (): boolean {
    const targetId = String( this.profile?.id || this.profile?.uid || '' ).trim();
    return !!targetId && this.currentWatchlistProfileIds.includes( targetId );
  }

  async toggleWatchProfile (): Promise<void> {
    const targetId = String( this.profile?.id || this.profile?.uid || '' ).trim();
    if ( !this.currentUid ) {
      this.notificationService.show( 'Login Required', 'Please sign in to add this business to your watchlist.', 'warning' );
      return;
    }

    if ( !targetId || this.currentUid === targetId || this.watchActionBusy ) return;

    const previousWatchlistIds = [...this.currentWatchlistProfileIds];
    const wasWatching = previousWatchlistIds.includes( targetId );
    const nextWatchlistIds = wasWatching
      ? previousWatchlistIds.filter( id => id !== targetId )
      : [...previousWatchlistIds, targetId];
    const previousWatcherCount = Number( this.profile?.watcherCount || 0 );
    const nextWatcherCount = Math.max( 0, previousWatcherCount + ( wasWatching ? -1 : 1 ) );

    this.watchActionBusy = true;
    this.applyOptimisticWatchState( nextWatchlistIds, nextWatcherCount );
    try {
      const result = await this.dataService.toggleSayItBusinessWatch( this.currentUid, targetId, this.currentUid );
      this.applyOptimisticWatchState( result.watchlistProfileIds, result.watcherCount );

      this.notificationService.show(
        result.watching ? 'Watching' : 'Removed',
        result.watching ? 'This business is now on your SayIt watchlist.' : 'This business was removed from your SayIt watchlist.',
        'success'
      );
    } catch ( e ) {
      this.logger.error( 'toggleWatchProfile error', e );
      this.applyOptimisticWatchState( previousWatchlistIds, previousWatcherCount );
      this.notificationService.show( 'Could not save', 'Could not save. Try again.', 'error' );
    } finally {
      this.watchActionBusy = false;
    }
  }

  private applyOptimisticWatchState ( watchlistProfileIds: string[], watcherCount: number ): void {
    this.currentWatchlistProfileIds = [...watchlistProfileIds];
    this.profile = {
      ...this.profile,
      watcherCount,
    };
  }

  private async loadBusinessProfile (): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.visiblePosts = [];
    this.relatedProfiles = [];

    try {
      const identifier = String( this.identifier || '' ).trim();
      const normalizedIdentifier = this.normalizeComparableText( identifier );
      let resolvedProfile: any = null;

      try {
        if ( this.looksLikeUid( identifier ) ) {
          resolvedProfile = await this.dataService.getSayItProfileByUidOnce(
            identifier,
            'Public SayIt Business Profile'
          );
        }
      } catch ( e ) {
        this.logger.warn( 'getSayItProfileByUidOnce failed', e );
      }

      if ( !resolvedProfile ) {
        try {
          const allProfiles =
            typeof ( this.dataService as any )?.getPublicSayItProfilesOnce === 'function'
              ? await ( this.dataService as any ).getPublicSayItProfilesOnce(
                'Public SayIt Business Profile Lookup',
                { limit: 200 }
              )
              : [];

          const publicProfiles = Array.isArray( allProfiles ) ? allProfiles : [];

          const exactUidMatch = publicProfiles.find(
            profile =>
              this.normalizeComparableText( profile?.uid || profile?.id ) === normalizedIdentifier
          );

          const exactHandleMatch = publicProfiles.find(
            profile =>
              this.normalizeComparableText( profile?.handle ) === normalizedIdentifier
          );

          const exactDisplayNameMatches = publicProfiles.filter(
            profile =>
              this.normalizeComparableText( profile?.displayName ) === normalizedIdentifier
          );

          resolvedProfile = exactUidMatch || exactHandleMatch || null;

          if ( !resolvedProfile && exactDisplayNameMatches.length === 1 ) {
            resolvedProfile = exactDisplayNameMatches[0];
          }

          if ( !resolvedProfile && exactDisplayNameMatches.length > 1 ) {
            this.errorMessage =
              'More than one public SayIt business profile matches that name. Open the profile from the post again or use a direct link.';
            return;
          }
        } catch ( e ) {
          this.logger.warn( 'Public SayIt profile fallback lookup failed', e );
        }
      }

      if ( !resolvedProfile ) {
        this.errorMessage = 'This SayIt business profile could not be found.';
        return;
      }

      this.profile = resolvedProfile;

      const canonicalIdentifier = String(
        resolvedProfile?.handle || resolvedProfile?.uid || resolvedProfile?.id || ''
      ).trim();

      if ( canonicalIdentifier && canonicalIdentifier !== identifier ) {
        void this.router.navigate( ['/business', canonicalIdentifier], {
          replaceUrl: true,
        } );
      }

      const profileUid = String( resolvedProfile?.uid || resolvedProfile?.id || '' ).trim();

      // Interest activity is private to the profile owner. Public visitors still see
      // the public posts and can use comments to continue the conversation.
      if ( this.currentUid && this.currentUid === profileUid ) {
        try {
          this.interestRecords = await this.sayItService.getInterestsForAuthor( profileUid, 100 );
          const unread = this.interestRecords.filter( interest => interest.viewed !== true && interest.id );
          if ( unread.length ) {
            await Promise.allSettled( unread.map( interest => this.sayItService.markInterestViewed( interest.id ) ) );
            this.interestRecords = this.interestRecords.map( interest => unread.some( item => item.id === interest.id )
              ? { ...interest, viewed: true }
              : interest );
          }
        } catch ( e ) {
          this.logger.warn( 'load profile interest activity failed', e );
          this.interestRecords = [];
        }
      }

      const postCriteriaCandidates = [
        resolvedProfile?.handle
          ? { authorHandle: String( resolvedProfile.handle ).trim().toLowerCase() }
          : null,
        profileUid ? { authorUid: profileUid } : null,
        profileUid ? { userId: profileUid } : null,
      ].filter( Boolean ) as any[];

      for ( const criteria of postCriteriaCandidates ) {
        try {
          const posts = ( await this.dataService.getProfilePostsFirstPage( criteria, 12 ) ) as Post[];
          if ( Array.isArray( posts ) ) {
            this.visiblePosts = posts;
            if ( posts.length ) {
              break;
            }
          }
        } catch ( e ) {
          this.logger.warn( 'getProfilePostsFirstPage failed for criteria', criteria, e );
        }
      }

      try {
        await this.loadRelatedProfiles();
      } catch ( e ) {
        this.logger.warn( 'loadRelatedProfiles failed', e );
        this.relatedProfiles = [];
      }
    } catch ( e ) {
      this.logger.error( 'loadBusinessProfile error', e );
      this.errorMessage = 'Unable to load this SayIt business profile right now.';
      this.profile = null;
      this.visiblePosts = [];
      this.relatedProfiles = [];
    } finally {
      this.isLoading = false;
    }
  }

  get isProfileOwner (): boolean {
    const profileUid = String( this.profile?.uid || this.profile?.id || '' ).trim();
    return !!profileUid && !!this.currentUid && profileUid === this.currentUid;
  }

  get interestedPosts (): PostInterestRecord[] {
    const seen = new Set<string>();
    return this.interestRecords.filter( record => {
      const postId = String( record?.postId || '' ).trim();
      if ( !postId || seen.has( postId ) ) return false;
      seen.add( postId );
      return true;
    } );
  }

  private async loadViewerWatchlist (): Promise<void> {
    if ( !this.currentUid ) return;

    try {
      const viewerProfile = await this.dataService.getSayItProfileByUidOnce( this.currentUid, 'SayIt Business Profile Viewer' );
      this.currentWatchlistProfileIds = Array.isArray( viewerProfile?.watchlistProfileIds )
        ? viewerProfile.watchlistProfileIds
          .map( ( id: any ) => String( id || '' ).trim() )
          .filter( ( id: string ) => !!id )
        : [];
    } catch ( e ) {
      this.logger.warn( 'loadViewerWatchlist failed', e );
      this.currentWatchlistProfileIds = [];
    }
  }

  private async loadRelatedProfiles (): Promise<void> {
    if ( !this.profile ) {
      this.relatedProfiles = [];
      return;
    }

    try {
      const allProfiles = await this.dataService.getPublicSayItProfilesOnce( 'SayIt Related Profiles', { limit: 60 } );
      const currentId = String( this.profile?.id || this.profile?.uid || '' ).trim();
      const currentCategory = this.categoryLabel.toLowerCase();
      const currentLocation = this.locationLabel.toLowerCase();

      this.relatedProfiles = allProfiles
        .filter( ( profile: any ) => String( profile?.id || profile?.uid || '' ).trim() !== currentId )
        .sort( ( a: any, b: any ) => this.getRelatedScore( b, currentCategory, currentLocation ) - this.getRelatedScore( a, currentCategory, currentLocation ) )
        .slice( 0, 4 );
    } catch ( e ) {
      this.logger.warn( 'loadRelatedProfiles failed', e );
      this.relatedProfiles = [];
    }
  }

  private getRelatedScore ( profile: any, currentCategory: string, currentLocation: string ): number {
    const category = String( profile?.businessCategory || profile?.industry || '' ).toLowerCase();
    const location = String( profile?.location || '' ).toLowerCase();
    let score = Number( profile?.watcherCount || 0 ) * 10;

    if ( currentCategory && category && category === currentCategory ) score += 1000;
    if ( currentLocation && location && location === currentLocation ) score += 500;
    if ( String( profile?.pinnedIntro || profile?.description || profile?.tagline || profile?.intentText || '' ).trim() ) score += 50;

    return score;
  }

  private getAgeInDays ( raw: any ): number {
    try {
      const date = raw?.toDate ? raw.toDate() : new Date( raw );
      const millis = date?.getTime?.() ?? 0;
      if ( !Number.isFinite( millis ) || !millis ) return Number.POSITIVE_INFINITY;
      return Math.max( 0, Math.floor( ( Date.now() - millis ) / 86400000 ) );
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  private getResolvedCurrentUid (): string {
    const directUid = ( getAuth().currentUser?.uid || '' ).trim();
    if ( directUid ) return directUid;

    try {
      const raw = window.localStorage.getItem( '__cypressAuthOverride' );
      if ( !raw ) return '';

      const parsed = JSON.parse( raw );
      return String( parsed?.uid || '' ).trim();
    } catch {
      return '';
    }
  }

}
