import { AIContentExtractorPipe } from './aicontent-extractor.pipe';

describe( 'AIContentExtractorPipe', () => {
  const pipe = new AIContentExtractorPipe();

  it( 'returns an empty string for null or undefined', () => {
    expect( pipe.transform( null ) ).toBe( '' );
    expect( pipe.transform( undefined ) ).toBe( '' );
  } );

  it( 'unwraps an object with a response field', () => {
    expect( pipe.transform( { response: 'Answer' } ) ).toBe( 'Answer' );
  } );

  it( 'passes strings and other values through', () => {
    expect( pipe.transform( 'plain' ) ).toBe( 'plain' );
    expect( pipe.transform( 7 ) ).toBe( 7 );
  } );
} );
