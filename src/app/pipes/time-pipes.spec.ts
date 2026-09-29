import { ExactTimePipe } from './exact-time.pipe';
import { RelativeTimePipe } from './relative-time.pipe';

describe( 'RelativeTimePipe', () => {
  const pipe = new RelativeTimePipe();

  it( 'describes past dates relative to now', () => {
    const twoHoursAgo = new Date( Date.now() - 2 * 60 * 60 * 1000 );
    expect( pipe.transform( twoHoursAgo ) ).toBe( 'about 2 hours ago' );
  } );

  it( 'accepts ISO strings', () => {
    const threeDaysAgo = new Date( Date.now() - 3 * 24 * 60 * 60 * 1000 ).toISOString();
    expect( pipe.transform( threeDaysAgo ) ).toBe( '3 days ago' );
  } );
} );

describe( 'ExactTimePipe', () => {
  const pipe = new ExactTimePipe();

  it( 'formats dates and ISO strings the same way', () => {
    const date = new Date( 2026, 0, 15, 9, 30 );
    expect( pipe.transform( date ) ).toContain( 'Jan 15, 2026' );
    expect( pipe.transform( date.toISOString() ) ).toBe( pipe.transform( date ) );
  } );
} );
