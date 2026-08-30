import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

const POST_INTERESTS_ENDPOINT = 'post-interests';


export type SayItPublishPostInput = {
  authorUid: string;
  authorEmail?: string;

  content: string;
  category: string;

  // Preferred denormalized identity (SayIt profile). Fallbacks should be done by caller.
  displayName: string;
  photoURL?: string | null;

  // Optional author meta
  authorHandle?: string;
  authorContactId?: string;

  // Optional routing/association
  groupId?: string | null;

  // Optional preview payload (either URL preview or image-only preview)
  linkPreview?: {
    title?: string;
    description?: string;
    url?: string;
    image?: string;
  } | null;

  // Optional uploaded image attached to this post (separate from author avatar)
  postImageUrl?: string | null;
  postImageThumbUrl?: string | null;
  postImagePath?: string | null;

  // If true, run moderation/classification step before write
  moderate?: boolean;
};

export interface SayItComment {
  commentId: string;
  postId: string;
  authorUid: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  content: string;
  createdAt: string; // ISO
}

export type PostInterestCreateInput = {
  postId: string;
  postAuthorUid: string;
  postCategory?: string;
  postPreview?: string;
  postUrl?: string;
  postAuthorEmail?: string;
  message?: string;

  // Optional denormalized author meta (helps UI)
  postAuthorHandle?: string;
  postAuthorDisplayName?: string;

  // Optional denormalized interested-user meta (preferred)
  interestedDisplayName?: string;
  interestedHandle?: string;
  interestedPhotoURL?: string;
  interestedEmail?: string;
};

export type PostInterestRecord = {
  id: string;
  postId: string;
  postAuthorUid: string;
  postCategory?: string;
  postPreview?: string;
  postUrl?: string;
  postAuthorEmail?: string;
  message?: string;

  interestedUid: string;
  interestedDisplayName?: string;
  interestedHandle?: string;
  interestedPhotoURL?: string;
  interestedEmail?: string;

  createdAt: string; // ISO
  viewed?: boolean;
  viewedAt?: string; // ISO
};

@Injectable( {
  providedIn: 'root',
} )
export class SayItService {
  /** Where SayIt lives (master tenant). Kept for other SayIt features, but NOT used for post-interests. */


  private readonly interestsEndpoint: string = POST_INTERESTS_ENDPOINT;

  constructor (
    private logger: LoggerService,
    private http: HttpClient
  ) { }

  getAIResponse ( prompt: string, user: string ) {
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    return firstValueFrom( this.http.post<{ response: string; }>( `${environment.backendURL}/openai`, { prompt }, { headers } ) );
  }
  /**
   * Create an "I'm Interested" record for a post.
   *
   * You can pass either the whole post or a pre-built payload.
   * This method writes to: /post-interests
   */
  async createPostInterest (
    post:
      | {
        id?: string;
        postId?: string;
        authorUid?: string;
        authorHandle?: string;
        displayName?: string;
        category?: string;
        content?: string;
      }
      | null,
    message?: string,
    overrides?: Partial<PostInterestCreateInput>
  ): Promise<string> {
    const db = getFirestore();
    const auth = getAuth();
    const u = auth.currentUser;

    const interestedUid = u?.uid || '';
    if ( !interestedUid ) {
      throw new Error( 'Login required to express interest.' );
    }

    const postId =
      overrides?.postId ||
      post?.postId ||
      post?.id ||
      '';

    const postAuthorUid =
      overrides?.postAuthorUid ||
      post?.authorUid ||
      ( post as any )?.userId ||
      '';

    if ( !postId ) throw new Error( 'Missing postId for createPostInterest.' );
    if ( !postAuthorUid ) throw new Error( 'Missing postAuthorUid for createPostInterest.' );

    // Best-effort denormalization. UI can override with SayIt profile later.
    const fallbackInterestedDisplayName =
      ( u?.displayName && String( u.displayName ).trim() )
        ? String( u.displayName ).trim()
        : ( u?.email && u.email.includes( '@' ) )
          ? u.email.split( '@' )[0]
          : 'User';

    const fallbackInterestedEmail = ( u?.email || '' ).trim().toLowerCase();

    // Best-effort link back to a post detail route (caller can override).
    let origin = '';
    try { origin = ( window?.location?.origin || '' ); } catch { origin = ''; }

    const fallbackPostUrl = origin ? `${origin}/post/${encodeURIComponent( postId )}` : undefined;

    const payload: any = {
      postId,
      postAuthorUid,
      postCategory: overrides?.postCategory || post?.category || 'all',
      postPreview:
        overrides?.postPreview ||
        ( post?.content ? String( post.content ).slice( 0, 160 ) : '' ),
      postUrl: overrides?.postUrl || fallbackPostUrl,
      postAuthorEmail: overrides?.postAuthorEmail,
      message: ( overrides?.message ?? message ?? '' ).trim() || '',

      // interested user
      interestedUid,
      interestedDisplayName:
        overrides?.interestedDisplayName || fallbackInterestedDisplayName,
      interestedHandle:
        overrides?.interestedHandle ||
        ( u?.email && u.email.includes( '@' ) ? u.email.split( '@' )[0].toLowerCase() : undefined ),
      interestedPhotoURL: overrides?.interestedPhotoURL || u?.photoURL || undefined,
      interestedEmail: overrides?.interestedEmail || fallbackInterestedEmail || undefined,

      // post author denorm (optional)
      postAuthorHandle: overrides?.postAuthorHandle || post?.authorHandle || undefined,
      postAuthorDisplayName: overrides?.postAuthorDisplayName || post?.displayName || undefined,

      createdAt: new Date().toISOString(),
      viewed: false,
    };

    // IMPORTANT: Firestore rejects undefined values in nested objects in some SDK usage patterns.
    // Remove undefined keys defensively.
    Object.keys( payload ).forEach( ( k ) => {
      if ( payload[k] === undefined ) delete payload[k];
    } );

    // TOP-LEVEL collection (global), same pattern as `/posts`
    const colRef = collection( db, this.interestsEndpoint );

    const ref = await addDoc( colRef, payload );
    return ref.id;
  }

  /**
   * Fetch interests for an author (the person whose posts received interest).
   * Reads from: /post-interests WHERE postAuthorUid==uid
   */
  async getInterestsForAuthor (
    uid: string,
    max: number = 50
  ): Promise<PostInterestRecord[]> {
    const authorUid = ( uid || '' ).trim();
    if ( !authorUid ) return [];

    const db = getFirestore();
    // TOP-LEVEL collection (global)
    const colRef = collection( db, this.interestsEndpoint );

    const q = query(
      colRef,
      where( 'postAuthorUid', '==', authorUid ),
      orderBy( 'createdAt', 'desc' ),
      limit( Math.max( 1, Math.min( 200, max || 50 ) ) )
    );

    const snap = await getDocs( q );
    const out: PostInterestRecord[] = [];

    snap.forEach( ( d ) => {
      const data: any = d.data() || {};
      out.push( {
        id: d.id,
        postId: String( data.postId || '' ),
        postAuthorUid: String( data.postAuthorUid || '' ),
        postCategory: data.postCategory || data.category,
        postPreview: data.postPreview,
        postUrl: data.postUrl,
        postAuthorEmail: data.postAuthorEmail,
        message: data.message,

        interestedUid: String( data.interestedUid || '' ),
        interestedDisplayName: data.interestedDisplayName,
        interestedHandle: data.interestedHandle,
        interestedPhotoURL: data.interestedPhotoURL,
        interestedEmail: data.interestedEmail,

        createdAt: String( data.createdAt || '' ),
        viewed: !!data.viewed,
        viewedAt: data.viewedAt,
      } );
    } );

    return out;
  }

  /**
   * Mark an interest as viewed by the author.
   * Writes to: /post-interests/{interestId}
   */
  async markInterestViewed ( interestId: string ): Promise<void> {
    const id = ( interestId || '' ).trim();
    if ( !id ) return;

    const db = getFirestore();
    // TOP-LEVEL collection (global)
    const ref = doc( db, this.interestsEndpoint, id );

    await updateDoc( ref, {
      viewed: true,
      viewedAt: new Date().toISOString(),
    } as any );
  }




  private parseJsonFromAIResponse ( responseString: any ): any | null {
    try {
      if ( typeof responseString !== 'string' ) return null;

      const s = responseString.trim();
      if ( !s ) return null;

      // Handle ```json ... ``` blocks
      if ( s.startsWith( '```json' ) ) {
        const m = s.match( /```json\n([\s\S]*?)\n```/ );
        if ( m && m[1] ) return JSON.parse( m[1] );
        return null;
      }

      // Plain JSON
      return JSON.parse( s );
    } catch ( e ) {
      this.logger.warn( '[SayIt] parseJsonFromAIResponse failed', e );
      return null;
    }
  }

  private buildModerationPrompt ( post: { content: string; category: string; } ): string {
    const safeCategory = ( post.category || 'all' ).trim() || 'all';

    return `Analyze the following message to determine its appropriateness for public consumption. Generate a random display name (handle-style like 'dodgebox' or 'supersavvy'). Note that 1=Acceptable, 2=Slightly Inappropriate, 3=Inappropriate, 4=Very Inappropriate, 5=Highly Inappropriate, 6=Offensive. The difference between inappropriate and offensive is that offensive is more directly hurtful/disrespectful (often toward protected groups), while inappropriate is simply not suitable for the context. Also ensure the message is categorized correctly. The user chose the ${safeCategory}.
Categories are:
"all",
"construction",
"trucking-logistics",
"manufacturing",
"retail",
"ecommerce",
"real-estate",
"food-beverage",
"hospitality",
"professional-services",
"marketing",
"technology",
"healthcare",
"finance",
"education",
"automotive",
"energy",
"government-contracting",
"nonprofit",
"agriculture".
Respond in this exact JSON format: {"displayName": <user name>, "category": <selectedCategory>, "rating": <1-6>, "explanation": "<brief explanation>"}. Message: "${String( post.content || '' ).replace( /\s+/g, ' ' ).trim()}".`;
  }

  async publishPost ( input: SayItPublishPostInput ): Promise<{ post: any; }> {
    const auth = getAuth();
    const u = auth.currentUser;

    const authorUid = ( input?.authorUid || '' ).trim();
    if ( !authorUid ) throw new Error( 'Missing authorUid.' );
    if ( !u?.uid || u.uid !== authorUid ) {
      throw new Error( 'Login required to post.' );
    }

    const content = String( input.content || '' ).trim();

    const postImageUrl =
      input.postImageUrl && String( input.postImageUrl ).trim()
        ? String( input.postImageUrl ).trim()
        : null;

    const postImageThumbUrl =
      input.postImageThumbUrl && String( input.postImageThumbUrl ).trim()
        ? String( input.postImageThumbUrl ).trim()
        : null;

    const postImagePath =
      input.postImagePath && String( input.postImagePath ).trim()
        ? String( input.postImagePath ).trim()
        : null;

    // Allow image-only posts (no caption) when an upload is present.
    if ( !content && !postImageUrl ) throw new Error( 'Missing content.' );

    const category = String( input.category || 'all' ).trim() || 'all';

    const newPost: any = {
      // legacy
      user: authorUid,
      userId: authorUid,

      // preferred
      authorUid,

      displayName: String( input.displayName || 'User' ).trim() || 'User',
      imageUrl: ( input.photoURL === undefined ? null : input.photoURL ) ?? null,
      content,

      // Uploaded image attachment (separate from author avatar)
      postImageUrl,
      postImageThumbUrl,
      postImagePath,

      timestamp: new Date(),
      emailAddress: ( input.authorEmail || u.email || '' ),
      category,
    };

    // Optional meta
    if ( input.authorContactId && String( input.authorContactId ).trim() ) {
      newPost.authorContactId = String( input.authorContactId ).trim();
    }
    if ( input.authorHandle && String( input.authorHandle ).trim() ) {
      newPost.authorHandle = String( input.authorHandle ).trim().toLowerCase();
    }

    if ( input.groupId ) {
      newPost.groupId = input.groupId;
    }

    if ( input.linkPreview ) {
      const lp: any = {
        title: input.linkPreview.title || '',
        description: input.linkPreview.description || '',
        url: input.linkPreview.url || '',
        image: input.linkPreview.image || '',
      };

      // Strip empty keys so Firestore doesn't store noise
      Object.keys( lp ).forEach( ( k ) => {
        if ( lp[k] === '' || lp[k] === undefined || lp[k] === null ) delete lp[k];
      } );

      if ( Object.keys( lp ).length ) newPost.linkPreview = lp;
    }

    // Moderation/classification
    if ( input.moderate ) {
      try {
        const aiResp = await this.getAIResponse( this.buildModerationPrompt( { content, category } ), authorUid );

        const parsed = this.parseJsonFromAIResponse( aiResp?.response );

        if ( parsed ) {
          const rating = Number( parsed.rating || 1 );
          const explanation = String( parsed.explanation || 'No issues detected.' );
          const newCategory = String( parsed.category || category ).trim() || category;

          newPost.contentRating = Number.isFinite( rating ) ? rating : 1;
          newPost.ratingExplanation = explanation;
          newPost.category = newCategory;

          // NOTE: we do NOT override displayName here.
        } else {
          this.logger.warn( '[SayIt] publishPost: moderation response not parseable; continuing without override.' );
        }
      } catch ( e ) {
        // Non-blocking: still post
        this.logger.warn( '[SayIt] publishPost: moderation failed; continuing.', e );
      }
    }
    Object.keys( newPost ).forEach( ( k ) => {
      if ( newPost[k] === undefined ) delete newPost[k];
    } );
    // Remove empty-string noise for attachment fields
    ['postImageUrl', 'postImageThumbUrl', 'postImagePath'].forEach( ( k ) => {
      if ( newPost[k] === '' ) delete newPost[k];
    } );

    await addDoc( collection( getFirestore(), 'posts' ), newPost );
    return { post: newPost };
  }

  async addComment ( postId: string, content: string ): Promise<void> {
    const auth = getAuth();
    const u = auth.currentUser;
    if ( !u?.uid ) throw new Error( 'Login required to comment.' );

    const trimmed = ( content || '' ).trim().slice( 0, 500 );
    if ( !trimmed ) throw new Error( 'Comment cannot be empty.' );

    const db = getFirestore();
    const commentsRef = collection( db, 'posts', postId, 'comments' );

    const payload: Omit<SayItComment, 'commentId'> = {
      postId,
      authorUid: u.uid,
      authorDisplayName: ( u.displayName || u.email?.split( '@' )[0] || 'User' ).trim(),
      authorPhotoURL: u.photoURL || undefined,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    // Strip undefined keys
    Object.keys( payload ).forEach( ( k ) => {
      if ( ( payload as any )[k] === undefined ) delete ( payload as any )[k];
    } );

    await addDoc( commentsRef, payload );
  }

  async getComments ( postId: string, max: number = 50 ): Promise<SayItComment[]> {
    const db = getFirestore();
    const commentsRef = collection( db, 'posts', postId, 'comments' );
    const q = query( commentsRef, orderBy( 'createdAt', 'asc' ), limit( Math.min( 200, max ) ) );
    const snap = await getDocs( q );

    return snap.docs.map( ( d ) => {
      const data: any = d.data() || {};
      return {
        commentId: d.id,
        postId: String( data.postId || postId ),
        authorUid: String( data.authorUid || '' ),
        authorDisplayName: String( data.authorDisplayName || 'User' ),
        authorPhotoURL: data.authorPhotoURL || undefined,
        content: String( data.content || '' ),
        createdAt: String( data.createdAt || '' ),
      } as SayItComment;
    } );
  }

  async deleteComment ( postId: string, commentId: string, callerUid: string ): Promise<void> {
    const db = getFirestore();
    const commentRef = doc( db, 'posts', postId, 'comments', commentId );
    const snap = await getDoc( commentRef );
    if ( !snap.exists() ) return;

    const data: any = snap.data() || {};
    if ( data.authorUid !== callerUid ) throw new Error( 'Cannot delete another user\'s comment.' );

    await deleteDoc( commentRef );
  }
}




