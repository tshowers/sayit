import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { from, Observable, of } from 'rxjs';
import { AuthContextService } from '../services/auth-context.service';
import { SayItService, PostInterestRecord } from '../services/say-it-service';
import { PreloaderComponent } from '../shared/preloader/preloader.component';

@Component( {
  selector: 'app-interest-inbox',
  standalone: true,
  imports: [CommonModule, PreloaderComponent],
  templateUrl: './interest-inbox.component.html',
  styleUrls: ['./interest-inbox.component.css']
} )
export class InterestInboxComponent implements OnInit {

  private authService = inject( AuthContextService );
  private sayItService = inject( SayItService );

  interests$: Observable<PostInterestRecord[]> = of( [] );
  currentUid: string | null = null;
  loading = true;
  isAuthenticated = false;

  async ngOnInit (): Promise<void> {
    this.authService.getUser().subscribe( ( user: any ) => {
      if ( !user ) {
        this.isAuthenticated = false;
        this.currentUid = null;
        this.interests$ = of( [] );
        this.loading = false;
        return;
      }

      this.isAuthenticated = true;
      this.currentUid = user.uid;

      this.interests$ = from( this.sayItService.getInterestsForAuthor( user.uid ) );
      this.loading = false;
    } );
  }

  async markAsViewed ( interest: PostInterestRecord ): Promise<void> {
    if ( !interest?.id ) return;
    await this.sayItService.markInterestViewed( interest.id );
  }

  trackById ( index: number, item: PostInterestRecord ): string {
    return item.id || String( index );
  }
  countNewInterests ( interests: PostInterestRecord[] ): number {
    if ( !Array.isArray( interests ) ) return 0;
    return interests.filter( interest => interest.viewed === false ).length;
  }

  countViewedInterests ( interests: PostInterestRecord[] ): number {
    if ( !Array.isArray( interests ) ) return 0;
    return interests.filter( interest => interest.viewed === true ).length;
  }

  countWithMessages ( interests: PostInterestRecord[] ): number {
    if ( !Array.isArray( interests ) ) return 0;
    return interests.filter( interest => interest.message && interest.message.trim().length > 0 ).length;
  }

  getInboxStatusLabel ( interests: PostInterestRecord[] ): string {
    if ( !this.isAuthenticated ) return 'Locked';
    if ( !Array.isArray( interests ) || interests.length === 0 ) return 'Standby';
    return this.countNewInterests( interests ) > 0 ? 'Hot' : 'Ready';
  }
}
