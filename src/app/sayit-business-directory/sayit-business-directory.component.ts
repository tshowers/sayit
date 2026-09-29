import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SayItDataService } from '../services/sayit-data.service';
import { LoggerService } from '../services/logger.service';
import { PreloaderComponent } from '../shared/preloader/preloader.component';
import { ClickSoundDirective } from '../shared/directives/click-sound.directive';

@Component( {
  selector: 'app-sayit-business-directory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PreloaderComponent, ClickSoundDirective],
  templateUrl: './sayit-business-directory.component.html',
  styleUrl: './sayit-business-directory.component.css',
} )
export class SayitBusinessDirectoryComponent implements OnInit {
  private _profiles: any[] = [];
  private _searchTerm = '';
  private _categoryFilter = 'all';
  private _browseMode = 'active';
  loading = true;

  /**
   * categoryPills/filteredProfiles used to be getters that filtered/sorted
   * `profiles` fresh on every access - Angular property bindings and
   * interpolations re-run those on every change-detection pass (which fires
   * constantly app-wide), so each check allocated new arrays via spread +
   * filter + sort, and the *ngFor over them (with no trackBy) would
   * destroy/recreate every row every single check. profiles/searchTerm/
   * categoryFilter/browseMode are now accessor properties so every mutation
   * path - including the search box's [(ngModel)] - recomputes these once,
   * only when the underlying inputs actually change.
   */
  categoryPills: string[] = ['all'];
  filteredProfiles: any[] = [];

  get profiles (): any[] { return this._profiles; }
  set profiles ( value: any[] ) { this._profiles = value; this.recomputeDerived(); }

  get searchTerm (): string { return this._searchTerm; }
  set searchTerm ( value: string ) { this._searchTerm = value; this.recomputeDerived(); }

  get categoryFilter (): string { return this._categoryFilter; }
  set categoryFilter ( value: string ) { this._categoryFilter = value; this.recomputeDerived(); }

  get browseMode (): string { return this._browseMode; }
  set browseMode ( value: string ) { this._browseMode = value; this.recomputeDerived(); }

  readonly browseModes = [
    { id: 'active', label: 'Recently Active' },
    { id: 'watched', label: 'Most Watched' },
    { id: 'new', label: 'Newest' },
    { id: 'complete', label: 'Most Complete' },
  ];

  constructor (
    private dataService: SayItDataService,
    private logger: LoggerService) { }

  async ngOnInit (): Promise<void> {
    await this.loadProfiles();
  }

  trackByCategory ( _index: number, category: string ): string {
    return category;
  }

  trackByProfile ( _index: number, profile: any ): string {
    return ( profile?.handle || profile?.id || profile?.uid || '' ).toString();
  }

  private recomputeDerived (): void {
    const categories = this._profiles
      .map( profile => this.normalizeCategory( profile ) )
      .filter( ( category: string, index: number, array: string[] ) =>
        !!category &&
        category !== 'all' &&
        array.indexOf( category ) === index
      );
    this.categoryPills = ['all', ...categories];

    const search = ( this._searchTerm || '' ).trim().toLowerCase();
    const category = String( this._categoryFilter || 'all' ).trim().toLowerCase();

    this.filteredProfiles = [...this._profiles]
      .filter( profile => {
        const haystack = [
          profile?.businessName,
          profile?.displayName,
          profile?.businessCategory,
          profile?.industry,
          profile?.location,
          profile?.tagline,
          profile?.intentText,
          profile?.sellText,
        ].map( value => String( value || '' ).toLowerCase() ).join( ' ' );

        const matchesSearch = !search || haystack.includes( search );
        const matchesCategory = category === 'all' || this.normalizeCategory( profile ) === category;
        return matchesSearch && matchesCategory;
      } )
      .sort( ( a, b ) => this.compareProfiles( a, b ) );
  }

  setBrowseMode ( mode: string ): void {
    this.browseMode = String( mode || 'active' ).trim().toLowerCase();
  }

  setCategoryFilter ( category: string ): void {
    this.categoryFilter = String( category || 'all' ).trim().toLowerCase();
  }

  getProfileRoute ( profile: any ): string[] {
    const identifier = ( profile?.handle || profile?.id || profile?.uid || '' ).toString().trim().toLowerCase();
    return ['/business', identifier];
  }


  getProfileTitle ( profile: any ): string {
    return (
      profile?.businessName ||
      profile?.displayName ||
      profile?.companyName ||
      'Business'
    ).toString().trim();
  }

  getProfileSummary ( profile: any ): string {
    if ( this.isSeededTeaserProfile( profile ) ) {
      return (
        profile?.pinnedIntro ||
        profile?.description ||
        profile?.companyDescription ||
        profile?.tagline ||
        'A lightweight preview is live now. Claim the profile to complete the full SayIt page.'
      ).toString().trim();
    }

    const rawServices = profile?.services || profile?.capabilities || profile?.specialties;
    const servicesSummary = Array.isArray( rawServices )
      ? rawServices
        .map( ( value: any ) => String( value || '' ).trim() )
        .filter( ( value: string ) => !!value )
        .slice( 0, 5 )
        .join( ', ' )
      : String( rawServices || '' ).trim();

    return (
      profile?.pinnedIntro ||
      profile?.description ||
      profile?.companyDescription ||
      profile?.tagline ||
      profile?.intentText ||
      profile?.sellText ||
      servicesSummary ||
      'Business updates on SayIt.'
    ).toString().trim();
  }

  getCompleteness ( profile: any ): number {
    const checks = [
      profile?.displayName,
      profile?.businessName,
      profile?.businessCategory || profile?.industry,
      profile?.location,
      profile?.websiteUrl || profile?.website,
      profile?.intentText || profile?.sellText,
      profile?.tagline,
      profile?.pinnedIntro || profile?.description,
      profile?.email || profile?.businessEmail || profile?.contactEmail,
      profile?.phone || profile?.businessPhone || profile?.contactPhone,
      profile?.services || profile?.capabilities || profile?.specialties,
    ];

    const completed = checks.filter( value => String( value || '' ).trim().length > 0 ).length;
    return Math.round( ( completed / checks.length ) * 100 );
  }

  getActivityLabel ( profile: any ): string {
    if ( this.isSeededTeaserProfile( profile ) ) {
      return this.getSeedStatusLabel( profile );
    }

    const ageDays = this.getAgeInDays( profile?.lastUpdated || profile?.createdAt );

    if ( ageDays <= 2 ) return 'Active recently';
    if ( ageDays <= 7 ) return 'Active this week';
    if ( ageDays <= 30 ) return 'Active this month';
    return 'Quiet recently';
  }

  getTrustLabel ( profile: any ): string {
    if ( this.isSeededTeaserProfile( profile ) ) return 'Claimable teaser';

    const completeness = this.getCompleteness( profile );
    const watcherCount = Number( profile?.watcherCount || 0 );
    const hasWebsite = this.hasListedWebsite( profile );
    const domainAligned = this.isDomainAligned( profile );

    if ( completeness >= 85 && hasWebsite && watcherCount >= 3 && domainAligned ) return 'Verified-looking';
    if ( completeness >= 85 && hasWebsite && watcherCount >= 3 ) return 'Strong signal';
    if ( completeness >= 70 && hasWebsite ) return 'Credible profile';
    if ( completeness >= 50 ) return 'Growing profile';
    return 'Needs more detail';
  }

  hasListedWebsite ( profile: any ): boolean {
    const raw = String( profile?.websiteUrl || profile?.website || profile?.url || '' ).trim();
    if ( !raw ) return false;

    const normalized = /^https?:\/\//i.test( raw ) ? raw : `https://${raw}`;
    try {
      const url = new URL( normalized );
      return !!url.hostname && url.hostname.includes( '.' ) && !url.hostname.includes( ' ' );
    } catch {
      return false;
    }
  }

  isDomainAligned ( profile: any ): boolean {
    const email = String( profile?.email || '' ).trim().toLowerCase();
    if ( !email || !email.includes( '@' ) || !this.hasListedWebsite( profile ) ) return false;

    const emailDomain = email.split( '@' )[1];
    const raw = String( profile?.websiteUrl || profile?.website || profile?.url || '' ).trim();
    const normalized = /^https?:\/\//i.test( raw ) ? raw : `https://${raw}`;

    try {
      const hostname = new URL( normalized ).hostname.toLowerCase().replace( /^www\./, '' );
      return hostname === emailDomain || hostname.endsWith( `.${emailDomain}` ) || emailDomain.endsWith( `.${hostname}` );
    } catch {
      return false;
    }
  }

  private async loadProfiles (): Promise<void> {
    this.loading = true;
    try {
      this.logger.info( '[SayIt Directory Page] load start', {
        browseMode: this.browseMode,
        categoryFilter: this.categoryFilter,
        searchTerm: this.searchTerm || '',
      } );

      this.profiles = await this.dataService.getPublicSayItProfilesOnce( 'SayIt Public Directory', { limit: 100 } );
      if ( !this.profiles.length ) {
        this.logger.warn( '[SayIt Directory Page] first read returned empty, retrying' );
        this.profiles = await this.dataService.getPublicSayItProfilesOnce( 'SayIt Public Directory Retry', { limit: 100 } );
      }

      this.logger.info( '[SayIt Directory Page] load result', {
        rawCount: this.profiles.length,
        filteredCount: this.filteredProfiles.length,
        sampleIds: this.profiles.slice( 0, 5 ).map( ( profile: any ) => String( profile?.id || profile?.uid || '' ) ),
        sampleLabels: this.profiles.slice( 0, 5 ).map( ( profile: any ) =>
          String( profile?.businessName || profile?.displayName || profile?.companyName || '' )
        ),
      } );
    } catch ( e ) {
      this.logger.error( 'loadProfiles error', e );
      this.profiles = [];
    } finally {
      this.loading = false;
    }
  }

  isSeededTeaserProfile ( profile: any ): boolean {
    return String( profile?.profileSource || '' ).trim() === 'lead_vault_seed'
      && String( profile?.directoryVisibility || '' ).trim().toLowerCase() === 'public_teaser';
  }

  getSeedStatusLabel ( profile: any ): string {
    const status = String( profile?.seedStatus || '' ).trim().toLowerCase();
    if ( status === 'invited' ) return 'Invited to join';
    if ( status === 'claimed' ) return 'Claimed';
    return 'Claim this profile';
  }

  getProfilePresenceCopy ( profile: any ): string {
    return this.isSeededTeaserProfile( profile )
      ? 'This page is a seeded directory teaser built from existing business data until the owner claims it.'
      : 'This business is active on SayIt.';
  }

  private compareProfiles ( a: any, b: any ): number {
    const compareDesc = ( left: number, right: number ): number => right - left;

    const aLastUpdated = this.extractDateValue( a?.lastUpdated || a?.createdAt );
    const bLastUpdated = this.extractDateValue( b?.lastUpdated || b?.createdAt );
    const aCreated = this.extractDateValue( a?.createdAt || a?.lastUpdated );
    const bCreated = this.extractDateValue( b?.createdAt || b?.lastUpdated );
    const aWatchers = Number( a?.watcherCount || 0 );
    const bWatchers = Number( b?.watcherCount || 0 );
    const aCompleteness = this.getCompleteness( a );
    const bCompleteness = this.getCompleteness( b );

    switch ( this.browseMode ) {
      case 'watched': {
        return (
          compareDesc( aWatchers, bWatchers ) ||
          compareDesc( aCompleteness, bCompleteness ) ||
          compareDesc( aLastUpdated, bLastUpdated )
        );
      }
      case 'new': {
        return compareDesc( aCreated, bCreated ) || compareDesc( aLastUpdated, bLastUpdated );
      }
      case 'complete': {
        return (
          compareDesc( aCompleteness, bCompleteness ) ||
          compareDesc( aWatchers, bWatchers ) ||
          compareDesc( aLastUpdated, bLastUpdated )
        );
      }
      case 'active':
      default: {
        return (
          compareDesc( aLastUpdated, bLastUpdated ) ||
          compareDesc( aWatchers, bWatchers ) ||
          compareDesc( aCompleteness, bCompleteness )
        );
      }
    }
  }

  private extractDateValue ( raw: any ): number {
    try {
      const date = raw?.toDate ? raw.toDate() : new Date( raw );
      const millis = date?.getTime?.() ?? 0;
      return Number.isFinite( millis ) ? millis : 0;
    } catch {
      return 0;
    }
  }

  private getAgeInDays ( raw: any ): number {
    const millis = this.extractDateValue( raw );
    if ( !millis ) return Number.POSITIVE_INFINITY;
    return Math.max( 0, Math.floor( ( Date.now() - millis ) / 86400000 ) );
  }

  private normalizeCategory ( profile: any ): string {
    return String( profile?.businessCategory || profile?.industry || profile?.category || 'all' )
      .trim()
      .toLowerCase() || 'all';
  }
}
