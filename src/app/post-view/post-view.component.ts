import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthContextService } from '../services/auth-context.service';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { SayItDataService } from '../services/sayit-data.service';
import { Post } from '../shared/models/message.model';

import { LoggerService } from '../services/logger.service';
import { RelativeTimePipe } from '../pipes/relative-time.pipe';
import { TruncatePipe } from '../pipes/truncate.pipe';
import { AIContentExtractorPipe } from '../pipes/aicontent-extractor.pipe';
import { FormatAITextPipe } from '../pipes/format-aitext.pipe';
import { LinkifyPipe } from '../pipes/linkify-pipe';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../services/notification.service';
import { formatDistanceToNow, format } from 'date-fns';
import { environment } from '../../environments/environment';
import { buildSayitShareUrl } from '../shared/public-app-url.util';
import { BackToTopComponent } from '../shared/back-to-top/back-to-top.component';
import { SafeVideoUrlPipe } from '../pipes/safe-video-url-pipe';
import { SayItComment, SayItService } from '../services/say-it-service';

@Component( {
  selector: 'app-post-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,
    BackToTopComponent,
    SafeVideoUrlPipe, RelativeTimePipe, TruncatePipe, AIContentExtractorPipe, FormatAITextPipe, LinkifyPipe],
  templateUrl: './post-view.component.html',
  styleUrl: './post-view.component.css'
} )
export class PostViewComponent implements OnInit, OnDestroy {
  isMobile: boolean = window.innerWidth < 768; // Initialize based on current width

  private userSubscription!: Subscription;
  private postSubscription!: Subscription;
  private firebaseUserSubscription!: Subscription;
  private postId!: string | null;
  public post!: Post;
  public isLoggedIn: boolean = false;
  private userId!: string;
  private firebaseUser!: any;
  lightboxImage: string | null = null;
  isImageLightboxOpen: boolean = false;
  embeddedVideoUrl: string | null = null;
  embeddedVideoPlatform: 'youtube' | 'vimeo' | 'tiktok' | null = null;
  readonly COMPANY_NAME = environment.COMPANY_NAME;
  displayName = '';
  isSmallScreen: boolean = window.innerWidth < 992;
  comments: SayItComment[] = [];
  commentDraft = '';
  commentsLoading = false;
  commentBusy = false;
  interestBusy = false;

  constructor ( private authService: AuthContextService,
    private dataService: SayItDataService,
    private route: ActivatedRoute,
    private notificationService: NotificationService,
    private router: Router,
    private logger: LoggerService,
    private sayItService: SayItService ) {
    this.userSubscription = this.authService.getUser().subscribe( ( user ) => {
      this.isLoggedIn = !!( user && user.uid );
    } );
  }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUserId().subscribe( async userId => {
      this.userId = userId;
      this.firebaseUserSubscription = this.authService.getUser().subscribe( user => {
        this.firebaseUser = user;
        this.displayName = this.firebaseUser?.displayName || '';
      } );
    } );

    this.route.paramMap.subscribe( params => {
      this.postId = params.get( 'id' );
      if ( this.postId ) {
        this.loadPost();
      } else {
        this.logger.error( "Error", "Invalid Post ID passed", "error" );
      }
    } );
  }

  ngOnDestroy (): void {
    if ( this.postSubscription )
      this.postSubscription.unsubscribe();
    if ( this.userSubscription )
      this.userSubscription.unsubscribe();
    if ( this.firebaseUserSubscription )
      this.firebaseUserSubscription.unsubscribe();
  }

  async loadPost () {
    if ( this.postId ) {
      try {
        this.logger.info( "Retrieving Post", this.post );
        this.post = await this.dataService.getMessageById( this.postId );
        this.setEmbeddedVideoFromPost( this.post );
        await this.loadComments();
      } catch ( error ) {
        this.logger.error( 'Error fetching message:', error );
      }
    }
  }

  goBackToPosts (): void {
    void this.router.navigate( ['/'] );
  }

  async loadComments (): Promise<void> {
    const postId = String( this.post?.id || this.postId || '' ).trim();
    if ( !postId ) return;

    this.commentsLoading = true;
    try {
      this.comments = await this.sayItService.getComments( postId );
    } catch ( error ) {
      this.logger.warn( 'Could not load post comments', error );
      this.comments = [];
    } finally {
      this.commentsLoading = false;
    }
  }

  async submitComment (): Promise<void> {
    const postId = String( this.post?.id || this.postId || '' ).trim();
    const content = this.commentDraft.trim();
    if ( !this.isLoggedIn || !postId || !content || this.commentBusy ) return;

    this.commentBusy = true;
    try {
      await this.sayItService.addComment( postId, content );
      this.commentDraft = '';
      await this.loadComments();
    } catch ( error ) {
      this.logger.error( 'Could not post comment from post detail', error );
      this.notificationService.show( 'Error', 'Could not post comment. Please try again.', 'error' );
    } finally {
      this.commentBusy = false;
    }
  }

  async expressInterest (): Promise<void> {
    const postId = String( this.post?.id || this.postId || '' ).trim();
    if ( !this.isLoggedIn || !this.firebaseUser?.uid || !this.post || !postId || this.interestBusy ) return;

    this.interestBusy = true;
    try {
      await this.sayItService.createPostInterest( this.post as any, '', {
        postId,
        postAuthorUid: String( ( this.post as any ).authorUid || ( this.post as any ).userId || ( this.post as any ).user || '' ),
        postAuthorEmail: String( ( this.post as any ).postAuthorEmail || ( this.post as any ).emailAddress || '' ).trim() || undefined,
      } );
      this.notificationService.show( 'Sent', 'Interest sent to the author.', 'success' );
    } catch ( error ) {
      this.logger.error( 'Could not express interest from post detail', error );
      this.notificationService.show( 'Error', 'Could not send interest. Please try again.', 'error' );
    } finally {
      this.interestBusy = false;
    }
  }

  hasEmbeddedVideo (): boolean {
    return !!this.embeddedVideoUrl;
  }

  toggleBlur ( postContent: HTMLDivElement ): void {
    if ( postContent.classList.contains( 'blur-content' ) ) {
      postContent.classList.remove( 'blur-content' ); // Remove the blur class
    } else {
      postContent.classList.add( 'blur-content' ); // Add it back if needed
    }
  }
  getRatingDescription ( rating: number ): string {
    switch ( rating ) {
      case 1:
        return 'Acceptable';
      case 2:
        return 'Slightly Inappropriate';
      case 3:
        return 'Inappropriate';
      case 4:
        return 'Very Inappropriate';
      case 5:
        return 'Highly Inappropriate';
      default:
        return 'Unknown';
    }
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
  onImageError ( event: Event ): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none'; // Hide the image if it's invalid
  }
  openLightbox ( imageSrc: string ): void {
    this.lightboxImage = imageSrc;
    this.isImageLightboxOpen = true;
  }

  closeLightbox (): void {
    this.isImageLightboxOpen = false;
    this.lightboxImage = null;
  }

  private setEmbeddedVideoFromPost ( post: Post | null | undefined ): void {
    const videoUrl = this.getPostVideoUrl( post );

    if ( !videoUrl ) {
      this.embeddedVideoUrl = null;
      this.embeddedVideoPlatform = null;
      return;
    }

    this.embeddedVideoPlatform = this.getVideoPlatform( videoUrl );
    this.embeddedVideoUrl = this.buildEmbeddedVideoUrl( videoUrl );

    this.logger.info( '[PostView] embedded video resolved', {
      videoUrl,
      platform: this.embeddedVideoPlatform,
      embeddedVideoUrl: this.embeddedVideoUrl
    } );
  }

  private getPostVideoUrl ( post: Post | null | undefined ): string | null {
    if ( !post ) return null;

    const previewUrl = post.linkPreview?.url ? String( post.linkPreview.url ).trim() : '';
    if ( previewUrl ) {
      return previewUrl;
    }

    const postLink = ( post as any )?.link ? String( ( post as any ).link ).trim() : '';
    if ( postLink ) {
      return postLink;
    }

    const content = post.content ? String( post.content ) : '';
    const urlMatch = content.match( /(https?:\/\/[^\s]+)/i );
    return urlMatch ? urlMatch[1] : null;
  }

  private getVideoPlatform ( videoUrl: string ): 'youtube' | 'vimeo' | 'tiktok' | null {
    const lower = videoUrl.toLowerCase();

    if (
      lower.includes( 'youtube.com' ) ||
      lower.includes( 'youtu.be' ) ||
      lower.includes( 'youtube-nocookie.com' )
    ) {
      return 'youtube';
    }

    if ( lower.includes( 'vimeo.com' ) ) {
      return 'vimeo';
    }

    if ( lower.includes( 'tiktok.com' ) ) {
      return 'tiktok';
    }

    return null;
  }

  private buildEmbeddedVideoUrl ( videoUrl: string ): string | null {
    const platform = this.getVideoPlatform( videoUrl );

    if ( platform === 'youtube' ) {
      const videoId = this.extractVideoIdFromUrl( videoUrl, 'youtube' );
      return videoId
        ? `https://www.youtube.com/embed/${videoId}?rel=0`
        : null;
    }

    if ( platform === 'vimeo' ) {
      const videoId = this.extractVideoIdFromUrl( videoUrl, 'vimeo' );
      return videoId
        ? `https://player.vimeo.com/video/${videoId}`
        : null;
    }

    if ( platform === 'tiktok' ) {
      const videoId = this.extractVideoIdFromUrl( videoUrl, 'tiktok' );
      return videoId
        ? `https://www.tiktok.com/embed/v2/${videoId}`
        : null;
    }

    return null;
  }

  private extractVideoIdFromUrl ( videoUrl: string, platform: 'youtube' | 'vimeo' | 'tiktok' ): string | null {
    try {
      if ( platform === 'youtube' ) {
        const parsed = new URL( videoUrl );
        const host = parsed.hostname.toLowerCase();
        const pathParts = parsed.pathname.split( '/' ).filter( Boolean );

        if ( host.includes( 'youtu.be' ) && pathParts[0] ) {
          return pathParts[0];
        }

        const watchId = parsed.searchParams.get( 'v' );
        if ( watchId ) {
          return watchId;
        }

        const shortsIndex = pathParts.indexOf( 'shorts' );
        if ( shortsIndex >= 0 && pathParts[shortsIndex + 1] ) {
          return pathParts[shortsIndex + 1];
        }

        const embedIndex = pathParts.indexOf( 'embed' );
        if ( embedIndex >= 0 && pathParts[embedIndex + 1] ) {
          return pathParts[embedIndex + 1];
        }

        return pathParts.length ? pathParts[pathParts.length - 1] : null;
      }

      if ( platform === 'vimeo' ) {
        const match = videoUrl.match( /vimeo\.com\/(?:video\/)?(\d+)/i );
        return match ? match[1] : null;
      }

      if ( platform === 'tiktok' ) {
        const match = videoUrl.match( /\/video\/(\d+)/i );
        return match ? match[1] : null;
      }
    } catch ( error ) {
      this.logger.error( '[PostView] failed to extract video id', {
        videoUrl,
        platform,
        error
      } );
    }

    return null;
  }

  favoritePost ( post: Post, event?: Event ): void {
    if ( !this.isLoggedIn ) {
      this.notificationService.show( "Error!", `You must be logged in to favorite a post.`, "error" );
      return;
    }

    try {
      this.incrementFavoriteCount( post );
      this.notificationService.show( "Success!", `Post has been added to your favorites!`, "success" );
    } catch ( error ) {
      this.notificationService.show( "Error!", `Failed to add post to your favorites!` + error, "error" );
    }
  }

  /**
   * Increment the `favoriteCount` on a given post object and perform associated logging and message service update.
   * @param post The post object to increment favorite count.
   */
  incrementFavoriteCount ( post: Post ): void {
    this.logger.info( "Post to favor", post );

    if ( post && post.id ) {

      if ( !post.favoriteCount ) {
        this.logger.info( "increment favor count" );
        post.favoriteCount = 0;
      }
      post.favoriteCount++;
      this.dataService.updateMessage( post.id, post );
    }
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

  private buildPostShareUrl ( post: Post ): string {
    const postId = post?.id ? String( post.id ).trim() : '';
    return postId
      ? buildSayitShareUrl( 'post', postId )
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

  shareContent ( post: Post ): void {
    if ( navigator.share ) {
      // Construct the sharing data
      const shareData = {
        id: post.id,
        title: post.linkPreview?.title || 'Check this out!',
        text: post.content || '',
        url: this.buildPostShareUrl( post )
      };

      this.logger.info( "Sharing", shareData );

      // Call the Web Share API
      navigator.share( shareData )
        .then( () => {
          this.notificationService.show( 'Success', 'Content shared successfully!', 'success' );
        } )
        .catch( ( error ) => {
          this.notificationService.show( 'Error', 'Unable to share content.', 'error' );
          this.logger.error( 'Error sharing content:', error );
        } );
    } else {
      this.notificationService.show( 'Error', 'Sharing is not supported on this device.', 'error' );
    }
  }

  @HostListener( 'window:resize', ['$event'] )
  onResize ( event: any ) {
    this.isSmallScreen = window.innerWidth < 992;
    this.isMobile = window.innerWidth < 768;
  }

  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  hasValidTimestamp ( value: any ): boolean {
    if ( !value ) return false;

    if ( value instanceof Date ) {
      return !Number.isNaN( value.getTime() );
    }

    if ( typeof value === 'number' ) {
      return Number.isFinite( value );
    }

    if ( typeof value === 'string' ) {
      return !Number.isNaN( new Date( value ).getTime() );
    }

    if ( typeof value === 'object' ) {
      if ( typeof value.toDate === 'function' ) {
        const converted = value.toDate();
        return converted instanceof Date && !Number.isNaN( converted.getTime() );
      }

      if ( typeof value.seconds === 'number' ) {
        return Number.isFinite( value.seconds );
      }
    }

    return false;
  }

}
