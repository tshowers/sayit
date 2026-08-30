import {
  Component,
  Input, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IsVideoLinkPipe } from '../../pipes/is-video-link.pipe';
import { LoggerService } from '../../services/logger.service';
import { Router, RouterModule } from '@angular/router';

import { Post } from '../../shared/models/message.model';
import { SayItDataService } from '../../services/sayit-data.service';
import { Email } from '../../shared/models/email.model';
import { environment } from '../../../environments/environment';
import { EmailService } from '../../services/email.service';
import { GetVideoPlatformPipe } from '../../pipes/get-video-platform.pipe';
import { ExtractVideoIdPipe } from '../../pipes/extract-video-id.pipe';
import { GetVideoIconPipe } from '../../pipes/get-video-icon.pipe';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { AIContentExtractorPipe } from '../../pipes/aicontent-extractor.pipe';
import { FormatAITextPipe } from '../../pipes/format-aitext.pipe';
import { LinkifyPipe } from '../../pipes/linkify-pipe';
import { AuthorProfileUrlPipe } from '../../pipes/author-profile-url.pipe';
import { ExactTimePipe } from '../../pipes/exact-time.pipe';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';
import { SafeVideoUrlPipe } from '../../pipes/safe-video-url-pipe';
import { NotificationService } from '../../services/notification.service';
import {
  catchError,
  concatMap,
  from,
  map,
  of,
  reduce, timer
} from 'rxjs';
import { RssFeedService } from '../../services/rss-feed.service';
import {
  buildSayitShareUrl,
  getSayitHomeUrl,
  getToddHomeUrl
} from '../../shared/public-app-url.util';

declare var bootstrap: any;

@Component( {
  selector: 'app-news-displayer',
  imports: [
    CommonModule,
    RouterModule,
    IsVideoLinkPipe,
    SafeVideoUrlPipe,
    FormatAITextPipe,
    RelativeTimePipe,
    ExactTimePipe,
    LinkifyPipe,
    AuthorProfileUrlPipe,
    GetVideoPlatformPipe,
    ExtractVideoIdPipe,
    TruncatePipe,
    GetVideoIconPipe,
    AIContentExtractorPipe,
  ],
  standalone: true,
  templateUrl: './news-displayer.component.html',
  styleUrl: './news-displayer.component.css'
} )
export class NewsDisplayerComponent implements OnInit {

  newsPosts: any[] = [];
  @Input() isLoggedIn: boolean = false;
  @Input() userId: any;
  @Input() firebaseUser: any;
  @Input() currentUserContact!: any;
  @Input() displayName!: string;

  feedItems: any[] = [];
  totalPosts: number = 0;
  showNewsstandAvailable: boolean = false;
  newMessage: string = '';
  isPosting = false;

  isRSSLoading: boolean = true;
  rssTotal: number = 0;
  rssLoaded: number = 0; // count of processed feeds (success or failure)
  rssFailed: number = 0;


  lightboxImage: string | null = null;

  get footer (): string {
    const appLabel = this.isSayItRoute() ? 'SayIt' : 'TODD';
    const appUrl = this.isSayItRoute()
      ? getSayitHomeUrl()
      : getToddHomeUrl();

    return `<hr><div style="text-align: center; margin-top: 10px; font-size: 0.7em; color: #777777; padding: 10px 0;">
    <p>
      © 2024 
      <a href="https://taliferro.com" style="color: #1a73e8; text-decoration: none;">Taliferro</a>. 
      Email sent from 
      <a href="${appUrl}" style="color: #1a73e8; text-decoration: none;">${appLabel}</a>. 
      <span style="white-space: nowrap;">taliferro-tech-unsubscribe.</span>
  
      </p>
  </div>
  `;
  }

  lightboxVideoUrl: string | null = null;

  constructor (
    private router: Router,
    private logger: LoggerService,
    private dataService: SayItDataService,
    private emailService: EmailService,
    private notificationService: NotificationService,
    private rssService: RssFeedService
  ) { }

  ngOnInit (): void {
    this.rssFeed1();

  }

  private isSayItRoute (): boolean {
    return String( this.router.url || '' ).includes( '/say-it' );
  }

  /**
 * News sourceName can come in as non-string depending on feed parsing.
 * Keep template strict-mode happy by normalizing to a string here.
 */
  getSourceInitials ( post: any ): string {
    const raw = post?.sourceName ?? post?.displayName ?? post?.user ?? 'News';
    const text = String( raw || 'News' ).trim();
    return text.slice( 0, 2 ).toUpperCase();
  }

  /** Build a safe URL string for favicon lookup. */
  getNewsLink ( post: any ): string {
    return String( post?.linkPreview?.url || post?.link || '' );
  }

  /**
   * Hide a broken <img> so the badge behind it shows.
   * (Avoids strict template errors with $event.target typing.)
   */
  hideBrokenImg ( event: Event ): void {
    const img = event.target as HTMLImageElement | null;
    if ( img ) {
      img.style.display = 'none';
    }
  }

  /**
   * RSS feeds sometimes provide timestamps without a timezone.
   * JS treats those as LOCAL time, which can push items ~8 hours into the future in PST.
   * This normalizes "no timezone" strings to UTC by appending 'Z'.
   */
  private parseFeedTimeMs ( value: any ): number {
    if ( typeof value === 'number' ) return value;
    if ( !value ) return NaN;

    const s = String( value ).trim();

    // If the string already contains a timezone (Z, GMT/UTC, or +/-HH:mm), trust it.
    const hasTz = /\b(Z|z|GMT|UTC)\b|[+-]\d{2}:?\d{2}$/.test( s );

    // If ISO-like but missing timezone, treat as UTC.
    const candidate = hasTz ? s : `${s}Z`;

    const ms = new Date( candidate ).getTime();
    return ms;
  }


  private buildPostShareUrl ( post: any ): string {
    const postId = String( post?.id || '' ).trim();
    if ( postId && post?.category !== 'news' ) {
      return `${getToddHomeUrl()}/post/${encodeURIComponent( postId )}`;
    }
    return getSayitHomeUrl();
  }

  private buildNewsStandShareText ( post: any ): string {
    const title = String( post?.linkPreview?.title || post?.content || 'Check this out on NewsStand' ).trim();
    const description = String( post?.linkPreview?.description || '' )
      .replace( /<[^>]*>/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
    return description ? `${title}\n\n${description}` : title;
  }

  private buildNewsStandShareUrl ( post: any ): string {
    const articleUrl = String( post?.linkPreview?.url || post?.link || '' ).trim();
    return articleUrl
      ? buildSayitShareUrl( 'news', articleUrl )
      : getSayitHomeUrl();
  }

  trackById ( index: number, post: any ): string {
    return post.id; // Use the unique 'id' to track each post
  }

  get rssProgress (): number {
    return this.rssTotal > 0
      ? Math.round( ( this.rssLoaded / this.rssTotal ) * 100 )
      : 0;
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
   * Merge current RSS feed items into the timeline regardless of auth state.
   * Hardened: Ensures timestamps never become 'Invalid Date', and NewsStand cards have a usable thumbnail/avatar.
   */
  private processPosts (): void {
    const mapped = ( this.feedItems || [] ).map( ( item ) => {
      const ms =
        typeof item?.timeMs === 'number'
          ? item.timeMs
          : this.parseFeedTimeMs( item?.timestamp || item?.pubDate || '' );

      const safeMs = isNaN( ms ) ? Date.now() : ms;
      const iso = new Date( safeMs ).toISOString();

      const img = item?.image || item?.thumbnail || item?.enclosure?.link || '';

      return {
        id: item?.link || `${safeMs}-${Math.random()}`,
        user: 'NewsStand',
        sourceName: item?.sourceName || item?.author || 'News',
        content: item?.title || '',
        // Use an image when available so the avatar slot isn't always blank
        imageUrl: img,
        category: 'news',

        // Keep timestamps machine-parsable
        timestamp: iso,
        timeMs: safeMs,

        likeUserIds: [],
        linkPreview: {
          title: item?.title || '',
          description: item?.description || '',
          url: item?.link || '',
          image: img,
        },
        contentRating: 1,
        ratingExplanation: 'News item',
        favoriteCount: 0,
        emailAddress: '',
        isInternal: false,
        tenantId: '',
      };
    } );

    // Keep newest first
    this.newsPosts = mapped.sort( ( a: any, b: any ) => ( b.timeMs || 0 ) - ( a.timeMs || 0 ) );

    this.totalPosts = this.newsPosts.length;
    this.showNewsstandAvailable = this.newsPosts.length > 0;
  }


  rssFeed1 (): void {
    const CACHE_KEY = 'rssFeedCache';
    const CACHE_EXPIRATION = 60 * 60 * 1000; // 1 hour in milliseconds
    const now = Date.now();
    const failedFeeds: string[] = [];
    // Initialize progress counters
    this.isRSSLoading = true;
    this.rssLoaded = 0;
    this.rssFailed = 0;

    // Check local storage for cached feed
    const cachedData = localStorage.getItem( CACHE_KEY );
    if ( cachedData ) {
      const { timestamp, feedItems } = JSON.parse( cachedData );

      // Use cached data if it's still valid
      if ( now - timestamp < CACHE_EXPIRATION ) {
        this.feedItems = feedItems;
        this.notificationService.show(
          'NewsStand',
          'News data loaded! Start exploring news by selecting ‘NewsStand’ from the category menu.',
          'success'
        );
        this.isRSSLoading = false;
        this.logger.info( 'CACHED FEED', this.feedItems );
        this.processPosts();
        this.showNewsstandAvailable = this.feedItems.length > 0;
        return;
      }
    }

    // If no valid cache, fetch new data
    const rssUrls = [
      'https://feeds.macrumors.com/MacRumors-All',
      'https://www.theguardian.com/us/rss',
      'https://www.technologyreview.com/feed/',
      'https://feeds.npr.org/1001/rss.xml',
      'https://feeds.npr.org/1008/rss.xml',
      'https://www.cbsnews.com/latest/rss/main',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'https://news.google.com/rss/search?q=construction%20industry&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=trucking%20industry&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=healthcare%20industry&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=commercial%20real%20estate&hl=en-US&gl=US&ceid=US:en'
    ];
    this.rssTotal = rssUrls.length;

    this.feedItems = []; // Clear previous feed items
    from( rssUrls )
      .pipe(
        concatMap( ( url, index ) =>
          timer( index * 1000 ).pipe(
            concatMap( () =>
              this.rssService.getRSSFeed( url ).pipe(
                map( ( feed ) => {
                  this.logger.log( `✅ Successfully fetched: ${url}` );
                  this.rssLoaded++; // progress: processed one feed successfully
                  return this.processRSSFeed( feed );
                } ),
                catchError( ( err ) => {
                  this.logger.error(
                    `❌ Failed to fetch or process: ${url}`,
                    err
                  );
                  failedFeeds.push( url );
                  this.rssLoaded++; // progress: processed one feed (failed)
                  this.rssFailed++;
                  return of( [] ); // Return empty array on error
                } )
              )
            )
          )
        ),
        reduce<any[], any[]>(
          ( allItems, currentItems ) => [...allItems, ...currentItems],
          []
        ),
        map( ( feedItems ) => {
          return ( feedItems || [] )
            .map( ( item ) => {
              // Prefer numeric timeMs if present; otherwise derive it from timestamp or pubDate.
              const ms =
                typeof item?.timeMs === 'number'
                  ? item.timeMs
                  : this.parseFeedTimeMs( item?.timestamp || item?.pubDate || '' );

              return {
                ...item,
                timeMs: ms,
                // Normalize to ISO once so downstream code is consistent.
                timestamp: isNaN( ms ) ? new Date().toISOString() : new Date( ms ).toISOString(),
              };
            } )
            .sort( ( a: any, b: any ) => ( b.timeMs || 0 ) - ( a.timeMs || 0 ) );
        } )
      )
      .subscribe( {
        next: ( sortedFeedItems ) => {
          // Already sorted by timeMs in the pipeline; just normalize/assign.
          this.feedItems = ( sortedFeedItems || [] ).map( ( item: any ) => ( {
            ...item,
            timeMs:
              typeof item?.timeMs === 'number'
                ? item.timeMs
                : new Date( item?.timestamp || '' ).getTime(),
            timestamp: new Date( item?.timestamp || new Date().toISOString() ).toISOString(),
          } ) );

          // Defensive: ensure correct order
          this.feedItems.sort( ( a: any, b: any ) => ( b.timeMs || 0 ) - ( a.timeMs || 0 ) );

          // Cache the result
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify( {
              timestamp: now,
              feedItems: this.feedItems,
            } )
          );

          // Ensure NewsStand appears for guests even without POSTS stream
          this.processPosts();
          this.showNewsstandAvailable = this.feedItems.length > 0;

          this.isRSSLoading = false;
          this.notificationService.show(
            'NewsStand',
            'The NewsStand is now available! Start exploring news by selecting ‘NewsStand’ from the category menu.',
            'success'
          );
          if ( failedFeeds.length > 0 ) {
            this.logger.warn(
              '🧹 The following feeds consistently failed and may be removed:',
              failedFeeds
            );
          }
        },
        error: ( err ) => {
          this.isRSSLoading = false;
          this.logger.error( 'Error processing RSS feeds:', err );
        },
      } );
  }

  /**
   * Extracts the first image source URL from a given HTML content string.
   * @param {string} content - The HTML content string to search for an image source.
   * @returns {string|null} The extracted image source URL, or null if no images are found.
   */
  extractImageFromContent ( content: string ): string | null {
    const match = content?.match( /<img[^>]+src="([^">]+)"/ );
    return match ? match[1] : null; // Return the image URL or null if none found
  }


  /**
   * Process an array of RSS feed items and transform them into a standardized format.
   * Each item is mapped to an object containing cleaned and simplified data for display.
   *
   * @param {any[]} items - An array of items from the RSS feed.
   * @returns {any[]} An array of processed and formatted feed items.
   */
  processRSSFeed ( items: any[] ): any[] {
    return items.map( ( item ) => {
      const description = item.description
        ? item.description.replace( /<\/?[^>]+(>|$)/g, '' ).slice( 0, 150 ) // Strip HTML and truncate
        : '';

      const image =
        item.thumbnail ||
        item.enclosure?.link ||
        this.extractImageFromContent( item.content );

      // Determine if the link is a video
      const videoPlatform = this.getVideoPlatform( item.link );
      const isVideo = !!videoPlatform; // True if videoPlatform is not null

      return {
        title: item.title || 'No Title',
        description,
        link: item.link || '#',
        timeMs: this.parseFeedTimeMs( item.pubDate ),
        timestamp: isNaN( this.parseFeedTimeMs( item.pubDate ) )
          ? new Date().toISOString()
          : new Date( this.parseFeedTimeMs( item.pubDate ) ).toISOString(),
        image,
        isVideo, // Flag to indicate if this is a video item
        videoPlatform, // Pass the platform (could be null)
        videoId:
          isVideo && videoPlatform
            ? this.extractVideoId( item.link, videoPlatform )
            : null, // Only call if platform exists
        category: item.categories?.join( ', ' ) || 'Uncategorized',
        author: item.author || 'Unknown Author',
        pubDate: item.pubDate,
      };
    } );
  }

  /**
 * Extracts the video ID from a given URL based on the video platform specified.
 *
 * @param {string} url - The full URL from which to extract the video ID.
 * @param {string} platform - The platform of the video ('youtube', 'vimeo', 'tiktok').
 * @returns {string|null} The extracted video ID, or null if none is found or the platform is not recognized.
 */
  extractVideoId ( url: string, platform: string ): string | null {
    if ( platform === 'youtube' ) {
      const match = url.match( /v=([^&]+)/ );
      return match ? match[1] : null;
    }
    if ( platform === 'vimeo' ) {
      const match = url.match( /vimeo\.com\/(\d+)/ );
      return match ? match[1] : null;
    }
    if ( platform === 'tiktok' ) {
      const match = url.match( /\/video\/(\d+)/ );
      return match ? match[1] : null;
    }
    return null;
  }


  /**
 * Determines the video platform based on the provided URL.
 * Recognizes 'youtube.com', 'vimeo.com', and 'tiktok.com'.
 * @param url - The URL to check against known video platforms.
 * @returns The name of the video platform or null if not recognized.
 */
  getVideoPlatform ( url: string ): string | null {
    if ( url.includes( 'youtube.com' ) ) return 'youtube';
    if ( url.includes( 'vimeo.com' ) ) return 'vimeo';
    if ( url.includes( 'tiktok.com' ) ) return 'tiktok';
    return null;
  }


  /**
   * Posts a news item to the message service.
   *
   * This asynchronous function constructs a new post object with the provided `news` details,
   * including a link preview. It logs the posting process, attempts the addition of the message
   * using the message service, and clears the message input. It also creates notifications indicating
   * the success or failure of the posting action.
   *
   * @param {any} news - The news data to be posted, should ideally contain author, description, image, isVideo, link, and title.
   */
  async postNews ( news: any ) {
    if ( !this.isLoggedIn ) {
      return;
    }
    try {
      const newPost: any = {
        user: this.displayName || news.author || '',
        displayName: news.author,
        content: news.description || '',
        imageUrl: news.isVideo ? '' : news.image || '',
        category: news.isVideo ? 'sports' : 'news',
        timestamp: new Date(),
        emailAddress: this.firebaseUser.email,
      };
      newPost.linkPreview = {
        title: news.title || '',
        description: news.description || '',
        url: news.link,
        image: news.image,
      };

      this.logger.info( 'Posting message', newPost );
      this.newMessage = '';
      this.notificationService.show(
        'Posting Success',
        'Your News post was posted to the news category',
        'success'
      );
    } catch ( error ) {
      this.isPosting = false;
      this.notificationService.show( 'Error', JSON.stringify( error ), 'error' );
    }
  }

  /**
   * Closes the lightbox and stops video playback by clearing the video URL.
   */
  closeLightbox () {
    this.lightboxVideoUrl = null; // Clear video URL to stop playback
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

  /** Analytics: track when a user clicks into a profile from a post card. */
  trackProfileClick ( post: Post, profileUrl: any ): void {
    try {
      const payload = {
        postId: post?.id,
        authorId: ( post as any )?.userId || post?.user,
        authorHandle: ( post as any )?.authorHandle,
        authorContactId: ( post as any )?.authorContactId,
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
   * Opens a lightbox modal with the given image source.
   * @param {string} imageSrc - The source URL of the image to display in the lightbox.
   */
  openLightbox ( imageSrc: string ): void {
    this.lightboxImage = imageSrc;
    const lightboxModal = new bootstrap.Modal(
      document.getElementById( 'imageLightbox' )!
    );
    lightboxModal.show();
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

  /**
   * Marks a post as a favorite for the current user.
   * If the user is not logged in, an error notification is displayed.
   * If the post is already in favorites, an alert is shown.
   * Otherwise, the post is added to the favorites array with a timestamp,
   * the backend is updated, and the favorite count for the post is incremented.
   */
  favoritePost ( post: Post, event?: Event ): void {
    if ( !this.isLoggedIn ) {
      this.notificationService.show(
        'Error!',
        `You must be logged in to favorite a post.`,
        'error'
      );
      return;
    }

    try {
      this.incrementFavoriteCount( post );

      if ( post.emailAddress ) this.sendFavoriteNotification( post );

      this.notificationService.show(
        'Success!',
        `Post has been added to your favorites!`,
        'success'
      );
    } catch ( error ) {
      this.notificationService.show(
        'Error!',
        `Failed to add post to your favorites!` + error,
        'error'
      );
    }
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
    // Construct the email details
    const email: Email = {
      to: post.emailAddress, // Assuming `post.user` contains the recipient's email
      subject: 'Your post was favored!',
      html: `<p>Hi ${post.displayName || 'there'},</p>
                   <p>${this.firebaseUser.displayName || 'Someone'
        } has favored your <a title="Click to see your post" href="${environment.PLATFORM_URL
        }/post/${post.id}">post</a>: </p><p>"<b>${post.content}</b>"</p>
                   <p>Keep sharing great content!</p>
                   <p>Best regards,</p>
                   <p>SayIt - The Taliferro Tech Team</p>`,
      from: 'noreply@taliferro.tech',
    };

    email.html += this.footer;

    this.logger.info( 'Send email notification', email );
    // Send the email
    this.emailService
      .sendEmail( email, environment.taliferroTenantId, this.userId )
      .subscribe( {
        next: () => this.logger.info( 'Notification email sent successfully.' ),
        error: ( err ) =>
          this.logger.error( 'Failed to send notification email:', err ),
      } );
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
      this.dataService.updateMessage( post.id, post ); // Replace with your post fetching logic
    }
  }

  /**
   * Opens a video lightbox if a valid video URL is found in the post.
   * The function will determine the video platform (YouTube, Vimeo, TikTok), generate an embeddable URL,
   * and display the video in a modal dialog.
   * @param post - The Post object that may contain video content to display.
   */
  openVideoLightbox ( post: any ) {
    if ( !post ) return;

    this.logger.log( 'Passed Post for Lightbox', post );

    let url = post?.linkPreview?.url || post?.link;
    if ( !url ) {
      this.logger.warn( 'No valid video URL found in post.', post );
    }

    this.logger.info( 'Passed Post', post );

    // Step 1: Determine the video URL from content or linkPreview.url
    const videoUrl = this.extractUrl( post.content ) || url;
    this.logger.info( 'Extracted video URL', videoUrl );

    if ( !videoUrl ) {
      this.logger.info( 'No valid video URL found in post.', post );
      return;
    }

    // Step 2: Determine the platform
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
      this.lightboxVideoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    } else if ( platform === 'vimeo' ) {
      const videoId = this.extractLightBoxVideoId( videoUrl, 'vimeo' );
      this.lightboxVideoUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    } else if ( platform === 'tiktok' ) {
      const videoId = this.extractLightBoxVideoId( videoUrl, 'tiktok' );
      this.lightboxVideoUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
    }

    // Step 3: Open the modal if a valid URL is found
    if ( this.lightboxVideoUrl ) {
      this.logger.info( 'LightboxVideo', this.lightboxVideoUrl );
      const lightbox = document.getElementById( 'videoLightbox' );
      const bootstrapModal = new bootstrap.Modal( lightbox! );
      bootstrapModal.show();
    } else {
      this.logger.info( 'No video ID could be extracted.', post );
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
        text: `${post.content}`,
        url: this.buildPostShareUrl( post ) || window.location.href,
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
   *                       This object should have `title`, `description`, and `link` or `url` properties.
   */
  shareNewsStandContent ( post: any ): void {
    const articleUrl = String( post?.linkPreview?.url || post?.link || '' ).trim();
    const shareUrl = this.buildNewsStandShareUrl( post );
    const shareText = this.buildNewsStandShareText( post );

    if ( navigator.share ) {
      const shareData: any = {
        title: String( post?.linkPreview?.title || post?.content || 'Check this out on NewsStand' ).trim(),
        text: articleUrl ? `${shareText}\n\nOriginal article: ${articleUrl}` : shareText,
        url: shareUrl || articleUrl || window.location.href
      };

      this.logger.info( 'Sharing NewsStand content', shareData );

      navigator.share( shareData )
        .then( () => {
          this.notificationService.show( 'Success', 'Content shared successfully!', 'success' );
        } )
        .catch( ( error ) => {
          this.notificationService.show( 'Error', 'Unable to share content.', 'error' );
          this.logger.error( 'Error sharing NewsStand content:', error );
        } );
      return;
    }

    this.notificationService.show( 'Error', 'Sharing is not supported on this device.', 'error' );
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

  /**
 * Opens a lightbox modal with a video player based on the news item provided.
 * The function first determines if there's an available video URL, extracts the platform from the URL, and identifies the correct video ID.
 * It then constructs the relevant video embed URL and executes the bootstrap modal to display the content.
 * @param item - The news item object which contains the video to be displayed in the lightbox.
 */
  openNewsVideoLightbox ( item: any ) {
    if ( !item ) return;

    this.logger.info( 'Passed News Item', item );

    // Step 1: Determine the video URL from content or linkPreview.url
    const videoUrl = this.extractUrl( item.link );
    this.logger.info( 'Extracted video URL', videoUrl );

    if ( !videoUrl ) {
      this.logger.info( 'No valid video URL found in post.', item );
      return;
    }

    // Step 2: Determine the platform
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
      this.lightboxVideoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    } else if ( platform === 'vimeo' ) {
      const videoId = this.extractLightBoxVideoId( videoUrl, 'vimeo' );
      this.lightboxVideoUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    } else if ( platform === 'tiktok' ) {
      const videoId = this.extractLightBoxVideoId( videoUrl, 'tiktok' );
      this.lightboxVideoUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
    }

    // Step 3: Open the modal if a valid URL is found
    if ( this.lightboxVideoUrl ) {
      this.logger.info( 'LightboxVideo', this.lightboxVideoUrl );
      const lightbox = document.getElementById( 'videoLightbox' );
      const bootstrapModal = new bootstrap.Modal( lightbox! );
      bootstrapModal.show();
    } else {
      this.logger.info( 'No video ID could be extracted.', item );
    }
  }

}
