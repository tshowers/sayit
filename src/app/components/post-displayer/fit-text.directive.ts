import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output } from '@angular/core';

/**
 * Sets the element's font size to the largest of `syFitText` (px, largest
 * first) at which its text fits its box. If even the smallest overflows, the
 * smallest is kept and `clampedChange` emits true (the caller shows "Read
 * more"). Refits when the box resizes or `syFitTextKey` changes.
 */
@Directive( {
  selector: '[syFitText]',
  standalone: true,
} )
export class FitTextDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input( 'syFitText' ) sizes: number[] = [];
  /** Anything that changes the text or the space it has (post id, reply count). */
  @Input() syFitTextKey: unknown;
  @Output() clampedChange = new EventEmitter<boolean>();

  private observer?: ResizeObserver;
  private clamped = false;
  private frame = 0;
  private lastInputs = '';

  constructor ( private el: ElementRef<HTMLElement>, private zone: NgZone ) { }

  ngAfterViewInit (): void {
    this.zone.runOutsideAngular( () => {
      this.observer = new ResizeObserver( () => this.schedule() );
      this.observer.observe( this.el.nativeElement );
    } );
    this.schedule();
  }

  /** Callers pass a fresh array each change detection; only refit on a real change. */
  ngOnChanges (): void {
    const inputs = JSON.stringify( [this.sizes, this.syFitTextKey] );
    if ( inputs === this.lastInputs ) return;
    this.lastInputs = inputs;
    this.schedule();
  }

  ngOnDestroy (): void {
    this.observer?.disconnect();
    cancelAnimationFrame( this.frame );
  }

  /** One fit per frame; a pending one is never pushed back. */
  private schedule (): void {
    if ( this.frame ) return;
    this.frame = requestAnimationFrame( () => {
      this.frame = 0;
      this.fit();
    } );
  }

  private fit (): void {
    const el = this.el.nativeElement;
    if ( !this.sizes.length || !el.isConnected || el.clientHeight === 0 ) return;
    let fits = false;
    for ( const size of this.sizes ) {
      el.style.fontSize = `${size}px`;
      if ( el.scrollHeight <= el.clientHeight + 1 ) {
        fits = true;
        break;
      }
    }
    if ( fits !== !this.clamped ) {
      this.clamped = !fits;
      this.zone.run( () => this.clampedChange.emit( this.clamped ) );
    }
  }
}
