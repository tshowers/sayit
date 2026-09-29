import { Subject } from 'rxjs';
import { getApps, initializeApp } from 'firebase/app';

import { environment } from '../../environments/environment';
import { ChatBoardComponent } from './chat-board.component';

/**
 * The board's live feed must stay bounded. An unbounded listener downloaded
 * every post on each visit, and the profile check after sign-in queued
 * behind it (the "profile prompt appears minutes after signing in" bug).
 */
describe( 'ChatBoardComponent feed window', () => {
  let feeds: Subject<any[]>[];
  let dataService: jasmine.SpyObj<any>;
  let board: ChatBoardComponent;

  const posts = ( count: number ) => Array.from( { length: count }, ( _, i ) => ( { id: `p${i}`, content: `post ${i}`, category: 'all' } ) );

  beforeAll( () => {
    if ( !getApps().length ) initializeApp( environment.firebaseConfig );
  } );

  beforeEach( () => {
    feeds = [];
    dataService = jasmine.createSpyObj( 'SayItDataService', ['getRealtimePosts'] );
    dataService.getRealtimePosts.and.callFake( () => {
      const feed = new Subject<any[]>();
      feeds.push( feed );
      return feed.asObservable();
    } );
    const noop: any = {};
    board = new ChatBoardComponent( noop, noop, jasmine.createSpyObj( 'LoggerService', ['info', 'warn', 'error', 'log'] ), noop, noop, dataService, noop, noop, noop, jasmine.createSpyObj( 'SayItOnboardingService', ['submitIfPending'] ) );
  } );

  it( 'listens to a bounded window of the newest posts', async () => {
    await board.loadMessages();
    expect( dataService.getRealtimePosts ).toHaveBeenCalledOnceWith( 200 );
  } );

  it( 'does not re-download the feed when loadMessages runs again (e.g. after sign-in)', async () => {
    await board.loadMessages();
    feeds[0].next( posts( 50 ) );
    await board.loadMessages();
    expect( dataService.getRealtimePosts ).toHaveBeenCalledTimes( 1 );
  } );

  it( 'resubscribes on an explicit retry', async () => {
    await board.loadMessages();
    await board.retryPostLoad();
    expect( dataService.getRealtimePosts ).toHaveBeenCalledTimes( 2 );
  } );

  it( 'widens the window only after every loaded post is shown and more exist', async () => {
    await board.loadMessages();
    feeds[0].next( posts( 200 ) );
    expect( board.visiblePosts.length ).toBe( 100 );

    board.loadMorePosts();
    expect( board.visiblePosts.length ).toBe( 200 );
    expect( dataService.getRealtimePosts ).toHaveBeenCalledTimes( 1 );

    board.loadMorePosts();
    expect( dataService.getRealtimePosts.calls.mostRecent().args ).toEqual( [400] );

    feeds[1].next( posts( 400 ) );
    expect( board.visiblePosts.length ).toBe( 300 );
  } );

  it( 'stops widening once Firestore returns fewer posts than the window', async () => {
    await board.loadMessages();
    feeds[0].next( posts( 120 ) );
    board.loadMorePosts();
    board.loadMorePosts();
    expect( dataService.getRealtimePosts ).toHaveBeenCalledTimes( 1 );
  } );

  it( 'keeps the reader on their page when new posts arrive', async () => {
    await board.loadMessages();
    feeds[0].next( posts( 200 ) );
    board.loadMorePosts();
    feeds[0].next( posts( 201 ) );
    expect( board.visiblePosts.length ).toBe( 200 );
  } );
} );
