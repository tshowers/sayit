import { Injectable } from '@angular/core';
import {
  DocumentData,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

const MASTER_TENANT_ID = environment.taliferroTenantId;
const SAYIT_PROFILES_ENDPOINT = 'say-it-profiles';

export interface Contact {
  id: string;
  [key: string]: any;
}

@Injectable( { providedIn: 'root' } )
export class SayItDataService {
  private readonly profilePostCursors: Record<string, DocumentData | null> = {};

  constructor ( private readonly logger: LoggerService ) { }

  private get firestore () {
    return getFirestore();
  }

  private extractComparableDate ( raw: any ): number {
    try {
      const date = raw?.toDate ? raw.toDate() : new Date( raw );
      const millis = date?.getTime?.() ?? 0;
      return Number.isFinite( millis ) ? millis : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Upsert a SayIt profile doc under the Taliferro master tenant.
   * Source of truth: /tenants/{masterTenantId}/say-it-profiles/{uid}
   */
  async upsertUserProfile ( uid: string, data: any, user: string ): Promise<void> {
    if ( !uid ) throw new Error( 'upsertUserProfile called with empty uid' );

    try {
      const path = `tenants/${MASTER_TENANT_ID}/${SAYIT_PROFILES_ENDPOINT}/${uid}`;
      const docRef = doc( this.firestore, path );
      const cleaned = JSON.parse( JSON.stringify( data ) );

      this.logger.info( `[Firestore WRITE] document=${docRef.path} user=${user} (say-it profile upsert)` );
      await setDoc( docRef, cleaned, { merge: true } as any );
    } catch ( err ) {
      this.logger.error( 'upsertUserProfile (say-it) error:', err );
      throw err;
    }
  }

  async getSayItProfileByUidOnce ( uid: string, user: string ): Promise<any | null> {
    const normalizedUid = ( uid || '' ).trim();
    if ( !normalizedUid ) return null;

    try {
      const path = `tenants/${MASTER_TENANT_ID}/${SAYIT_PROFILES_ENDPOINT}/${normalizedUid}`;
      const docRef = doc( this.firestore, path );

      this.logger.info( `[Firestore READ] document=${docRef.path} user=${user} (say-it profile by uid)` );
      const snap = await getDoc( docRef );
      if ( snap.exists() ) {
        return { id: snap.id, ...snap.data() };
      }

      const colRef = collection( this.firestore, `tenants/${MASTER_TENANT_ID}/${SAYIT_PROFILES_ENDPOINT}` );
      const uidQuery = query( colRef, where( 'uid', '==', normalizedUid ), limit( 1 ) );
      const uidSnap = await getDocs( uidQuery );
      if ( uidSnap.empty ) return null;

      const d = uidSnap.docs[0];
      return { id: d.id, ...d.data() };
    } catch ( err ) {
      this.logger.error( 'getSayItProfileByUidOnce error:', err );
      return null;
    }
  }

  async getSayItProfileByClaimEmailOnce ( email: string, user: string ): Promise<any | null> {
    const normalizedEmail = ( email || '' ).trim().toLowerCase();
    if ( !normalizedEmail ) return null;

    try {
      const colRef = collection( this.firestore, `tenants/${MASTER_TENANT_ID}/${SAYIT_PROFILES_ENDPOINT}` );
      const q = query( colRef, where( 'claimEmail', '==', normalizedEmail ), limit( 1 ) );
      const snap = await getDocs( q );
      if ( snap.empty ) return null;

      const d = snap.docs[0];
      this.logger.info( `[Firestore READ] collection=${colRef.path} claimEmail=${normalizedEmail} user=${user} (say-it profile by claimEmail)` );
      return { id: d.id, ...d.data() };
    } catch ( err ) {
      this.logger.error( 'getSayItProfileByClaimEmailOnce error:', err );
      return null;
    }
  }

  async getPublicSayItProfilesOnce ( user: string, opts?: { limit?: number; } ): Promise<any[]> {
    try {
      const colRef = collection( this.firestore, `tenants/${MASTER_TENANT_ID}/${SAYIT_PROFILES_ENDPOINT}` );
      const lim = Math.max( 1, Math.min( opts?.limit ?? 60, 200 ) );
      const seededConfigRef = doc( this.firestore, `tenants/${MASTER_TENANT_ID}/sayit-config/seeded-directory` );
      const seededConfigSnap = await getDoc( seededConfigRef );
      const seededDirectoryEnabled = seededConfigSnap.exists() ? seededConfigSnap.data()?.['enabled'] !== false : true;
      const snap = await getDocs( query(
        colRef,
        where( 'publicProfile', '==', true ),
        limit( lim )
      ) );
      const rawDocs = snap.docs.map( d => ( { id: d.id, ...d.data() } ) );

      const docs = rawDocs
        .filter( ( profile: any ) => {
          const isSeeded = String( profile?.profileSource || '' ).trim() === 'lead_vault_seed';
          if ( !isSeeded ) return true;
          if ( !seededDirectoryEnabled ) return false;

          const seedStatus = String( profile?.seedStatus || '' ).trim().toLowerCase();
          const directoryVisibility = String( profile?.directoryVisibility || '' ).trim().toLowerCase();
          return ( seedStatus === 'unclaimed' || seedStatus === 'invited' || directoryVisibility === 'member_profile' )
            && directoryVisibility !== 'suppressed';
        } )
        .filter( ( profile: any ) => {
          const label = (
            profile?.businessName ||
            profile?.displayName ||
            profile?.companyName ||
            ''
          ).toString().trim();
          return !!label;
        } )
        .sort( ( a: any, b: any ) => this.extractComparableDate( b?.lastUpdated || b?.createdAt ) - this.extractComparableDate( a?.lastUpdated || a?.createdAt ) );

      this.logger.info( `[Firestore READ] collection=${colRef.path} user=${user} (public SayIt profiles)`, {
        requestedLimit: lim,
        seededDirectoryEnabled,
        rawCount: rawDocs.length,
        returnedCount: docs.length,
      } );
      return docs;
    } catch ( err ) {
      this.logger.error( 'getPublicSayItProfilesOnce error:', err );
      return [];
    }
  }

  async toggleSayItBusinessWatch ( currentUid: string, targetProfileId: string, user: string ): Promise<{ watching: boolean; watchlistProfileIds: string[]; watcherCount: number; }> {
    const normalizedCurrentUid = ( currentUid || '' ).trim();
    const normalizedTargetId = ( targetProfileId || '' ).trim();
    if ( !normalizedCurrentUid ) throw new Error( 'Missing current uid.' );
    if ( !normalizedTargetId ) throw new Error( 'Missing target profile id.' );

    const currentRef = doc( this.firestore, `tenants/${MASTER_TENANT_ID}/${SAYIT_PROFILES_ENDPOINT}/${normalizedCurrentUid}` );
    const targetRef = doc( this.firestore, `tenants/${MASTER_TENANT_ID}/${SAYIT_PROFILES_ENDPOINT}/${normalizedTargetId}` );

    const [currentSnap, targetSnap] = await Promise.all( [getDoc( currentRef ), getDoc( targetRef )] );

    const currentData = currentSnap.exists() ? ( currentSnap.data() as any ) : {};
    const targetData = targetSnap.exists() ? ( targetSnap.data() as any ) : {};

    const existingWatchlist = Array.isArray( currentData?.watchlistProfileIds )
      ? currentData.watchlistProfileIds.map( ( id: any ) => String( id || '' ).trim() ).filter( Boolean )
      : [];

    const isWatching = existingWatchlist.includes( normalizedTargetId );
    const nextWatchlist = isWatching
      ? existingWatchlist.filter( ( id: string ) => id !== normalizedTargetId )
      : [...existingWatchlist, normalizedTargetId];

    const currentWatcherCount = Number( targetData?.watcherCount || 0 );
    const nextWatcherCount = Math.max( 0, currentWatcherCount + ( isWatching ? -1 : 1 ) );

    await setDoc( currentRef, {
      uid: normalizedCurrentUid,
      watchlistProfileIds: nextWatchlist,
      watchlistCount: nextWatchlist.length,
      lastUpdated: new Date(),
    }, { merge: true } as any );

    try {
      await setDoc( targetRef, {
        watcherCount: nextWatcherCount,
        lastUpdated: new Date(),
      }, { merge: true } as any );
    } catch ( watcherWriteError ) {
      this.logger.warn( 'toggleSayItBusinessWatch watcher count update skipped', {
        currentUid: normalizedCurrentUid,
        targetProfileId: normalizedTargetId,
        message: ( watcherWriteError as any )?.message || watcherWriteError,
      } );
    }

    this.logger.info( `[Firestore WRITE] toggleSayItBusinessWatch current=${normalizedCurrentUid} target=${normalizedTargetId} user=${user}` );
    return {
      watching: !isWatching,
      watchlistProfileIds: nextWatchlist,
      watcherCount: nextWatcherCount,
    };
  }

  /**
   * Convenience: fetch a CONTACT by email (master tenant) for public/profile prefill flows.
   */
  getContactByEmailForSayIt ( email: string, user: string ): Observable<Contact | null> {
    const normalized = ( email || '' ).trim().toLowerCase();
    if ( !normalized ) return of( null );

    const ref = collection( this.firestore, `tenants/${MASTER_TENANT_ID}/contacts` );
    const q = query( ref, where( 'email', '==', normalized ), limit( 1 ) );

    return from( getDocs( q ) ).pipe(
      map( ( snap ) => {
        if ( !snap.empty ) {
          const d = snap.docs[0];
          this.logger.info( `[Firestore READ] getContactByEmailForSayIt tenants/${MASTER_TENANT_ID}/contacts email==${normalized} user=${user}` );
          return { id: d.id, ...d.data() } as Contact;
        }
        return null;
      } ),
      catchError( ( err ) => {
        this.logger.error( 'getContactByEmailForSayIt error:', err );
        return of( null );
      } )
    );
  }

  async getMessageById ( postId: string ): Promise<any> {
    const ref = doc( this.firestore, 'posts', postId );
    try {
      const docSnapshot = await getDoc( ref );
      if ( docSnapshot.exists() ) {
        return { id: docSnapshot.id, ...docSnapshot.data() };
      }
      this.logger.warn( 'Message not found:', postId );
      throw new Error( `Message with ID ${postId} not found.` );
    } catch ( error ) {
      this.logger.error( 'Error retrieving message:', error );
      throw error;
    }
  }

  private profileCursorKey ( criteria: any ): string {
    return JSON.stringify( criteria );
  }

  private async getProfilePostsPage ( criteria: { authorContactId?: string; authorHandle?: string; userId?: string; }, cursor: DocumentData | null, pageSize: number = 10 ): Promise<any[]> {
    const colRef = collection( this.firestore, 'posts' );
    let q;
    if ( criteria.authorContactId ) {
      q = query( colRef, where( 'authorContactId', '==', criteria.authorContactId ), orderBy( 'timestamp', 'desc' ), limit( pageSize ) );
    } else if ( criteria.authorHandle ) {
      q = query( colRef, where( 'authorHandle', '==', criteria.authorHandle.toLowerCase() ), orderBy( 'timestamp', 'desc' ), limit( pageSize ) );
    } else if ( criteria.userId ) {
      q = query( colRef, where( 'userId', '==', criteria.userId ), orderBy( 'timestamp', 'desc' ), limit( pageSize ) );
    } else {
      return [];
    }
    if ( cursor ) q = query( q, startAfter( cursor ) );
    const snaps = await getDocs( q );
    const key = this.profileCursorKey( criteria );
    this.profilePostCursors[key] = snaps.docs[snaps.docs.length - 1] ?? null;
    return snaps.docs.map( d => ( { id: d.id, ...d.data() } ) ).filter( p => !( p as any )?.hidden && !( p as any )?.suspended );
  }

  async getProfilePostsFirstPage ( criteria: { authorContactId?: string; authorHandle?: string; userId?: string; }, pageSize: number = 10 ): Promise<any[]> {
    return this.getProfilePostsPage( criteria, null, pageSize );
  }

  async updateMessage ( postId: string, updatedData: any ): Promise<void> {
    const ref = doc( this.firestore, 'posts', postId );
    try {
      await updateDoc( ref, updatedData );
    } catch ( error ) {
      this.logger.error( 'Error updating message:', updatedData, error );
      throw error;
    }
  }

  async deleteMessage ( postId: string ): Promise<void> {
    const ref = doc( this.firestore, 'posts', postId );
    try {
      await deleteDoc( ref );
    } catch ( error ) {
      this.logger.error( 'Error deleting message:', error );
      throw error;
    }
  }

  private normalizeTimestamp ( value: any ): Date | null {
    try {
      if ( !value ) return null;
      if ( typeof value?.toDate === 'function' ) return value.toDate();
      if ( value instanceof Date ) return value;
      if ( typeof value === 'string' ) {
        const d = new Date( value );
        return isNaN( d.getTime() ) ? null : d;
      }
      return null;
    } catch {
      return null;
    }
  }

  getRealtimePosts (): Observable<any[]> {
    return new Observable( ( subscriber ) => {
      const ref = collection( this.firestore, 'posts' );
      const q = query( ref, orderBy( 'timestamp', 'desc' ) );

      const unsubscribe = onSnapshot(
        q,
        ( snapshot ) => {
          const posts = snapshot.docs.map( ( d ) => {
            const data = d.data() as any;
            return { id: d.id, ...data, timestamp: this.normalizeTimestamp( data?.timestamp ) };
          } );
          subscriber.next( posts );
        },
        ( error ) => {
          this.logger.error( 'Error in getRealtimePosts', error );
          subscriber.error( error );
        }
      );

      return unsubscribe;
    } );
  }
}
