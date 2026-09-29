import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { format, formatDistanceToNow } from 'date-fns';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable
} from 'firebase/storage';

import {
  Observable,
  Subscription, from, of, switchMap
} from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthContextService } from '../services/auth-context.service';
import { LinkPreviewService } from '../services/link-preview.service';
import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';
import { SoundService } from '../services/sound.service';

import { Post } from '../shared/models/message.model';
import { PostDisplayerComponent } from '../components/post-displayer/post-displayer.component';
import { PreloaderComponent } from '../shared/preloader/preloader.component';
import { AuthGateModalComponent } from '../components/auth-gate-modal/auth-gate-modal.component';

import { ProfileIntentCardComponent } from '../components/profile-intent-card/profile-intent-card.component';
// Firebase imports for profile intent check
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

import { NewsDisplayerComponent } from '../components/news-displayer/news-displayer.component';
import { SayItService } from '../services/say-it-service';
import { SayItDataService } from '../services/sayit-data.service';
import { ClickSoundDirective } from '../shared/directives/click-sound.directive';
declare var bootstrap: any;

// Group interface for private/public groups

@Component( {
  selector: 'app-chat-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PostDisplayerComponent,
    PreloaderComponent,
    AuthGateModalComponent,
    ProfileIntentCardComponent,
    NewsDisplayerComponent,
    ClickSoundDirective
  ],
  templateUrl: './chat-board.component.html',
  styleUrl: './chat-board.component.css'
} )
export class ChatBoardComponent implements OnInit, OnDestroy, AfterViewInit {
  firebaseUser: any = null;
  isLoggedIn = false;
  readonly userId: string = environment.taliferroTenantId;
  activePrimaryView: 'feed' | 'businesses' | 'newsstand' = 'feed';
  showComposer = false;
  postSearchTerm = '';
  postsInitialLoadComplete = false;
  postsLoadError = false;
  businessWatchPendingIds = new Set<string>();
  showMineOnly: boolean = false;
  showSearch: boolean = false;
  showHorizontalFeedHint: boolean = false;
  private readonly FEED_HINT_KEY = 'sayit_horizontal_feed_hint_dismissed';
  imageDraft: boolean = false; // true when an uploaded image is waiting for user to click Post
  currentGroupId: string | null = null;

  activeFilter: string = 'all';
  selectedCategoryFilter: string = 'all';
  readonly preferredCategoryOrder: string[] = [
    'all',
    'construction',
    'trucking-logistics',
    'manufacturing',
    'retail',
    'ecommerce',
    'real-estate',
    'food-beverage',
    'hospitality',
    'professional-services',
    'marketing',
    'technology',
    'healthcare',
    'finance',
    'education',
    'automotive',
    'energy',
    'government-contracting',
    'nonprofit',
    'agriculture'
  ];

  profileGateRequired = false;

  @ViewChild( 'messageInput', { static: false } )
  messageInput!: ElementRef<HTMLInputElement>;

  @ViewChild( 'horizontalScrollContainer', { static: false } )
  horizontalScrollContainer!: ElementRef;

  @ViewChild( 'businessSection', { static: false } )
  businessSection?: ElementRef<HTMLElement>;

  isSmallScreen: boolean = window.innerWidth < 992;
  showPublic: boolean = true;

  showAuthGate: boolean = false;
  // User closed the auth gate while signed out; allow read-only browsing without re-opening.
  authGateDismissed: boolean = false;

  posts$!: Observable<Post[]>;
  newMessage: string = '';
  // RSS progress tracking

  pageSize: number = 100;
  page: number = 1;
  isPosting = false;
  showFavorites: boolean = false;

  lightboxImage: string | null = null;

  readonly multiTenant = false;
  isLoading: boolean = false;
  placeholderUrl: string = 'assets/pixel-1x1.png';
  uploadProgress: number | null = null;
  downloadURL: string | null = null;
  downloadPath: string | null = null;
  processing: boolean = false;
  firstName!: string;

  messageSubscription!: Subscription;
  globalPostsSubscripton!: Subscription;
  getUserSubscription2!: Subscription;

  subscription!: Subscription;
  getUserSubscription!: Subscription;
  storage = getStorage();
  private topPoztintervalId: any;
  sayitSchedulerEnabled: boolean | null = null;
  sayitSchedulerLoading: boolean = false;
  totalLikes: number = 0;
  showProfileIntent: boolean = false;
  showNewsstand: boolean = false;
  displayName: string = '';
  userImage!: string;
  userSubscription!: Subscription;
  getLoggedInContactInfoSubscription!: Subscription;
  production = environment.production;
  currentUserContact!: any;
  tempPost!: Post;
  lightboxVideoUrl: string | null = null;
  totalPosts: number = 0;
  user!: any;
  favoritePostIds: string[] = [];
  interestUnreadCount = 0;

  get isMasterTenant (): boolean {
    const masterTenantId = String( environment.taliferroTenantId || '' ).trim();
    const currentIds = [
      this.userId,
      this.firebaseUser?.uid,
      this.user?.uid,
    ].map( value => String( value || '' ).trim() );
    return !!masterTenantId && currentIds.includes( masterTenantId );
  }

  allPosts: any[] = []; // Full list of posts (updated in real-time)
  visiblePosts: any[] = []; // Posts currently visible in the UI
  currentPage: number = 1; // Current page number
  /** How many of the newest posts the live listener holds; grows as the user scrolls past them. */
  postsWindow: number = 200;
  private subscribedPostsWindow = 0;
  private hasMorePosts = false;
  private showNextPageWhenLoaded = false;

  sayItProfile: any = null;
  sayItProfileLoaded: boolean = false;
  businessDirectory: any[] = [];
  businessSearchTerm = '';
  businessCategoryFilter = 'all';
  businessDiscoveryLoading = false;

  /**
   * Constructs an instance of the component, initializing all required services and setting up
   * a subscription to track user authentication status.
   * @param logger - Logger service for logging messages.
   * @param router - Router service for navigation.
   * @param authService - Authentication service for user authentication.
   * @param soundService - Sound service for managing audio.
   * @param userService - User service for user-related operations.
   * @param openAIService - OpenAI service for AI operations.
   * @param messageService - Message service for message handling.
   * @param linkPreviewService - Service for generating link previews.
   * @param notificationService - Service for handling notifications.
   */
  constructor (
    protected authService: AuthContextService,
    protected soundService: SoundService,
    protected logger: LoggerService,
    protected router: Router,
    private sayItService: SayItService,
    private dataService: SayItDataService,
    private renderer: Renderer2,
    private linkPreviewService: LinkPreviewService,
    private notificationService: NotificationService
  ) { }

  /**
   * Initializes the component by subscribing to AuthContextService for the current user.
   * Once resolved, it loads messages and checks for a SayIt profile / profile-intent gate.
   */
  ngOnInit (): void {
    this.refreshPageActions();
    this.checkUser();
  }
  private getResolvedAuthUser (): {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  } | null {
    const directUser = this.firebaseUser || this.user || getAuth().currentUser;
    if ( directUser?.uid ) {
      return directUser;
    }

    try {
      const raw = window.localStorage.getItem( '__cypressAuthOverride' );
      if ( !raw ) return null;

      const parsed = JSON.parse( raw );
      if ( !parsed?.uid ) return null;

      return {
        uid: String( parsed.uid ).trim(),
        email: parsed.email ? String( parsed.email ).trim() : null,
        displayName: parsed.email ? String( parsed.email ).split( '@' )[0] : 'User',
        photoURL: null
      };
    } catch {
      return null;
    }
  }

  async checkUser () {
    this.logger.info( "CHECK USER" );

    this.authService.getUser().subscribe( async ( u ) => {
      this.logger.info( "USER RETURNED", u );

      if ( !u ) {
        if ( this.authGateDismissed ) {
          this.showAuthGate = false;
        } else {
          this.firebaseUser = u;
          this.showAuthGate = true;
        }

        // Guests can still read posts
        await this.loadMessages();
        this.setupPage();
        return;
      }

      // Signed in
      this.firebaseUser = u;
      this.user = u;
      this.isLoggedIn = true;
      this.showAuthGate = false;
      this.authGateDismissed = false;

      // Now auth.currentUser is guaranteed real
      await this.ensureSayItProfileExists();
      await this.checkProfileIntentGate();

      this.logger.info( '[SayIt] showProfileIntent:', this.showProfileIntent );

      // Hard gate: do not load or render SayIt content for signed-in users until profile is completed.
      // if ( this.profileGateRequired ) {
      //   this.isLoading = false;
      //   return;
      // }

      await this.loadMessages();
      this.setupPage();
    } );
  }

  async setupPage () {
    // TBD
    this.incrementTopPostsFavoriteCount();
    this.checkScreenSize();

    this.logger.info( "if no SayIt profile exists, prompt for it." );
    // Gate: if no SayIt profile exists, prompt for it.
    // Only suppress the auth gate for signed-in users.
    // For guests we want the auth gate to appear on first visit (unless dismissed).
    if ( this.isLoggedIn && !this.showProfileIntent ) this.showAuthGate = false;

    if ( this.isMasterTenant ) {
      void this.loadSchedulerStatus();
    }

    if ( this.isLoggedIn ) {
      void this.loadInterestNotifications();
    }

    this.evaluateHorizontalFeedHint();
    this.refreshPageActions();
  }

  /** Prevent the page from scrolling while the forced profile gate is active. */
  private setGateScrollLock ( locked: boolean ): void {
    try {
      document.body.style.overflow = locked ? 'hidden' : '';
    } catch { }
  }

  onAuthGateClosed (): void {
    // User chose not to sign in right now; keep SayIt read-only and don't re-open.
    this.authGateDismissed = true;
    this.showAuthGate = false;
    this.blurInput();
  }

  async onAuthGateSignedIn (): Promise<void> {
    this.showAuthGate = false;
    this.blurInput();
    try {
      // await this.setUserInfo();

      await this.ensureSayItProfileExists();
      await this.checkProfileIntentGate();
      // Focus input if applicable
      setTimeout( () => {
        this.setFocusOnInput();
      }, 300 );
    } catch ( e ) {
      this.logger.error( 'onAuthGateSignedIn error', e );
    }
  }

  /**
   * Checks if the signed-in user has a SayIt profile (and whether it looks complete).
   * Reads from: /tenants/{master}/say-it-profiles/{uid}
   */
  private async checkProfileIntentGate (): Promise<void> {
    try {
      const u = this.getResolvedAuthUser();
      const uid = u?.uid || '';
      if ( !uid ) {
        this.showProfileIntent = false;
        this.profileGateRequired = false;
        this.setGateScrollLock( false );
        return;
      }

      // Cypress bypass: seed a complete profile via localStorage to skip Firestore
      try {
        const cypressProfile = window.localStorage.getItem( '__cypressSayItProfile' );
        if ( cypressProfile && ( window as any ).Cypress ) {
          const data = JSON.parse( cypressProfile );
          this.sayItProfile = data;
          this.sayItProfileLoaded = true;
          this.showProfileIntent = false;
          this.profileGateRequired = false;
          this.setGateScrollLock( false );
          this.refreshPageActions();
          return;
        }
      } catch { }

      const masterTenantId = environment.taliferroTenantId;
      const db = getFirestore();
      const sayItEndpoint = 'say-it-profiles';

      const ref = doc( db, `tenants/${masterTenantId}/${sayItEndpoint}/${uid}` );
      const snap = await getDoc( ref );

      this.logger.info( '[SayIt] profile gate check', {
        uid,
        exists: snap.exists(),
        keys: snap.exists() ? Object.keys( ( snap.data() as any ) || {} ) : []
      } );

      // Show intent card if missing OR missing handle (basic completeness check)
      // Show intent card if missing OR missing required profile basics
      const data = snap.exists() ? ( snap.data() as any ) : null;

      // Cache SayIt profile for later use (posting, UI display name, avatar, etc.)
      this.sayItProfile = data || null;
      this.sayItProfileLoaded = true;
      this.favoritePostIds = Array.isArray( data?.favoritePostIds )
        ? data.favoritePostIds
          .map( ( id: any ) => String( id || '' ).trim() )
          .filter( ( id: string ) => !!id )
        : [];

      // Prefer SayIt profile values when present
      if ( data?.displayName && String( data.displayName ).trim() ) {
        this.displayName = String( data.displayName ).trim();
      }
      if ( data?.photoURL && String( data.photoURL ).trim() ) {
        this.userImage = String( data.photoURL ).trim();
      }

      const hasDisplayName = !!(
        ( data?.displayName && String( data.displayName ).trim() ) ||
        ( data?.name && String( data.name ).trim() )
      );

      const hasIntent = !!(
        ( data?.intentText && String( data.intentText ).trim() ) ||
        ( data?.intent && String( data.intent ).trim() ) ||
        ( data?.sellText && String( data.sellText ).trim() ) ||
        ( data?.sell && String( data.sell ).trim() )
      );

      const hasWebsiteUrl = !!(
        ( data?.websiteUrl && String( data.websiteUrl ).trim() ) ||
        ( data?.website && String( data.website ).trim() ) ||
        ( data?.url && String( data.url ).trim() )
      );

      const hasCompletionFlag = !!( data?.profileIntentCompleted || data?.onboardingCompleted );

      const hasBasics = ( hasDisplayName && hasIntent ) || hasCompletionFlag;

      this.logger.info( '[SayIt] profile gate evaluated', {
        uid,
        hasDisplayName,
        hasIntent,
        hasWebsiteUrl,
        hasCompletionFlag,
        hasBasics,
        profileIntentCompleted: !!data?.profileIntentCompleted,
        onboardingCompleted: !!data?.onboardingCompleted,
        onboardingStep: data?.onboardingStep || ''
      } );

      const needsGate = !snap.exists() || !hasBasics;
      this.showProfileIntent = needsGate;
      this.profileGateRequired = needsGate;
      this.setGateScrollLock( needsGate );
      this.refreshPageActions();
    } catch ( e ) {
      this.logger.error( 'checkProfileIntentGate error', e );

      // If the user is signed in but we cannot read the profile doc (rules, network, timing,
      // storage/privacy restrictions), do NOT silently hide the gate.
      // Showing the intent card gives the user a way forward.
      const u = this.getResolvedAuthUser();
      const uid = u?.uid || '';

      // Keep cached state consistent so other code can safely reference it.
      this.sayItProfile = null;
      this.sayItProfileLoaded = true;
      this.favoritePostIds = [];

      // Signed-in users should see the intent card when the profile check fails.
      this.showProfileIntent = !!uid;
      this.profileGateRequired = !!uid;
      this.setGateScrollLock( !!uid );
      this.refreshPageActions();

      // Optional: surface a lightweight hint so the user isn't confused.
      try {
        if ( uid ) {
          this.notificationService.show(
            'Profile check failed',
            'We could not load your SayIt profile. Please complete it to continue posting.',
            'warning'
          );
        }
      } catch { }
    }
  }

  saveClick () {
    this.soundService.playSound( "finished" );
  }

  toggleOnSelection () {
    this.soundService.playSound( "toggleOn" );
  }

  toggleOffSelection () {
    this.soundService.playSound( "toggleOff" );
  }

  async onFavoritePost ( post: Post ): Promise<void> {
    try {
      const uid = this.firebaseUser?.uid || getAuth().currentUser?.uid || '';
      if ( !uid ) {
        this.notificationService.show(
          'Login Required',
          'Please sign in to favorite posts.',
          'warning'
        );
        return;
      }

      const postId = post?.id ? String( post.id ).trim() : '';
      if ( !postId ) {
        this.notificationService.show( 'Error', 'Invalid post.', 'error' );
        return;
      }

      const postFavoriteUserIds = this.getPostFavoriteUserIds( post );
      if ( this.favoritePostIds.includes( postId ) || postFavoriteUserIds.includes( uid ) ) {
        this.notificationService.show(
          'Info',
          'This post is already in your favorites.',
          'info'
        );
        return;
      }

      const nextFavoritePostIds = [...this.favoritePostIds, postId];
      const actorEmail = this.firebaseUser?.email || getAuth().currentUser?.email || 'user';

      await this.dataService.upsertUserProfile(
        uid,
        { favoritePostIds: nextFavoritePostIds },
        actorEmail
      );

      this.favoritePostIds = nextFavoritePostIds;

      if ( this.sayItProfile ) {
        this.sayItProfile = {
          ...this.sayItProfile,
          favoritePostIds: nextFavoritePostIds
        };
      }

      if ( post && post.id ) {
        const nextPost = this.applyFavoriteStateToPost( post, uid, true );
        Object.assign( post, nextPost );
        await this.dataService.updateMessage( post.id, nextPost as any );
      }

      this.notificationService.show(
        'Success!',
        'Post has been added to your favorites!',
        'success'
      );
    } catch ( error ) {
      this.logger.error( 'onFavoritePost error', error );
      this.notificationService.show(
        'Error!',
        'Failed to add post to your favorites.',
        'error'
      );
    }
  }

  async onUnfavoritePost ( post: Post ): Promise<void> {
    try {
      const uid = this.firebaseUser?.uid || getAuth().currentUser?.uid || '';
      if ( !uid ) {
        this.notificationService.show(
          'Login Required',
          'Please sign in to update favorites.',
          'warning'
        );
        return;
      }

      const postId = post?.id ? String( post.id ).trim() : '';
      if ( !postId ) {
        this.notificationService.show( 'Error', 'Invalid post.', 'error' );
        return;
      }

      const postFavoriteUserIds = this.getPostFavoriteUserIds( post );
      if ( !this.favoritePostIds.includes( postId ) && !postFavoriteUserIds.includes( uid ) ) {
        this.logger.warn( 'onUnfavoritePost: post not currently favorited', { postId } );
        return;
      }

      const nextFavoritePostIds = this.favoritePostIds.filter( id => id !== postId );
      const actorEmail = this.firebaseUser?.email || getAuth().currentUser?.email || 'user';

      await this.dataService.upsertUserProfile(
        uid,
        { favoritePostIds: nextFavoritePostIds },
        actorEmail
      );

      this.favoritePostIds = nextFavoritePostIds;

      if ( this.sayItProfile ) {
        this.sayItProfile = {
          ...this.sayItProfile,
          favoritePostIds: nextFavoritePostIds
        };
      }

      if ( post && post.id ) {
        const nextPost = this.applyFavoriteStateToPost( post, uid, false );
        Object.assign( post, nextPost );
        await this.dataService.updateMessage( post.id, nextPost as any );
      }

      this.notificationService.show(
        'Updated',
        'Post removed from your favorites.',
        'success'
      );
    } catch ( error ) {
      this.logger.error( 'onUnfavoritePost error', error );
      this.notificationService.show(
        'Error!',
        'Failed to update favorites.',
        'error'
      );
    }
  }

  private getPostFavoriteUserIds ( post: any ): string[] {
    const raw = Array.isArray( post?.favoriteUserIds ) ? post.favoriteUserIds : [];
    return raw
      .map( ( id: any ) => String( id || '' ).trim() )
      .filter( ( id: string, index: number, array: string[] ) => !!id && array.indexOf( id ) === index );
  }

  private applyFavoriteStateToPost ( post: any, uid: string, shouldFavorite: boolean ): any {
    const favoriteUserIds = this.getPostFavoriteUserIds( post );

    const nextFavoriteUserIds = shouldFavorite
      ? ( favoriteUserIds.includes( uid ) ? favoriteUserIds : [...favoriteUserIds, uid] )
      : favoriteUserIds.filter( id => id !== uid );

    return {
      ...post,
      favoriteUserIds: nextFavoriteUserIds,
      favoriteCount: nextFavoriteUserIds.length
    };
  }

  /** Prefer SayIt profile identity for posting. Falls back to Firebase auth profile. */
  private getSayItIdentity (): { displayName?: string; photoURL?: string; handle?: string; } {
    const p: any = this.sayItProfile || null;
    const displayName =
      p?.displayName && String( p.displayName ).trim()
        ? String( p.displayName ).trim()
        : undefined;

    const photoURL =
      p?.photoURL && String( p.photoURL ).trim()
        ? String( p.photoURL ).trim()
        : undefined;

    const handle =
      p?.handle && String( p.handle ).trim()
        ? String( p.handle ).trim().toLowerCase()
        : undefined;

    return { displayName, photoURL, handle };
  }

  private evaluateHorizontalFeedHint (): void {
    try {
      const dismissed = localStorage.getItem( this.FEED_HINT_KEY ) === 'true';
      this.showHorizontalFeedHint = !dismissed && this.activePrimaryView === 'feed' && this.visiblePosts.length > 1;
    } catch {
      this.showHorizontalFeedHint = this.activePrimaryView === 'feed' && this.visiblePosts.length > 1;
    }
  }

  dismissHorizontalFeedHint (): void {
    this.showHorizontalFeedHint = false;
    try {
      localStorage.setItem( this.FEED_HINT_KEY, 'true' );
    } catch { }
    this.soundService.playSound('click');
  }

  toggleNewsstand (): void {
    try {
      this.setPrimaryView( this.activePrimaryView === 'newsstand' ? 'feed' : 'newsstand' );
    } catch ( e ) {
      this.logger.error( 'toggleNewsstand error', e );
    }
  }

  setPrimaryView ( view: 'feed' | 'businesses' | 'newsstand' ): void {
    this.activePrimaryView = view;
    this.evaluateHorizontalFeedHint();
    this.showNewsstand = view === 'newsstand';
    this.refreshPageActions();
    this.scrollBusinessSectionIntoView( view );
    this.soundService.playSound('click');
  }

  openSearchPanel (): void {
    this.showSearch = true;
    this.showComposer = false;
  }

  toggleSearchPanel (): void {
    this.showSearch = !this.showSearch;
    if ( this.showSearch ) this.showComposer = false;
    this.soundService.playSound('click');
  }

  openComposerPanel (): void {
    this.showComposer = true;
    this.showSearch = false;
  }

  toggleComposerPanel (): void {
    this.showComposer = !this.showComposer;
    if ( this.showComposer ) this.showSearch = false;
    this.soundService.playSound('click');
  }

  closeHoverPanel ( panel: 'search' | 'composer' ): void {
    // Hover opens the lightweight panel; clicking its icon keeps it open.
    if ( panel === 'search' && this.postSearchTerm.trim() ) return;
    if ( panel === 'composer' && this.newMessage.trim() ) return;
  }

  isPrimaryView ( view: 'feed' | 'businesses' | 'newsstand' ): boolean {
    return this.activePrimaryView === view;
  }

  /** Open the full-page SayIt profile editor from the Page Actions menu. */
  openProfileIntentFromMenu (): void {
    try {
      if ( !this.firebaseUser ) {
        this.router.navigate( ['/not-authorized'] );
        return;
      }
      this.router.navigate( ['/profile'] );
      this.blurInput();
    } catch ( e ) {
      this.logger.error( 'openProfileIntentFromMenu error', e );
    }
  }

  getSayItProfileRoute (): string[] | null {
    const handle = ( this.sayItProfile?.handle || '' ).toString().trim().toLowerCase();
    if ( handle ) return ['/business', handle];

    const uid = ( this.firebaseUser?.uid || this.user?.uid || '' ).toString().trim();
    if ( uid ) return ['/business', uid];

    return null;
  }

  openMyBusinessPage (): void {
    const route = this.getSayItProfileRoute();
    if ( !route ) return;

    this.soundService.playSound('click');
    this.router.navigate( route );
  }

  async logout (): Promise<void> {
    this.soundService.playSound('click');
    await this.authService.signOut();
    this.router.navigate( ['/'] );
  }

  private async loadInterestNotifications (): Promise<void> {
    const uid = String( this.firebaseUser?.uid || this.user?.uid || this.userId || '' ).trim();
    if ( !uid ) return;

    try {
      const interests = await this.sayItService.getInterestsForAuthor( uid, 100 );
      this.interestUnreadCount = interests.filter( interest => interest.viewed !== true ).length;
    } catch ( error ) {
      this.logger.warn( '[SayIt] interest notification load failed', error );
      this.interestUnreadCount = 0;
    }
  }

  async loadBusinessDirectory (): Promise<void> {
    this.businessDiscoveryLoading = true;

    try {
      this.logger.info( '[SayIt Browse Businesses] load start', {
        viewerUid: this.firebaseUser?.uid || this.user?.uid || null,
        viewerEmail: this.firebaseUser?.email || this.user?.email || null,
        categoryFilter: this.businessCategoryFilter,
        searchTerm: this.businessSearchTerm || ''
      } );

      this.businessDirectory = await this.dataService.getPublicSayItProfilesOnce( 'SayIt Business Directory', { limit: 60 } );
      if ( !this.businessDirectory.length ) {
        this.logger.warn( '[SayIt Browse Businesses] first read returned empty, retrying', {
          viewerUid: this.firebaseUser?.uid || this.user?.uid || null
        } );
        this.businessDirectory = await this.dataService.getPublicSayItProfilesOnce( 'SayIt Business Directory Retry', { limit: 60 } );
      }

      this.logger.info( '[SayIt Browse Businesses] load result', {
        viewerUid: this.firebaseUser?.uid || this.user?.uid || null,
        rawCount: this.businessDirectory.length,
        filteredCount: this.getFilteredBusinessDirectory().length,
        watchlistCount: this.getWatchlistProfileIds().length,
        sampleIds: this.businessDirectory.slice( 0, 5 ).map( ( profile: any ) => String( profile?.id || profile?.uid || '' ) ),
        sampleLabels: this.businessDirectory.slice( 0, 5 ).map( ( profile: any ) =>
          String( profile?.businessName || profile?.displayName || profile?.companyName || '' )
        )
      } );
    } catch ( e ) {
      this.logger.error( 'loadBusinessDirectory error', e );
      this.businessDirectory = [];
    } finally {
      this.businessDiscoveryLoading = false;
    }
  }

  getBusinessCategoryPills (): string[] {
    const discovered = this.businessDirectory
      .map( profile => this.normalizeBusinessCategory( profile ) )
      .filter( ( category: string, index: number, array: string[] ) =>
        !!category &&
        category !== 'all' &&
        array.indexOf( category ) === index
      );

    const ordered = this.preferredCategoryOrder.filter( category => discovered.includes( category ) );
    const extras = discovered.filter( category => !this.preferredCategoryOrder.includes( category ) );
    return ['all', 'watchlist', ...ordered, ...extras];
  }

  getFilteredBusinessDirectory (): any[] {
    const search = ( this.businessSearchTerm || '' ).trim().toLowerCase();
    const category = String( this.businessCategoryFilter || 'all' ).trim().toLowerCase();
    const watchlistIds = this.getWatchlistProfileIds();

    return this.businessDirectory.filter( profile => {
      const profileId = String( profile?.id || profile?.uid || '' ).trim();
      const normalizedCategory = this.normalizeBusinessCategory( profile );
      const haystack = [
        profile?.businessName,
        profile?.displayName,
        profile?.tagline,
        profile?.pinnedIntro,
        profile?.intentText,
        profile?.sellText,
        profile?.location,
        profile?.businessCategory,
        profile?.handle
      ]
        .map( value => String( value || '' ).toLowerCase() )
        .join( ' ' );

      const matchesSearch = !search || haystack.includes( search );
      const matchesCategory =
        category === 'all' ||
        ( category === 'watchlist' ? watchlistIds.includes( profileId ) : normalizedCategory === category );

      return matchesSearch && matchesCategory;
    } );
  }

  setBusinessCategoryFilter ( category: string ): void {
    this.businessCategoryFilter = String( category || 'all' ).trim().toLowerCase() || 'all';
    this.soundService.playSound('click');
  }

  isBusinessCategoryFilterActive ( category: string ): boolean {
    return this.businessCategoryFilter === String( category || 'all' ).trim().toLowerCase();
  }

  getBusinessProfileRoute ( profile: any ): string[] {
    const identifier = (
      profile?.handle ||
      profile?.id ||
      profile?.uid ||
      ''
    ).toString().trim().toLowerCase();

    return ['/business', identifier];
  }

  getBusinessCardTitle ( profile: any ): string {
    return (
      profile?.businessName ||
      profile?.displayName ||
      profile?.companyName ||
      'Business'
    ).toString().trim();
  }

  getBusinessCardSummary ( profile: any ): string {
    return (
      profile?.tagline ||
      profile?.pinnedIntro ||
      profile?.intentText ||
      profile?.sellText ||
      'Business updates and intent on SayIt.'
    ).toString().trim();
  }

  getBusinessCompleteness ( profile: any ): number {
    const checks = [
      profile?.displayName,
      profile?.businessName,
      profile?.businessCategory || profile?.industry,
      profile?.location,
      profile?.websiteUrl || profile?.website,
      profile?.intentText || profile?.sellText,
      profile?.tagline,
      profile?.pinnedIntro,
    ];

    const completed = checks.filter( value => String( value || '' ).trim().length > 0 ).length;
    return Math.round( ( completed / checks.length ) * 100 );
  }

  isBusinessWatchlisted ( profile: any ): boolean {
    const profileId = String( profile?.id || profile?.uid || '' ).trim();
    return !!profileId && this.getWatchlistProfileIds().includes( profileId );
  }

  isBusinessWatchPending ( profile: any ): boolean {
    const profileId = String( profile?.id || profile?.uid || '' ).trim();
    return !!profileId && this.businessWatchPendingIds.has( profileId );
  }

  async toggleBusinessWatchlist ( profile: any, event?: Event ): Promise<void> {
    try {
      event?.preventDefault();
      event?.stopPropagation();
    } catch { }

    const currentUid = ( this.firebaseUser?.uid || this.user?.uid || '' ).toString().trim();
    const targetId = ( profile?.id || profile?.uid || '' ).toString().trim();

    if ( !currentUid ) {
      this.notificationService.show( 'Login Required', 'Please sign in to build a SayIt watchlist.', 'warning' );
      return;
    }

    if ( !targetId || currentUid === targetId || this.businessWatchPendingIds.has( targetId ) ) return;

    const previousWatchlistIds = this.getWatchlistProfileIds();
    const wasWatching = previousWatchlistIds.includes( targetId );
    const nextWatchlistIds = wasWatching
      ? previousWatchlistIds.filter( id => id !== targetId )
      : [...previousWatchlistIds, targetId];
    const previousWatcherCount = Number( profile?.watcherCount || 0 );
    const nextWatcherCount = Math.max( 0, previousWatcherCount + ( wasWatching ? -1 : 1 ) );

    this.businessWatchPendingIds.add( targetId );
    this.applyOptimisticBusinessWatchUpdate( targetId, nextWatchlistIds, nextWatcherCount );

    try {
      const result = await this.dataService.toggleSayItBusinessWatch( currentUid, targetId, currentUid );
      this.applyOptimisticBusinessWatchUpdate( targetId, result.watchlistProfileIds, result.watcherCount );

      this.notificationService.show(
        result.watching ? 'Watching' : 'Removed',
        result.watching ? 'Business added to your SayIt watchlist.' : 'Business removed from your SayIt watchlist.',
        'success'
      );
    } catch ( e ) {
      this.logger.error( 'toggleBusinessWatchlist error', e );
      this.applyOptimisticBusinessWatchUpdate( targetId, previousWatchlistIds, previousWatcherCount );
      this.notificationService.show( 'Could not save', 'Could not save. Try again.', 'error' );
    } finally {
      this.businessWatchPendingIds.delete( targetId );
    }
  }

  onProfileIntentClosed (): void {
    if ( this.profileGateRequired ) {
      this.showProfileIntent = true;
      return;
    }
    // Keep browsing; user can re-open via Page Actions.
    this.showProfileIntent = false;
    this.blurInput();
    if ( this.isLoggedIn ) this.showAuthGate = false;
  }

  async onProfileIntentCompleted (): Promise<void> {
    // Profile was saved; clear the forced gate and render SayIt.
    this.profileGateRequired = false;
    this.showProfileIntent = false;
    this.setGateScrollLock( false );

    try {
      // Re-check so cached profile fields (displayName/photo) update immediately.
      await this.checkProfileIntentGate();

      // If gate still required for any reason, do not proceed.
      if ( this.profileGateRequired || this.showProfileIntent ) return;

      await this.loadMessages();
      this.setupPage();
      this.refreshPageActions();

      setTimeout( () => {
        this.setFocusOnInput();
      }, 300 );
    } catch ( e ) {
      this.logger.error( 'onProfileIntentCompleted error', e );
    }
  }

  /**
   * Clean up various subscriptions to prevent memory leaks.
   * Called when the component is being destroyed.
   */
  ngOnDestroy (): void {
    this.setGateScrollLock( false );
    if ( this.messageSubscription ) this.messageSubscription.unsubscribe();
    if ( this.globalPostsSubscripton ) this.globalPostsSubscripton.unsubscribe();
    if ( this.subscription ) this.subscription.unsubscribe();
    if ( this.getLoggedInContactInfoSubscription )
      this.getLoggedInContactInfoSubscription.unsubscribe();
    if ( this.topPoztintervalId ) clearInterval( this.topPoztintervalId );
    if ( this.getUserSubscription ) this.getUserSubscription.unsubscribe();
    if ( this.getUserSubscription2 ) this.getUserSubscription2.unsubscribe();
  }

  /**
   * Checks the width of the window and sets the `isSmallScreen` property based on
   * whether or not the current window inner width is less than the Bootstrap medium breakpoint.
   * This function is intended to be used in a responsive design context.
   */
  private checkScreenSize (): void {
    this.isSmallScreen = window.innerWidth < 768; // Bootstrap md breakpoint
  }

  /**
   * Handles the scroll event on the window object.
   * If the bottom of the page is reached, it triggers the loading of more posts.
   */
  @HostListener( 'window:scroll', [] )
  onScroll () {
    if ( this.profileGateRequired && this.showProfileIntent ) return;
    if ( this.reachedBottom() ) {
      this.loadMorePosts();
    }
  }

  /**
   * Determines if the user has scrolled to the bottom of the page within a threshold.
   * @returns {boolean} True if the current scroll position is within 200 pixels from the bottom of the document's body.
   */
  private reachedBottom (): boolean {
    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.body.offsetHeight - 200; // Load more when 200px from bottom
    return scrollPosition >= threshold;
  }

  loadMorePosts () {
    const filteredPosts = this.getFilteredPosts();
    const nextCount = ( this.currentPage + 1 ) * this.pageSize;

    if ( this.visiblePosts.length >= filteredPosts.length ) {
      // Shown everything loaded so far - widen the live window if Firestore has older posts.
      if ( this.hasMorePosts ) {
        this.postsWindow += this.pageSize * 2;
        this.showNextPageWhenLoaded = true;
        void this.loadMessages();
      }
      return;
    }

    this.currentPage++;
    this.visiblePosts = filteredPosts.slice( 0, nextCount );
  }

  /**
   * Lifecycle hook that is called after Angular has fully initialized a component's view.
   * It starts by setting a delayed function to obtain all video container elements within the document.
   * For each video container the method sets up an IntersectionObserver to load the appropriate iframe element
   * with the video source based on the platform-specific data attributes ('data-video-id' and 'data-platform').
   * If no video containers are found, it logs a warning message.
   * After the same delay, it checks if the user is logged in to set the focus on an input field.
   */
  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
    this.refreshPageActions();

    if ( this.horizontalScrollContainer ) {
      this.renderer.listen(
        this.horizontalScrollContainer.nativeElement,
        'scroll',
        () => {
          const container = this.horizontalScrollContainer.nativeElement;
          const scrollPosition = container.scrollLeft + container.clientWidth;
          const maxScroll = container.scrollWidth;

          if ( scrollPosition >= maxScroll - 50 ) {
            this.loadMorePosts();
          }
        }
      );
    }

    this.initializeVideoContainers();

    setTimeout( () => {
      this.setFocusOnInput();
    }, 1000 );
  }
  /** True when it's safe to focus the message input (no blocking modals). */
  private canFocusInput (): boolean {
    return !!this.isLoggedIn && !this.showAuthGate && !this.showProfileIntent;
  }

  /** Prevent the input from stealing focus while a modal is open. */
  private blurInput (): void {
    try {
      this.messageInput?.nativeElement?.blur();
    } catch { }
  }

  /**
   * Sets focus to the message input element if it exists and no modal is blocking.
   * Logs an action message when focusing, or a warning if the input element is not found.
   */
  setFocusOnInput (): void {
    if ( !this.canFocusInput() ) return;

    if ( this.messageInput ) {
      this.logger.log( 'Focusing input element...' );
      this.messageInput.nativeElement.focus();
    } else {
      this.logger.warn( 'Input element not found' );
    }
  }

  /**
   * Asynchronously loads messages for the user. It unsubscribes from any existing user or global posts subscriptions
   * before creating a new subscription to fetch the user's information and set their display name and image.
   * Also subscribes to global posts and tenant posts to update the posts list, which is then filtered by the selected category.
   */
  async loadMessages ( force: boolean = false ) {
    // Signing in used to tear down and re-download the whole feed; the live
    // listener doesn't depend on who's signed in, so keep it unless the
    // window grew or a retry was requested.
    const listenerActive = !!this.messageSubscription && !this.messageSubscription.closed;
    if ( !force && listenerActive && !this.postsLoadError && this.subscribedPostsWindow === this.postsWindow ) {
      return;
    }

    try {
      // Widening the window keeps the current posts on screen while more load.
      if ( !listenerActive || force ) this.postsInitialLoadComplete = false;
      this.postsLoadError = false;
      this.messageSubscription?.unsubscribe();
      this.subscribedPostsWindow = this.postsWindow;
      this.posts$ = this.dataService.getRealtimePosts( this.postsWindow );

      this.messageSubscription = this.posts$.subscribe( {
        next: ( posts ) => {

          if ( this.isLoading ) {
            this.isLoading = false;
          }

          this.allPosts = [...posts];
          this.hasMorePosts = posts.length >= this.subscribedPostsWindow;
          // Only the first load starts at page 1; later snapshots (new posts
          // arriving, a widened window) keep the reader where they are.
          const firstLoad = !this.postsInitialLoadComplete;
          this.postsInitialLoadComplete = true;
          if ( this.showNextPageWhenLoaded ) {
            this.showNextPageWhenLoaded = false;
            this.currentPage++;
          }
          this.applyPostFilters( firstLoad );

        },
        error: ( error ) => {
          this.logger.error( '[ChatBoard] Error in posts$ subscription:', error );
          this.isLoading = false;
          this.postsLoadError = true;
          // Still show NewsStand items for guests or when POSTS cannot be read
          // this.mergeNewsIntoPosts();
        },
        complete: () => {
        }
      } );
    } catch ( error ) {
      this.logger.error( '[ChatBoard] Unexpected error in loadMessages():', error );
      this.isLoading = false;
      this.postsLoadError = true;
    }
  }

  async retryPostLoad (): Promise<void> {
    await this.loadMessages( true );
  }

  applyPostFilters ( resetPaging: boolean = false ): void {
    if ( resetPaging ) {
      this.currentPage = 1;
    }

    const filteredPosts = this.getFilteredPosts();
    const visibleCount = this.currentPage * this.pageSize;

    this.visiblePosts = filteredPosts.slice( 0, visibleCount );
    this.evaluateHorizontalFeedHint();
  }

  private getFilteredPosts (): any[] {
    const currentUid = this.firebaseUser?.uid || this.user?.uid || getAuth().currentUser?.uid || '';
    const normalizedCategory = String( this.selectedCategoryFilter || 'all' ).trim().toLowerCase();
    const searchTerm = this.postSearchTerm.trim().toLowerCase();

    return this.allPosts.filter( ( post: any ) => {
      const postCategory = String( post?.category || 'all' ).trim().toLowerCase();
      const postAuthorUid = String( post?.authorUid || post?.userId || post?.uid || '' ).trim();
      const postEmail = String( post?.emailAddress || '' ).trim().toLowerCase();
      const currentEmail = String( this.firebaseUser?.email || this.user?.email || '' ).trim().toLowerCase();

      const matchesCategory = normalizedCategory === 'all' || postCategory === normalizedCategory;
      const matchesMine = !this.showMineOnly || !!(
        ( currentUid && postAuthorUid && postAuthorUid === currentUid ) ||
        ( currentEmail && postEmail && postEmail === currentEmail )
      );
      const matchesFavorites = !this.showFavorites || this.favoritePostIds.includes( String( post?.id || '' ).trim() );
      const matchesSearch = !searchTerm || [
        post?.content,
        post?.displayName,
        post?.category,
        post?.location,
        post?.intentText,
        post?.sellText
      ].map( value => String( value || '' ).toLowerCase() ).join( ' ' ).includes( searchTerm );

      return matchesCategory && matchesMine && matchesFavorites && matchesSearch;
    } );
  }

  toggleFavoritesFilter (): void {
    this.showFavorites = !this.showFavorites;

    if ( this.showFavorites ) {
      this.showMineOnly = false;
    }

    this.applyPostFilters( true );
    this.soundService.playSound('click');
  }

  clearPostFeedFilters (): void {
    this.showFavorites = false;
    this.showMineOnly = false;
    this.selectedCategoryFilter = 'all';
    this.applyPostFilters( true );
  }

  getCategoryFilterPills (): string[] {
    const discoveredCategories = this.allPosts
      .map( ( post: any ) => String( post?.category || 'all' ).trim().toLowerCase() )
      .filter( ( category: string, index: number, array: string[] ) => !!category && array.indexOf( category ) === index );

    const orderedCategories = this.preferredCategoryOrder.filter( category =>
      discoveredCategories.includes( category )
    );

    const extraCategories = discoveredCategories.filter(
      category => !this.preferredCategoryOrder.includes( category )
    );

    const categorySet = new Set<string>( ['all', ...orderedCategories, ...extraCategories] );
    return Array.from( categorySet );
  }

  setCategoryFilter ( category: string ): void {
    const normalizedCategory = String( category || 'all' ).trim().toLowerCase() || 'all';
    if ( this.selectedCategoryFilter === normalizedCategory ) {
      return;
    }

    this.selectedCategoryFilter = normalizedCategory;
    this.applyPostFilters( true );
    this.soundService.playSound('click');

    const details = document.querySelector( '.chat-category-dropdown' ) as HTMLDetailsElement | null;
    if ( details ) details.open = false;

    setTimeout( () => {
      document.querySelector( '.chat-feed-shell' )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
    }, 50 );
  }

  toggleMineOnlyFilter (): void {
    this.showMineOnly = !this.showMineOnly;
    this.applyPostFilters( true );

    if ( this.showMineOnly ) {
      this.toggleOnSelection();
    } else {
      this.toggleOffSelection();
    }
  }

  isCategoryFilterActive ( category: string ): boolean {
    const normalizedCategory = String( category || 'all' ).trim().toLowerCase();

    if ( normalizedCategory === 'all' ) {
      return this.selectedCategoryFilter === 'all' && !this.showMineOnly;
    }

    return this.selectedCategoryFilter === normalizedCategory;
  }

  formatCategoryLabel ( category: string ): string {
    const normalizedCategory = String( category || 'all' ).trim().toLowerCase();

    if ( normalizedCategory === 'all' ) {
      return 'All Posts';
    }

    return normalizedCategory
      .split( '-' )
      .map( part => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
      .join( ' ' );
  }

  private getWatchlistProfileIds (): string[] {
    return Array.isArray( this.sayItProfile?.watchlistProfileIds )
      ? this.sayItProfile.watchlistProfileIds
        .map( ( id: any ) => String( id || '' ).trim() )
        .filter( ( id: string ) => !!id )
      : [];
  }

  private applyOptimisticBusinessWatchUpdate ( targetId: string, watchlistProfileIds: string[], watcherCount: number ): void {
    this.sayItProfile = {
      ...( this.sayItProfile || {} ),
      watchlistProfileIds: [...watchlistProfileIds]
    };

    this.businessDirectory = this.businessDirectory.map( item =>
      String( item?.id || item?.uid || '' ).trim() === targetId
        ? { ...item, watcherCount }
        : item
    );
  }

  private normalizeBusinessCategory ( profile: any ): string {
    return String( profile?.businessCategory || profile?.industry || profile?.category || 'all' )
      .trim()
      .toLowerCase() || 'all';
  }

  /**
   * Ensure the signed-in user has a SayIt profile doc in the master.
   * Creates a minimal stub if missing so the app can safely reference it.
   */
  private async ensureSayItProfileExists (): Promise<void> {
    const tag = '[SayIt][ensureSayItProfileExists]';
    try {
      this.logger.info( `${tag} start` );

      const u = this.getResolvedAuthUser();
      this.logger.info( `${tag} auth.currentUser`, {
        hasUser: !!u,
        uid: u?.uid || null,
        email: u?.email || null,
        displayName: u?.displayName || null
      } );

      const uid = u?.uid || '';
      if ( !uid ) {
        this.logger.warn( `${tag} no uid; skipping` );
        return;
      }

      const masterTenantId = environment.taliferroTenantId;
      const sayItEndpoint = 'say-it-profiles';

      const db = getFirestore();
      const path = `tenants/${masterTenantId}/${sayItEndpoint}/${uid}`;
      this.logger.info( `${tag} resolved path`, { masterTenantId, sayItEndpoint, uid, path } );

      const ref = doc( db, path );

      this.logger.info( `${tag} checking existing profile doc...` );
      const snap = await getDoc( ref );

      this.logger.info( `${tag} getDoc completed`, {
        exists: snap.exists(),
        id: snap.id,
        hasData: snap.exists() ? !!snap.data() : false
      } );

      if ( snap.exists() ) {
        // Helpful: log a tiny completeness signal (handle is required for the intent gate)
        const data: any = snap.data() as any;
        const hasHandle = !!( data?.handle && String( data.handle ).trim() );
        this.logger.info( `${tag} profile already exists`, { uid, hasHandle } );
        return;
      }

      const email = ( u?.email || '' ).toLowerCase();
      const displayName = u?.displayName || ( email ? email.split( '@' )[0] : 'User' );

      const payload: any = {
        uid,
        email,
        displayName,
        photoURL: u?.photoURL || null,
        publicProfile: true,
        createdAt: new Date(),
        lastUpdated: new Date()
      };

      this.logger.info( `${tag} creating missing profile doc`, {
        uid,
        email: email || null,
        displayName,
        hasPhotoURL: !!payload.photoURL,
        publicProfile: payload.publicProfile
      } );

      await setDoc( ref, payload, { merge: true } as any );

      this.logger.info( `${tag} created missing profile doc`, { uid, path } );
    } catch ( e ) {
      // Non-blocking
      this.logger.error( '[SayIt] ensureSayItProfileExists error', e );
    }
  }

  /**
   * Increments the favorite count of the top three posts every 5 minutes.
   *
   * It subscribes to the posts$ observable to get the current list of posts,
   * logs the top three posts, and then sets an interval to increment the favorite
   * count of each of these posts in sequence every 5 minutes. If the index exceeds
   * the length of top posts, the interval is cleared to stop the operation.
   */
  incrementTopPostsFavoriteCount (): void {
    this.posts$.subscribe( ( posts ) => {
      // Get the top 3 posts (you can adjust sorting logic as needed)
      const topPosts = posts.slice( 0, 3 );
      this.logger.info( 'Increment top postings', topPosts );

      let index = 0; // Track which post to increment
      this.topPoztintervalId = setInterval( () => {
        if ( index >= topPosts.length ) {
          clearInterval( this.topPoztintervalId );
          return;
        }

        const post = topPosts[index];
        post.favoriteCount = ( post.favoriteCount || 0 ) + 1; // Increment the favorite count

        // Update the post in the backend
        this.dataService.updateMessage( post.id, post );

        index++; // Move to the next post
      }, 300000 ); // Increment every 5 seconds
    } );
  }

  /**
   * Asynchronously posts a new message to the appropriate category with optional link preview.
   * If the message is addressed to SayIt, it also fetches and posts an AI response.
   * Shows a notification if the user is not currently on the chat-board page.
   */
  async postMessage () {
    if ( this.profileGateRequired && this.showProfileIntent ) return;
    // Posting requires Firebase auth (even though SayIt is not tenant-owned)
    if ( !this.isLoggedIn ) {
      this.notificationService.show(
        'Login Required',
        'Please sign in to post messages.',
        'warning'
      );
      return;
    }

    const msg = ( this.newMessage || '' ).trim();
    if ( !msg ) return;

    // Resolve Firebase author identity (source of truth for SayIt posting)
    const fb = this.firebaseUser || getAuth().currentUser;
    const authorUid = fb?.uid || '';
    if ( !authorUid ) {
      this.logger.warn( '[SayIt] postMessage: missing firebase uid; aborting post.' );
      this.notificationService.show(
        'Login Required',
        'Please sign in again to post messages.',
        'warning'
      );
      return;
    }

    const { authorContactId, authorHandle } = this.resolveAuthorMeta();

    this.isPosting = true;

    let linkPreview: any;
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const urls = msg.match( urlPattern );

    if ( urls && urls.length > 0 ) {
      try {
        linkPreview = await this.linkPreviewService
          .fetchLinkPreview( urls[0] )
          .toPromise();
      } catch ( error ) {
        this.logger.error( 'Error fetching link preview: ', error );
      }
    }

    // Build a minimal payload and let SayItService handle moderation + persistence.
    const ident = this.getSayItIdentity();
    // Final author handle used for denormalization (SayIt profile preferred)
    const finalHandle = (
      ident.handle ||
      authorHandle ||
      ''
    )
      .trim()
      .toLowerCase();

    const displayName =
      ident.displayName ||
      this.displayName ||
      fb?.displayName ||
      authorHandle ||
      'User';

    const photoURL =
      ident.photoURL ||
      this.userImage ||
      fb?.photoURL ||
      null;

    // Base payload for the service (keep some legacy fields for UI compatibility)
    // Strongly typed SayIt publish payload
    const sayItInput = {
      authorUid,
      authorEmail: fb?.email || '',

      content: msg,
      category: this.activeFilter || 'all',

      displayName,
      photoURL: photoURL ?? null,

      authorHandle: finalHandle || undefined,
      authorContactId: authorContactId || undefined,

      groupId: this.currentGroupId || null,

      linkPreview: linkPreview
        ? {
          title: linkPreview.title,
          description: linkPreview.description,
          url: linkPreview.url,
          image: linkPreview.image
        }
        : null,
      postImageUrl: this.downloadURL ? String( this.downloadURL ) : null,
      postImageThumbUrl: null, // for later
      postImagePath: this.downloadPath ? String( this.downloadPath ) : null,
      moderate: true
    };

    try {
      await this.sayItService.publishPost( sayItInput );

      // Clear image draft after successful post
      this.imageDraft = false;
      this.downloadURL = null;
      this.downloadPath = null;

      this.newMessage = '';
      this.notificationService.show( 'Success!', 'Message Posted Successfully', 'success' );

      // SayIt auto-reply
      const normalizedMessage = msg.toLowerCase();
      if ( normalizedMessage.startsWith( 'hey todd' ) || normalizedMessage.startsWith( 'hey sayit' ) ) {
        try {
          const toddResp = await this.sayItService
            .getAIResponse( msg + ' - note: limit response to 155 characters', authorUid );

          const responseText = toddResp && toddResp.response
            ? String( toddResp.response ).trim()
            : '';

          if ( !responseText ) {
            this.logger.warn( '[ChatBoard] SayIt response was empty.', {
              authorUid,
              message: msg
            } );
            return;
          }

          const aiPost: any = {
            user: 'SayIt',
            userId: 'SayIt',
            authorUid: 'SayIt',
            displayName: 'SayIt',
            content: responseText,
            imageUrl: '/assets/avatar-todd-sm.png',
            category: sayItInput.category,
            timestamp: new Date(),
            emailAddress: 'support@taliferro.tech'
          };

          this.logger.info( '[ChatBoard] Adding SayIt auto-reply post.', aiPost );
          await addDoc( collection( getFirestore(), 'posts' ), aiPost );
        } catch ( toddError: any ) {
          this.logger.error( '[ChatBoard] SayIt auto-reply failed.', {
            message: toddError?.message || toddError,
            error: toddError,
            authorUid,
            originalMessage: msg
          } );
          this.notificationService.show(
            'Posted',
            'Your message was posted, but SayIt could not reply right now.',
            'warning'
          );
        }
      }
    } catch ( error: any ) {
      this.notificationService.show(
        'Error!',
        'Failed to post your message.',
        'error'
      );
      this.logger.error( '[ChatBoard] Error posting message.', {
        message: error?.message || error,
        error
      } );
    } finally {
      this.isPosting = false;
      this.soundService.playSound( 'finished' );
    }
  }

  // Say It owns its own compact toolbar; there is no global page-actions bar in the standalone app.
  private refreshPageActions (): void { }

  private scrollBusinessSectionIntoView ( view: 'feed' | 'businesses' | 'newsstand' ): void {
    if ( view !== 'businesses' || !this.isMobileDevice ) return;

    setTimeout( () => {
      const firstBusinessCard = this.businessSection?.nativeElement?.querySelector( '.chat-business-card' ) as HTMLElement | null;
      const scrollTarget = firstBusinessCard || this.businessSection?.nativeElement;

      scrollTarget?.scrollIntoView( {
        behavior: 'smooth',
        block: 'start'
      } );
    }, 100 );
  }

  private get isMobileDevice (): boolean {
    if ( typeof window === 'undefined' ) return false;
    return window.innerWidth <= 768;
  }

  /**
   * Calculates the relative time from the given timestamp to now and returns the formatted distance as a human-readable string with a suffix.
   * For example, If the timestamp is 5 minutes in the past, it returns "5 minutes ago".
   *
   * @param timestamp - The date from which to calculate the relative time.
   * @returns The formatted relative time string.
   */
  getRelativeTime ( timestamp: Date ): string {
    return formatDistanceToNow( new Date( timestamp ), { addSuffix: true } );
  }

  /**
   * Formats the given timestamp into a more readable date and time string.
   * @param timestamp The date object to be formatted.
   * @returns A string representing the date and time in 'PPpp' format.
   */
  getExactTime ( timestamp: Date ): string {
    return format( new Date( timestamp ), 'PPpp' );
  }

  /**
   * Handles file selection from an input element, and uploads the first selected file if available.
   * @param {Event} event - The event triggered by file input selection.
   */
  onFileSelect ( event: Event ) {
    const input = event.target as HTMLInputElement;
    if ( input.files && input.files.length > 0 ) {
      this.uploadFile( input.files[0] );
    }
  }

  /**
   * Handles the drop event for a drag-and-drop file upload interface. It prevents the default
   * browser behavior, stops the event from propagating, removes drag data, and uploads the file
   * if one is present in the event's dataTransfer property.
   * @param {DragEvent} event - The DragEvent object that contains the file to be uploaded.
   */
  onDrop ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
    this.removeDragData( event );
    if ( event.dataTransfer && event.dataTransfer.files.length > 0 ) {
      this.uploadFile( event.dataTransfer.files[0] );
    }
  }

  /**
   * Handles the drag over event by allowing a draggable element to trigger a
   * response in a drop target. It prevents the default behavior,
   * stops the event from bubbling up to parent nodes, and sets the drop effect to 'copy'.
   *
   * @param {DragEvent} event - The event object associated with the drag over action.
   */
  onDragOver ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer!.dropEffect = 'copy';
  }

  /**
   * Handles the drag leave event usually triggered when a draggable element or text selection leaves a valid drop target.
   * It prevents the default browser behavior and stops the event from bubbling.
   * @param {DragEvent} event - The drag event object that contains data about the drag action.
   */
  onDragLeave ( event: DragEvent ) {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Clears the drag data from the event if present.
   * @param {DragEvent} event - The event object associated with the drag event.
   */
  removeDragData ( event: DragEvent ) {
    if ( event.dataTransfer ) {
      event.dataTransfer.clearData();
    }
  }

  /**
   * Initiates the upload of a file to a predefined storage location,
   * handles the upload progress, errors, and the post-upload process
   * which includes updating the user's profile with the new avatar
   * and posting the image. Updates various state variables to reflect
   * the progress and completion of the task.
   * @param {File} file - The file to be uploaded.
   */
  async uploadFile ( file: File ) {
    const uid = this.firebaseUser?.uid || getAuth().currentUser?.uid || 'anon';
    this.downloadPath = `sayit/posts/${uid}/${Date.now()}_${file.name}`;

    const storageRef = ref( this.storage, this.downloadPath );
    const uploadTask = uploadBytesResumable( storageRef, file );

    this.processing = true;

    uploadTask.on(
      'state_changed',
      ( snapshot ) => {
        this.uploadProgress =
          ( snapshot.bytesTransferred / snapshot.totalBytes ) * 100;
      },
      ( error ) => {
        this.processing = false;
        this.logger.error( 'Upload error:', error );
        this.uploadProgress = null;
        this.downloadURL = null;
        this.downloadPath = null;
        this.imageDraft = false;
        this.notificationService.show(
          'Upload failed',
          'The image could not be uploaded. Please try again.',
          'error'
        );
      },
      () => {
        // Step 1: Convert getDownloadURL promise to observable
        from( getDownloadURL( uploadTask.snapshot.ref ) )
          .pipe(
            switchMap( ( downloadURL ) => {
              this.downloadURL = downloadURL;
              this.processing = false;

              // Update photo URL in the user's profile
              return of( null ); // Observable that emits a value and completes
            } )
          )
          .subscribe( {
            next: () => {
              this.imageDraft = true;
              this.notificationService.show(
                'Image attached',
                'Add a caption or text, then click Post to publish.',
                'success'
              );
              this.processing = false;
              this.uploadProgress = null;
            },
            error: ( error ) => {
              this.logger.error( 'Error updating profile avatar:', error );
              this.notificationService.show(
                'Error',
                'Failed to upload image.',
                'error'
              );
              this.processing = false;
              this.uploadProgress = null;
            }
          } );
      }
    );
  }

  /**
   * Posts an image along with associated metadata (user, displayName, content, etc.)
   * to the message service and clears the newMessage field afterwards.
   * If an error occurs, it logs the error.
   *
   * @async
   */

  async postImage () {
    try {
      if ( this.profileGateRequired && this.showProfileIntent ) return;
      // postMessage already handles imageDraft + downloadURL + moderation + persistence
      await this.postMessage();
    } catch ( error ) {
      this.logger.error( 'Error posting image:', error );
    }
  }

  /** Resolve author metadata for denormalization on post write. */
  private resolveAuthorMeta (): {
    authorContactId?: string;
    authorHandle?: string;
  } {
    const meta: { authorContactId?: string; authorHandle?: string; } = {};
    try {
      const p: any = this.sayItProfile || null;

      if ( p?.contactId && String( p.contactId ).trim() ) {
        meta.authorContactId = String( p.contactId ).trim();
      }

      if ( p?.handle && String( p.handle ).trim() ) {
        meta.authorHandle = String( p.handle ).trim().toLowerCase();
        return meta;
      }

      // Fallback: email prefix
      const email = this.firebaseUser?.email || this.user?.email || '';
      const prefix = email.includes( '@' ) ? email.split( '@' )[0] : undefined;
      if ( prefix ) {
        meta.authorHandle = prefix.trim().toLowerCase();
      }
    } catch ( e ) {
      this.logger.warn( 'resolveAuthorMeta error', e );
    }
    return meta;
  }

  /**
   * Fetches multiple RSS feeds, processes the items, and sorts them by date in descending order.
   * Handles errors by logging them and returning an empty array for the problematic feed.
   * Once all feeds are processed, updates the `feedItems` property with the final sorted list.
   * Also manages the `isRSSLoading` state to indicate the loading process to the UI.
   */

  /** Remove the currently attached draft image (before posting). */
  removeDraftImage (): void {
    try {
      this.imageDraft = false;
      this.downloadURL = null;
      this.downloadPath = null;
      this.notificationService.show(
        'Removed',
        'Image removed from draft.',
        'success'
      );
    } catch ( e ) {
      this.logger.warn( 'removeDraftImage error', e );
    }
  }

  /**
   * Initializes video containers on the page by setting up an IntersectionObserver to lazily load
   * video iframes from supported platforms (YouTube, Vimeo, TikTok) when they come into view.
   * It waits one second before starting to ensure elements are rendered. If video containers are
   * missing required data attributes (`data-video-id` or `data-platform`), logs a warning.
   */
  private initializeVideoContainers (): void {
    setTimeout( () => {
      const videos = document.querySelectorAll( '.video-container' );

      if ( videos.length === 0 ) {
        this.logger.warn( 'No video containers found to observe.' );
        return;
      }

      const observer = new IntersectionObserver(
        ( entries ) => {
          entries.forEach( ( entry ) => {
            if ( entry.isIntersecting ) {
              const container = entry.target as HTMLElement;
              const videoId = container.getAttribute( 'data-video-id' );
              const platform = container.getAttribute( 'data-platform' );

              if ( videoId && platform ) {
                let src = '';
                let style = 'style="width: 100%; height: 100%; border: none;"'; // Default to no extra styles

                switch ( platform ) {
                  case 'youtube':
                    src = `https://www.youtube-nocookie.com/embed/${videoId}`;
                    break;
                  case 'vimeo':
                    src = `https://player.vimeo.com/video/${videoId}`;
                    break;
                  case 'tiktok':
                    src = `https://www.tiktok.com/embed/${videoId}`;
                    style =
                      'style="width: 300px; height: 533px; border-radius: 10px"';
                    break;
                }

                container.innerHTML = `
                <iframe src="${src}" 
                        frameborder="0" 
                        allowfullscreen 
                        allow="autoplay; fullscreen; accelerometer; encrypted-media" 
                        scrolling="no" ${style}>
                </iframe>
              `;

                observer.unobserve( container ); // Stop observing this element
              } else {
                this.logger.warn( 'Missing videoId or platform for:', container );
              }
            }
          } );
        },
        {
          root: null,
          rootMargin: '200px 0px',
          threshold: 0.1
        }
      );

      videos.forEach( ( video ) => observer.observe( video ) );
    }, 1000 ); // Allow one event loop cycle for rendering
  }

  async loadSchedulerStatus (): Promise<void> {
    try {
      const db = getFirestore();
      const schedulerRef = doc( db, `tenants/${environment.taliferroTenantId}/sayit-config/scheduler` );
      const snap = await getDoc( schedulerRef );
      this.sayitSchedulerEnabled = snap.exists() ? snap.data()?.['enabled'] !== false : true;
    } catch ( e ) {
      this.logger.warn( '[SayIt] loadSchedulerStatus error', e );
      this.sayitSchedulerEnabled = true;
    }
  }

  async toggleScheduler (): Promise<void> {
    if ( this.sayitSchedulerLoading ) return;
    this.sayitSchedulerLoading = true;
    try {
      const next = !this.sayitSchedulerEnabled;
      const db = getFirestore();
      const schedulerRef = doc( db, `tenants/${environment.taliferroTenantId}/sayit-config/scheduler` );
      await setDoc( schedulerRef, {
        enabled: next,
        updatedAt: new Date().toISOString(),
        updatedBy: this.userId
      }, { merge: true } );
      this.sayitSchedulerEnabled = next;
      this.notificationService.show(
        'Scheduler',
        `Random post scheduler ${next ? 'enabled' : 'disabled'}.`,
        'success'
      );
    } catch ( e ) {
      this.logger.error( '[SayIt] toggleScheduler error', e );
      this.notificationService.show( 'Error', 'Could not update scheduler.', 'error' );
    } finally {
      this.sayitSchedulerLoading = false;
    }
  }

}
