/**
 * visitWithFirebaseEmulators works by writing __useFirebaseEmulators and
 * __cypressEmulatorCredentials to localStorage before the app boots.
 * app.config.ts only reads them when window.Cypress is present (see
 * appReady there) - this has no effect outside a Cypress-driven browser,
 * never in production, never in normal dev use.
 */
type EmulatorCredentials = {
  email: string;
  password: string;
};

declare global {
  namespace Cypress {
    interface Chainable {
      visitWithFirebaseEmulators ( path: string, credentials?: EmulatorCredentials, options?: Partial<Cypress.VisitOptions> ): Chainable<AUTWindow>;
      seedFirestoreDoc ( path: string, data: Record<string, unknown> ): Chainable<Cypress.Response<unknown>>;
    }
  }
}

Cypress.Commands.add( 'visitWithFirebaseEmulators', ( path: string, credentials?: EmulatorCredentials, options?: Partial<Cypress.VisitOptions> ) => {
  return cy.visit( path, {
    ...options,
    onBeforeLoad: ( win ) => {
      win.localStorage.setItem( '__useFirebaseEmulators', 'true' );
      if ( credentials ) {
        win.localStorage.setItem( '__cypressEmulatorCredentials', JSON.stringify( credentials ) );
      }

      if ( options?.onBeforeLoad ) {
        options.onBeforeLoad( win );
      }
    },
  } );
} );

/**
 * Writes a document straight into the Firestore emulator over its REST API.
 * "Bearer owner" is the emulator's admin token, so this bypasses
 * firestore.rules - the equivalent of seeding from the Admin SDK. Only ever
 * talks to 127.0.0.1:8380 (see firebase.json), never the real project.
 */
const FIRESTORE_EMULATOR_DOCS = 'http://127.0.0.1:8380/v1/projects/taliferrotech/databases/(default)/documents';

function toFirestoreValue ( value: unknown ): Record<string, unknown> {
  if ( value === null || value === undefined ) return { nullValue: null };
  if ( typeof value === 'boolean' ) return { booleanValue: value };
  if ( typeof value === 'number' ) return Number.isInteger( value ) ? { integerValue: String( value ) } : { doubleValue: value };
  if ( value instanceof Date ) return { timestampValue: value.toISOString() };
  if ( Array.isArray( value ) ) return { arrayValue: { values: value.map( toFirestoreValue ) } };
  if ( typeof value === 'object' ) {
    return { mapValue: { fields: Object.fromEntries( Object.entries( value ).map( ( [k, v] ) => [k, toFirestoreValue( v )] ) ) } };
  }
  return { stringValue: String( value ) };
}

Cypress.Commands.add( 'seedFirestoreDoc', ( path: string, data: Record<string, unknown> ) => {
  return cy.request( {
    method: 'PATCH',
    url: `${FIRESTORE_EMULATOR_DOCS}/${path}`,
    headers: { Authorization: 'Bearer owner' },
    body: { fields: ( toFirestoreValue( data ) as any ).mapValue.fields },
  } );
} );

export { };
