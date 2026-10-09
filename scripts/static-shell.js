/**
 * After `ng build`: writes index.csr.html, the app shell every route except
 * "/" is served from (firebase.json rewrites ** to it). It's index.html
 * without the static landing, so /post/... and other pages don't show the
 * home page's words before the app starts, and crawlers don't read them
 * there. "/" itself is served index.html, landing included.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const dir = path.join( __dirname, '..', 'dist', 'sayit', 'browser' );
const html = fs.readFileSync( path.join( dir, 'index.html' ), 'utf8' );
const pattern = /<!--static-landing:start-->[\s\S]*?<!--static-landing:end-->/;

if ( !pattern.test( html ) ) {
  console.error( 'static-shell: no static landing markers in index.html' );
  process.exit( 1 );
}

fs.writeFileSync( path.join( dir, 'index.csr.html' ), html.replace( pattern, '' ) );
console.log( 'static-shell: wrote index.csr.html' );
