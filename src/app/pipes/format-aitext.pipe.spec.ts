import { FormatAITextPipe } from './format-aitext.pipe';

describe( 'FormatAITextPipe', () => {
  const pipe = new FormatAITextPipe();

  it( 'returns falsy input unchanged', () => {
    expect( pipe.transform( '' ) ).toBe( '' );
  } );

  it( 'unwraps a JSON { response } payload', () => {
    expect( pipe.transform( JSON.stringify( { response: 'Hello there' } ) ) ).toBe( 'Hello there' );
  } );

  it( 'converts markdown headings and bold text to HTML', () => {
    expect( pipe.transform( '## Title' ) ).toBe( '<h2>Title</h2>' );
    expect( pipe.transform( 'a **bold** word' ) ).toBe( 'a <b>bold</b> word' );
  } );

  it( 'turns dashes into bullets and newlines into breaks', () => {
    expect( pipe.transform( '- one\n- two' ) ).toBe( '• one<br><br>• two' );
  } );
} );
