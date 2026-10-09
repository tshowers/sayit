import {
  Component,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  OnChanges,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoggerService } from '../../services/logger.service';
import { RouterModule } from '@angular/router';

import { Post } from '../../shared/models/message.model';
import { Email } from '../../shared/models/email.model';
import { environment } from '../../../environments/environment';
import { EmailService } from '../../services/email.service';
import { SayItDataService } from '../../services/sayit-data.service';
import { GetVideoIconPipe } from '../../pipes/get-video-icon.pipe';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { AIContentExtractorPipe } from '../../pipes/aicontent-extractor.pipe';
import { FormatAITextPipe } from '../../pipes/format-aitext.pipe';
import { LinkifyPipe } from '../../pipes/linkify-pipe';

import { ExactTimePipe } from '../../pipes/exact-time.pipe';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';
import { SafeVideoUrlPipe } from '../../pipes/safe-video-url-pipe';
import { postLinkUrl, postVideo, textWithoutLink, videoEmbedUrl, videoThumbnail } from '../../shared/post-link';
import { NotificationService } from '../../services/notification.service';
import { SayItService, SayItComment } from '../../services/say-it-service';
import { SoundService } from '../../services/sound.service';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';
import {
  buildSayitPostUrl,
  getSayitHomeUrl,
  getToddHomeUrl
} from '../../shared/public-app-url.util';


@Component( {
  selector: 'app-post-displayer',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SafeVideoUrlPipe,
    FormatAITextPipe,
    RelativeTimePipe,
    ExactTimePipe,
    LinkifyPipe,
    TruncatePipe,
    AIContentExtractorPipe, ClickSoundDirective],
  standalone: true,
  templateUrl: './post-displayer.component.html',
  styleUrl: './post-displayer.component.css',
} )
export class PostDisplayerComponent implements OnChanges {

  @Input() visiblePosts: any[] = []; // Posts currently visible in the UI
  @Input() showMineOnly: boolean = false;
  @Input() isLoggedIn: boolean = false;
  @Input() firebaseUser: any;
  @Input() favoritePostIds: string[] = [];
  @Input() currentUserId: string | null = null;
  @ViewChild( 'horizontalScrollContainer' ) horizontalScrollContainer?: ElementRef<HTMLDivElement>;
  @Output() id = new EventEmitter();

  @Output() favorite = new EventEmitter<Post>();
  @Output() unfavorite = new EventEmitter<Post>();

  /** Fast lookup for current user's favorites passed down from the parent/profile. */
  private favoritePostIdSet = new Set<string>();
  private previousVisiblePostSignature = '';


  lightboxImage: string | null = null;
  isImageLightboxOpen: boolean = false;

  get footer (): string {
    const appLabel = this.isSayItRoute() ? 'SayIt' : 'TODD';
    const appUrl = this.isSayItRoute()
      ? getSayitHomeUrl()
      : getToddHomeUrl();

    return `<hr><div style="text-align: center; margin-top: 10px; font-size: 0.7em; color: #777777; padding: 10px 0;">
  <p>
    © 2024 
    <a href="https://taliferro.com/" style="color: #1a73e8; text-decoration: none;">Taliferro</a>. 
    Email sent from 
    <a href="${appUrl}" style="color: #1a73e8; text-decoration: none;">${appLabel}</a>. 
    <span style="white-space: nowrap;">taliferro-tech-unsubscribe.</span>

    </p>
</div>
`;
  }

  lightboxVideoUrl: string | null = null;
  isVideoLightboxOpen: boolean = false;

  /** Prevent double-submits per post when sending interest. */
  private interestBusyIds = new Set<string>();

  // Comment state keyed by post ID
  commentsByPostId: Record<string, SayItComment[]> = {};
  commentDraftByPostId: Record<string, string> = {};
  commentLoadedPostIds = new Set<string>();
  commentBusyPostIds = new Set<string>();

  /** Lightweight UI state if the template wants to show a spinner later. */
  isExpressingInterestFor ( post: any ): boolean {
    const id = post?.id ? String( post.id ) : '';
    return !!id && this.interestBusyIds.has( id );
  }

  constructor (
    private router: Router,
    private logger: LoggerService,
    private emailService: EmailService,
    private dataService: SayItDataService,
    private notificationService: NotificationService,
    private sayItService: SayItService,
    private soundService: SoundService
  ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['favoritePostIds'] ) {
      const ids = Array.isArray( this.favoritePostIds ) ? this.favoritePostIds : [];
      this.favoritePostIdSet = new Set(
        ids
          .map( id => String( id || '' ).trim() )
          .filter( id => !!id )
      );
    }
    if ( changes['visiblePosts'] ) {
      this.scrollToNewestPostIfNeeded();
    }
  }

  private scrollToNewestPostIfNeeded (): void {
    const signature = ( Array.isArray( this.visiblePosts ) ? this.visiblePosts : [] )
      .map( post => String( post?.id || '' ).trim() )
      .filter( id => !!id )
      .join( '|' );

    if ( !signature || signature === this.previousVisiblePostSignature ) {
      return;
    }

    this.previousVisiblePostSignature = signature;

    setTimeout( () => {
      this.scrollToNewestPost();
    }, 0 );
  }

  private scrollToNewestPost (): void {
    const container = this.horizontalScrollContainer?.nativeElement;
    if ( !container ) return;

    try {
      container.scrollTo( {
        left: 0,
        behavior: 'smooth'
      } );
    } catch {
      container.scrollLeft = 0;
    }
  }

  isFavorited ( post: Post ): boolean {
    const postId = post?.id ? String( post.id ).trim() : '';
    return !!postId && this.favoritePostIdSet.has( postId );
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

  trackById ( index: number, post: any ): string {
    return post.id; // Use the unique 'id' to track each post
  }

  // ─── Card view helpers (Organic "overlay + rail" card, matching the iOS app) ───

  /** Posts the visitor marked "I'm interested" this session. */
  private interestedIds = new Set<string>();
  /** Flagged posts the visitor chose to view anyway. */
  private revealedIds = new Set<string>();
  /** The card whose comment sheet is open. */
  openCommentsPostId: string | null = null;

  private readonly videoIconPipe = new GetVideoIconPipe();

  /**
   * What fills the card: a video thumbnail (YouTube/Vimeo, played in place),
   * a photo, a link preview image, a link with no image (its title is the
   * visual), or nothing (a text post).
   */
  cardMedia ( post: any ): { type: 'video' | 'image' | 'link' | 'link-text' | 'none'; src: string; } {
    const video = postVideo( post );
    if ( video ) {
      return { type: 'video', src: post?.linkPreview?.image || videoThumbnail( video ) || this.videoIconPipe.transform( postLinkUrl( post ) || '' ) };
    }
    const url = String( post?.linkPreview?.url || '' );
    if ( post?.postImageUrl && !url ) {
      return { type: 'image', src: post.postImageUrl };
    }
    if ( url && post?.linkPreview?.image ) {
      return { type: 'link', src: post.linkPreview.image };
    }
    if ( url && post?.linkPreview?.title ) {
      return { type: 'link-text', src: '' };
    }
    return { type: 'none', src: '' };
  }

  openCardMedia ( post: any ): void {
    const media = this.cardMedia( post );
    if ( media.type === 'video' ) {
      this.toggleOnSelection();
      this.openPostVideo( post );
    } else if ( media.type === 'image' ) {
      this.toggleOnSelection();
      this.openLightbox( media.src );
    } else if ( media.type === 'link' || media.type === 'link-text' ) {
      window.open( post.linkPreview.url, '_blank', 'noopener' );
    }
  }

  /** The post's words without the link the card already shows. */
  captionText ( post: any ): string {
    return textWithoutLink( post );
  }

  /** "YouTube", "ESPN.com"… shown above a link or video title. */
  linkSite ( post: any ): string {
    const site = String( post?.linkPreview?.siteName || '' ).trim();
    if ( site ) return site;
    try {
      return new URL( String( post?.linkPreview?.url || '' ) ).hostname.replace( /^www\./, '' );
    } catch {
      return '';
    }
  }

  /** Plays a YouTube/Vimeo post in the theater-mode player. */
  openPostVideo ( post: any ): void {
    const video = postVideo( post );
    if ( !video ) return;
    this.isImageLightboxOpen = false;
    this.lightboxImage = null;
    this.lightboxVideoUrl = videoEmbedUrl( video );
    this.isVideoLightboxOpen = true;
  }

  /** Category as a small tag ("Hiring", "Food"…); hidden for the catch-all bucket. */
  cardKind ( post: any ): string {
    const category = String( post?.category || '' ).trim();
    return !category || category.toLowerCase() === 'all' ? '' : category;
  }

  /** Author photo, or '' to fall back to initials (the generic no-photo icon clashes with the card). */
  avatarUrl ( post: any ): string {
    const url = String( post?.authorImageUrl || post?.imageUrl || '' ).trim();
    return url && !url.includes( 'nophoto' ) ? url : '';
  }

  initials ( post: any ): string {
    const words = this.getAssistantLabel( post ).replace( /[^\p{L}\p{N}\s]/gu, ' ' ).split( /\s+/ ).filter( Boolean );
    return ( ( words[0]?.[0] || '' ) + ( words[1]?.[0] || '' ) ).toUpperCase() || '?';
  }

  likesLabel ( post: any ): string {
    const n = Number( post?.favoriteCount || 0 );
    return n >= 1000 ? ( n / 1000 ).toFixed( 1 ).replace( '.0', '' ) + 'k' : String( n );
  }

  toggleLike ( post: Post, event?: Event ): void {
    if ( this.isFavorited( post ) ) {
      event?.stopPropagation();
      this.removeFavorite( post );
    } else {
      this.favoritePost( post, event );
    }
  }

  isInterested ( post: any ): boolean {
    return this.interestedIds.has( String( post?.id || '' ) );
  }

  isFlagged ( post: any ): boolean {
    return Number( post?.contentRating || 0 ) >= 4 && !this.revealedIds.has( String( post?.id || '' ) );
  }

  revealPost ( post: any ): void {
    this.revealedIds.add( String( post?.id || '' ) );
  }

  isOwnPost ( post: any ): boolean {
    const uid = this.firebaseUser?.uid;
    return !!uid && uid === ( post?.userId || post?.user );
  }

  toggleComments ( post: any ): void {
    const postId = String( post?.id || '' );
    this.openCommentsPostId = this.openCommentsPostId === postId ? null : postId;
  }

  areCommentsOpen ( post: any ): boolean {
    return this.openCommentsPostId === String( post?.id || '' );
  }

  isAssistantPost ( post: any ): boolean {
    const values = [
      post?.user,
      post?.userId,
      post?.authorUid,
      post?.displayName,
    ]
      .map( value => String( value || '' ).trim().toLowerCase() )
      .filter( value => !!value );

    return values.includes( 'todd' ) || values.includes( 'sayit' );
  }

  getAssistantLabel ( post: any ): string {
    if ( this.isSayItRoute() && this.isAssistantPost( post ) ) {
      return 'SayIt';
    }

    return String( post?.displayName || post?.user || '' ).trim() || 'Assistant';
  }

  private isSayItRoute (): boolean {
    return String( this.router.url || '' ).includes( '/say-it' );
  }

  private buildPostShareUrl ( post: Post ): string {
    const postId = post?.id ? String( post.id ).trim() : '';
    return postId
      ? buildSayitPostUrl( postId )
      : window.location.href;
  }

  getBusinessProfileIdentifier ( post: any ): string {
    return String(
      post?.authorUid ||
      post?.userId ||
      post?.uid ||
      post?.authorHandle ||
      post?.displayName ||
      ''
    ).trim();
  }

  getBusinessProfileRoute ( post: any ): any[] {
    const identifier = this.getBusinessProfileIdentifier( post );
    return ['/business', identifier];
  }

  /**
   * Retrieves an appropriate icon based on the given rating.
   * @param {number} rating - The rating score, where 1 is acceptable and 5 is highly inappropriate.
   * @returns {string} The icon representing the rating as a single character.
   */
  getRatingIcon ( rating: number ): string {
    switch ( rating ) {
      case 1:
        return '✅'; // Checkmark for acceptable
      case 2:
        return '⚠️'; // Warning for slightly inappropriate
      case 3:
        return '❌'; // Cross for inappropriate
      case 4:
        return '⚡'; // Lightning for very inappropriate
      case 5:
        return '🔥'; // Fire for highly inappropriate
      default:
        return '❓'; // Question mark for unknown
    }
  }

  /**
   * Closes the lightbox and stops video playback by clearing the video URL.
   */
  closeLightbox () {
    this.isVideoLightboxOpen = false;
    this.lightboxVideoUrl = null;
    this.isImageLightboxOpen = false;
    this.lightboxImage = null;
  }

  @HostListener( 'document:keydown.escape' )
  onEscapeKey (): void {
    if ( this.isVideoLightboxOpen ) {
      this.closeLightbox();
    }
  }

  private buildLightboxVideoUrl ( videoUrl: string ): string | null {
    const platform = this.getPopUpVideoPlatform( videoUrl );
    this.logger.info( 'Extracted platform', platform );

    if ( platform === 'youtube' ) {
      const videoId = this.extractLightBoxVideoId( videoUrl, 'youtube' );
      this.logger.info(
        'YouTube VideoId generated',
        videoId,
        'Link is',
        videoUrl
      );
      return videoId
        ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
        : null;
    }

    if ( platform === 'vimeo' ) {
      const videoId = this.extractLightBoxVideoId( videoUrl, 'vimeo' );
      return videoId
        ? `https://player.vimeo.com/video/${videoId}?autoplay=1`
        : null;
    }

    if ( platform === 'tiktok' ) {
      const videoId = this.extractLightBoxVideoId( videoUrl, 'tiktok' );
      return videoId
        ? `https://www.tiktok.com/embed/v2/${videoId}`
        : null;
    }

    return null;
  }

  private openVideoInLightbox ( videoUrl: string, source: any ): void {
    const embedUrl = this.buildLightboxVideoUrl( videoUrl );

    if ( !embedUrl ) {
      this.logger.info( 'No video ID could be extracted.', source );
      return;
    }

    if ( this.isVideoLightboxOpen && this.lightboxVideoUrl === embedUrl ) {
      return;
    }

    this.isImageLightboxOpen = false;
    this.lightboxImage = null;
    this.lightboxVideoUrl = embedUrl;
    this.isVideoLightboxOpen = true;
    this.logger.info( 'LightboxVideo', this.lightboxVideoUrl );
  }

  openLightbox ( imageSrc: string ): void {
    this.isVideoLightboxOpen = false;
    this.lightboxVideoUrl = null;
    this.lightboxImage = imageSrc;
    this.isImageLightboxOpen = true;
  }

  /**
   * Returns a description for a given rating value.
   * @param {number} rating - An integer from 1 to 5 indicating the level of inappropriateness.
   * @return {string} A string that describes the inappropriateness level of the rating.
   */
  getRatingDescription ( rating: number ): string {
    switch ( rating ) {
      case 1:
        return 'Appropriate, respectful, and suitable for all audiences. Aligns with professional and social norms.';
      case 2:
        return 'Could be slightly questionable or awkward, but not clearly offensive. May depend on personal or cultural interpretation. A joke or phrase that could be misinterpreted but isn’t intentionally inappropriate.';
      case 3:
        return 'Unsuitable or offensive for certain audiences. Contains language or ideas that may alienate or upset some users. Mildly insensitive jokes or phrases that can be considered rude in formal settings.';
      case 4:
        return 'Not suitable for professional or public use. Unacceptable language, themes, or imagery in most contexts. Strong profanity or explicit language that breaches community standards.';
      case 5:
        return 'Highly objectionable content that causes significant discomfort or harm to a majority of users. Aggressive language, derogatory remarks, or discriminatory statements.';
      case 6:
        return 'Extreme content requiring immediate action, such as hate speech, threats, or violations of legal or platform guidelines. Racist slurs, threats of violence, or hateful content.';
      default:
        return 'Unable to rate content';
    }
  }

  getPostTypeLabel ( post: any ): string {
    const content = String( post?.content || '' ).toLowerCase();

    if ( /\b(welcome|everybody welcome|say hi|meet|welcome to sayit|new member|joined sayit|joined)\b/.test( content ) ) return 'Welcome';
    if ( /\b(hiring|job opening|apply|join our team)\b/.test( content ) ) return 'Hiring';
    if ( /\b(looking for|need|seeking|recommend|who knows|anyone know)\b/.test( content ) ) return 'Ask';
    if ( /\b(launch|launched|announce|announcing|new release|opening now)\b/.test( content ) ) return 'Announcement';
    if ( /\b(available|offering|we help|i help|book now|for sale|sell)\b/.test( content ) ) return 'Offer';
    return 'Post';
  }

  getPostTrustLabel ( post: any ): string {
    if ( post?.linkPreview?.url ) return 'Linked source';
    if ( post?.postImageUrl ) return 'Image post';
    return 'TODD post';
  }

  /** Analytics: track when a user clicks into a profile from a post card. */
  trackProfileClick ( post: Post, profileUrl: any ): void {
    try {
      const payload = {
        postId: post?.id,
        authorId: ( post as any )?.userId || post?.user,
        authorUid: ( post as any )?.authorUid,
        authorHandle: ( post as any )?.authorHandle,
        authorContactId: ( post as any )?.authorContactId,
        profileIdentifier: this.getBusinessProfileIdentifier( post ),
        route: Array.isArray( profileUrl )
          ? profileUrl.join( '/' )
          : String( profileUrl || '' ),
        ts: new Date().toISOString(),
      };
      this.logger.info( 'profile_view_clicked', payload );
      // TODO: send to real analytics service when available
    } catch ( e ) {
      this.logger.warn( 'trackProfileClick error', e );
    }
  }

  /**
   * Toggles the 'blur-content' class on the given HTMLDivElement.
   * This function adds the class if it's not present, and removes it if it is,
   * effectively toggling a blur effect on and off.
   * @param {HTMLDivElement} postContent - The div element to toggle the blur effect on.
   */
  toggleBlur ( postContent: HTMLDivElement, button: EventTarget | null ): void {
    if ( !button || !( button instanceof HTMLButtonElement ) ) return; // Guard clause to ensure button is valid

    if ( postContent.classList.contains( 'blur-content' ) ) {
      postContent.classList.remove( 'blur-content' ); // Remove the blur class
      button.textContent = 'Hide'; // Update button text
    } else {
      postContent.classList.add( 'blur-content' ); // Add the blur class back
      button.textContent = 'View'; // Update button text
    }
  }

  /**
   * Triggers the deletion process for a given post and handles the user confirmation.
   * If the user confirms the action, it attempts to delete the post and shows appropriate notifications based on the outcome.
   * @param {Post} post - The post object to delete.
   */
  onDelete ( post: Post ) {
    const userConfirmed = confirm(
      `Are you sure you want to delete this Post - "${post.content}"`
    );
    if ( userConfirmed ) {
      this.dataService
        .deleteMessage( post.id )
        .then( () => {
          this.logger.info( 'Deleting', post );
          this.notificationService.show( 'Success', 'Post Deleted', 'success' );
        } )
        .catch( ( error ) => {
          this.notificationService.show( 'Error', 'Failed to Delete Post', 'error' );
        } );
    }
  }


  /**
   * Event handler for image loading error.
   * Hides the image element if an error occurs during image loading.
   *
   * @param {Event} event - The event object associated with the error.
   */
  onImageError ( event: Event ): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none'; // Hide the image if it's invalid
  }

  favoritePost ( post: Post, event?: Event ): void {
    try {
      event?.preventDefault();
      event?.stopPropagation();
    } catch { }

    if ( !this.isLoggedIn || !this.firebaseUser?.uid ) {
      this.notificationService.show(
        'Error!',
        'You must be logged in to favorite a post.',
        'error'
      );
      return;
    }

    const postId = post?.id ? String( post.id ).trim() : '';
    if ( !postId ) {
      this.notificationService.show( 'Error!', 'Invalid post.', 'error' );
      return;
    }

    this.logger.info( 'Looking for this post user favored', post );

    if ( this.isFavorited( post ) ) {
      this.notificationService.show(
        'Info',
        'This post is already in your favorites.',
        'info'
      );
      return;
    }

    this.favorite.emit( post );
  }

  removeFavorite ( favorite: Post ): void {
    if ( !this.isLoggedIn || !this.firebaseUser?.uid ) {
      this.notificationService.show(
        'Error!',
        'You must be logged in to update favorites.',
        'error'
      );
      return;
    }

    const favoriteId = favorite?.id ? String( favorite.id ).trim() : '';
    if ( !favoriteId ) {
      this.notificationService.show( 'Error!', 'Invalid post.', 'error' );
      return;
    }

    if ( !this.favoritePostIdSet.has( favoriteId ) ) {
      this.logger.warn( `Favorite ID: ${favoriteId} not found in favoritePostIds.` );
      return;
    }

    this.unfavorite.emit( favorite );
  }

  /**
   * Sends a favorite notification email to the author of a post.
   * The function checks if the post has an associated user and email address
   * before constructing and sending an email to notify the user that their post
   * was favored. Notifications are logged and sent asynchronously.
   * @param post - The post object containing the user and email details.
   */
  sendFavoriteNotification ( post: Post ): void {
    // Ensure the post has a user to notify
    if ( !post.user ) {
      this.logger.warn( 'Post user not found. Cannot send notification.' );
      return;
    }

    if ( !post.emailAddress ) {
      this.logger.warn(
        'Post email address not found. Cannot send notification.'
      );
      return;
    }

    if ( !this.firebaseUser?.uid ) {
      this.logger.warn( 'Firebase user not found. Cannot send favorite notification.' );
      return;
    }

    // Construct the email details
    const email: Email = {
      to: post.emailAddress,
      subject: 'Your post was favored!',
      html: `<p>Hi ${post.displayName || 'there'},</p>
                 <p>${this.firebaseUser?.displayName || 'Someone'
        } has favored your <a title="Click to see your post" href="${environment.PLATFORM_URL
        }/post/${post.id}">post</a>: </p><p>"<b>${post.content}</b>"</p>
                 <p>Keep sharing great content!</p>
                 <p>Best regards,</p>
                 <p>SayIt - The Taliferro Tech Team</p>`,
      from: 'noreply@taliferro.tech',
    };

    email.html += this.footer;

    this.logger.info( 'Send email notification', email );
    this.emailService
      .sendEmail( email, environment.taliferroTenantId, this.firebaseUser.uid )
      .subscribe( {
        next: () => this.logger.info( 'Notification email sent successfully.' ),
        error: ( err ) =>
          this.logger.error( 'Failed to send notification email:', err ),
      } );
  }

  /**
   * Creates an interest record for a post ("I'm interested").
   * This is meant to be invoked by the post card UI.
   */
  async expressInterest ( post: Post, message: string = '' ): Promise<void> {
    if ( !this.isLoggedIn || !this.firebaseUser?.uid ) {
      this.notificationService.show(
        'Error',
        'You must be logged in to show interest.',
        'error'
      );
      return;
    }

    const postId = post?.id ? String( post.id ) : '';
    if ( !postId ) {
      this.notificationService.show( 'Error', 'Invalid post.', 'error' );
      return;
    }

    // Prevent accidental double clicks
    if ( this.interestBusyIds.has( postId ) ) return;
    this.interestBusyIds.add( postId );

    try {
      const cleanedMsg = ( message || '' ).trim();
      const postUrl = ( typeof window !== 'undefined' )
        ? `${window.location.origin}/post/${encodeURIComponent( postId )}`
        : undefined;

      const overrides: any = {
        postId,
        postAuthorUid: String( ( post as any )?.authorUid || ( post as any )?.userId || ( post as any )?.user || '' ),
        postCategory: String( ( post as any )?.category || 'all' ),
        postPreview: ( post as any )?.content ? String( ( post as any ).content ).slice( 0, 160 ) : '',
        postAuthorHandle: ( post as any )?.authorHandle ? String( ( post as any ).authorHandle ) : undefined,
        postAuthorDisplayName: ( post as any )?.displayName ? String( ( post as any ).displayName ) : undefined,
        postAuthorEmail: ( post as any )?.emailAddress ? String( ( post as any ).emailAddress ) : undefined,
        postUrl,
        message: cleanedMsg,
        interestedDisplayName: this.firebaseUser?.displayName ? String( this.firebaseUser.displayName ) : undefined,
        interestedHandle: ( this.firebaseUser?.email && String( this.firebaseUser.email ).includes( '@' ) )
          ? String( this.firebaseUser.email ).split( '@' )[0].toLowerCase()
          : undefined,
        interestedUid: String( this.firebaseUser?.uid || '' ),
        interestedPhotoURL: this.firebaseUser?.photoURL ? String( this.firebaseUser.photoURL ) : undefined,
        createdAt: new Date().toISOString(),
      };

      await this.sayItService.createPostInterest( post as any, cleanedMsg, overrides );

      const recipientEmail = overrides?.postAuthorEmail ? String( overrides.postAuthorEmail ).trim() : '';
      if ( recipientEmail ) {
        this.emailService
          .sendPostInterestEmail( recipientEmail, String( this.firebaseUser.uid ), overrides )
          .subscribe();
      } else {
        this.logger.warn( 'Post interest email skipped: missing post author email.', { postId } );
      }

      this.interestedIds.add( postId );
      this.notificationService.show(
        'Added to inbox',
        `Interest sent. Message ${String( post?.displayName || 'the author' ).split( ' ' )[0]} from your inbox.`,
        'success'
      );
    } catch ( e ) {
      this.logger.error( 'expressInterest error', e );
      this.notificationService.show(
        'Error',
        'Could not send interest. Please try again.',
        'error'
      );
    } finally {
      this.interestBusyIds.delete( postId );
    }
  }

  /** Convenience wrapper when the UI uses a click; optionally captures a short note. */
  onInterestedClick ( post: Post, event?: Event ): void {
    try {
      event?.preventDefault();
      event?.stopPropagation();
    } catch { }

    if ( !this.isLoggedIn || !this.firebaseUser?.uid ) {
      this.notificationService.show( 'Error', 'You must be logged in to show interest.', 'error' );
      return;
    }

    const note = ( typeof window !== 'undefined' )
      ? window.prompt( 'Add a short note for the author (optional):', '' )
      : '';

    void this.expressInterest( post, ( note || '' ).trim() );
  }

  /**
   * Increment the `favoriteCount` on a given post object and perform associated logging and message service update.
   * @param post The post object to increment favorite count.
   */
  incrementFavoriteCount ( post: Post ): void {
    this.logger.info( 'Post to favor', post );

    if ( post && post.id ) {
      if ( !post.favoriteCount ) {
        this.logger.info( 'increment favor count' );
        post.favoriteCount = 0;
      }
      post.favoriteCount++;
      this.dataService.updateMessage( post.id, post );
    }
  }

  extractUrl ( content: string ): string | null {
    if ( !content ) return null;

    // Match URLs in the content (e.g., YouTube, Vimeo, TikTok, etc.)
    const urlMatch = content.match( /https?:\/\/[^\s]+/ );
    return urlMatch ? urlMatch[0] : null;
  }

  getPopUpVideoPlatform ( url: string ): string | null {
    if ( !url ) return null;

    // Check for YouTube (full and shortened URLs)
    if ( url.includes( 'youtube.com' ) || url.includes( 'youtu.be' ) )
      return 'youtube';

    // Check for Vimeo
    if ( url.includes( 'vimeo.com' ) ) return 'vimeo';

    // Check for TikTok
    if ( url.includes( 'tiktok.com' ) ) return 'tiktok';

    return null; // Return null if no platform is matched
  }

  shareContent ( post: Post ): void {
    if ( navigator.share ) {
      const shareData = {
        title: post.linkPreview?.title || 'Check this out!',
        text: post.content || '',
        url: this.buildPostShareUrl( post )
      };

      this.logger.info( 'Sharing', shareData );

      // Call the Web Share API
      navigator
        .share( shareData )
        .then( () => {
          this.notificationService.show(
            'Success',
            'Content shared successfully!',
            'success'
          );
        } )
        .catch( ( error ) => {
          this.notificationService.show(
            'Share Canceled',
            'The share was canceled because you either double-clicked accidentally or clicked outside the share button.',
            'warning'
          );
          this.logger.error( 'Error sharing content:', error );
        } );
    } else {
      this.notificationService.show(
        'Error',
        'Sharing is not supported on this device.',
        'error'
      );
    }
  }

  /**
   * Initiates the sharing of news content using the Web Share API.
   * Displays a notification based on the result of the share action.
   *
   * @param {any} item - The item containing details to be shared.
   *                       This object should have `title`, `description`, and `link` properties.
   */
  shareNewsStandContent ( item: any ): void {
    if ( navigator.share ) {
      // Construct the sharing data
      const shareData = {
        title: item.title || 'Check this out!',
        text: item.description || '',
        url: item.link || window.location.href,
      };

      // Call the Web Share API
      navigator
        .share( shareData )
        .then( () => {
          this.notificationService.show(
            'Success',
            'Content shared successfully!',
            'success'
          );
        } )
        .catch( ( error ) => {
          this.notificationService.show(
            'Share Canceled',
            'The share was canceled because you either double-clicked accidentally or clicked outside the share button.',
            'warning'
          );
          this.logger.error( 'Error sharing content:', error );
        } );
    } else {
      this.notificationService.show(
        'Error',
        'Sharing is not supported on this device.',
        'error'
      );
    }
  }

  /**
   * Extract the unique video ID from the provided URL of a supported platform (YouTube, Vimeo, TikTok).
   * @param {string} url - The URL from which to extract the video ID.
   * @param {string} platform - The platform type (e.g. 'youtube', 'vimeo', 'tiktok').
   * @returns {string | null} The extracted video ID, or null if no valid ID is found or the platform is not supported.
   */
  extractLightBoxVideoId ( url: string, platform: string ): string | null {
    if ( !url ) return null;

    if ( platform === 'youtube' ) {
      // Match both full and shortened YouTube URLs
      const match = url.match( /(?:v=|\/)([a-zA-Z0-9_-]{11})/ );
      const videoId = match ? match[1] : null;
      this.logger.log(
        `YouTube Video ID extracted: ${videoId}, from URL: ${url}`
      );
      return videoId;
    }

    if ( platform === 'vimeo' ) {
      const match = url.match( /vimeo\.com\/(\d+)/ );
      const videoId = match ? match[1] : null;
      this.logger.log( `Vimeo Video ID extracted: ${videoId}, from URL: ${url}` );
      return videoId;
    }

    if ( platform === 'tiktok' ) {
      const match = url.match( /\/video\/(\d+)/ );
      const videoId = match ? match[1] : null;
      this.logger.log(
        `TikTok Video ID extracted: ${videoId}, from URL: ${url}`
      );
      return videoId;
    }

    this.logger.log( `No matching platform found for URL: ${url}` );
    return null;
  }

  async loadComments ( post: any ): Promise<void> {
    const postId = post?.id ? String( post.id ) : '';
    if ( !postId || this.commentLoadedPostIds.has( postId ) ) return;
    this.commentLoadedPostIds.add( postId );
    try {
      this.commentsByPostId[postId] = await this.sayItService.getComments( postId );
    } catch ( e ) {
      this.logger.warn( 'loadComments error', e );
      this.commentsByPostId[postId] = [];
    }
  }

  getComments ( post: any ): SayItComment[] {
    const postId = post?.id ? String( post.id ) : '';
    if ( !postId ) return [];
    if ( !this.commentLoadedPostIds.has( postId ) ) {
      void this.loadComments( post );
    }
    return this.commentsByPostId[postId] || [];
  }

  commentCount ( post: any ): number {
    const postId = post?.id ? String( post.id ) : '';
    return ( this.commentsByPostId[postId] || [] ).length;
  }

  getCommentDraft ( post: any ): string {
    return this.commentDraftByPostId[post?.id] || '';
  }

  setCommentDraft ( post: any, value: string ): void {
    this.commentDraftByPostId[post.id] = value;
  }

  isPostingComment ( post: any ): boolean {
    return this.commentBusyPostIds.has( String( post?.id || '' ) );
  }

  async submitComment ( post: any ): Promise<void> {
    const postId = post?.id ? String( post.id ) : '';
    const draft = ( this.commentDraftByPostId[postId] || '' ).trim();
    if ( !postId || !draft || this.commentBusyPostIds.has( postId ) ) return;

    this.commentBusyPostIds.add( postId );
    try {
      await this.sayItService.addComment( postId, draft );
      this.commentDraftByPostId[postId] = '';
      // Reload comments after submit
      this.commentLoadedPostIds.delete( postId );
      this.commentsByPostId[postId] = await this.sayItService.getComments( postId );
      this.commentLoadedPostIds.add( postId );
    } catch ( e ) {
      this.logger.error( 'submitComment error', e );
      this.notificationService.show( 'Error', 'Could not post comment. Please try again.', 'error' );
    } finally {
      this.commentBusyPostIds.delete( postId );
    }
  }

  async onDeleteComment ( post: any, comment: SayItComment ): Promise<void> {
    const postId = post?.id ? String( post.id ) : '';
    if ( !postId || !comment.commentId ) return;
    try {
      await this.sayItService.deleteComment( postId, comment.commentId, this.currentUserId || '' );
      const list = this.commentsByPostId[postId] || [];
      this.commentsByPostId[postId] = list.filter( ( c ) => c.commentId !== comment.commentId );
    } catch ( e ) {
      this.logger.error( 'deleteComment error', e );
    }
  }

  /**
  * Opens a lightbox modal with a video player based on the news item provided.
  * The function first determines if there's an available video URL, extracts the platform from the URL, and identifies the correct video ID.
  * It then constructs the relevant video embed URL and executes the bootstrap modal to display the content.
  * @param item - The news item object which contains the video to be displayed in the lightbox.
  */
  openNewsVideoLightbox ( item: any ) {
    if ( !item ) return;

    this.logger.info( 'Passed News Item', item );

    const videoUrl = this.extractUrl( item.link );
    this.logger.info( 'Extracted video URL', videoUrl );

    if ( !videoUrl ) {
      this.logger.info( 'No valid video URL found in post.', item );
      return;
    }

    this.openVideoInLightbox( videoUrl, item );
  }
}
