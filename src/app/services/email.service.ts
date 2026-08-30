import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import { Email } from '../shared/models/email.model';

@Injectable( { providedIn: 'root' } )
export class EmailService {
  footer: string = `<div style="text-align: center; margin-top: 20px; font-size: 0.8em; color: #777777; background-color: #f4f4f4; padding: 10px 0;">
  <p>
  © 2026
  <a href="https://taliferro.com" style="color: #1a73e8; text-decoration: none;">Taliferro</a>.
  Email sent from
  <a href="https://sayit.taliferro.tech" style="color: #1a73e8; text-decoration: none;">Say It</a>.
  taliferro-tech-unsubscribe.
  </p>
  </div>
  `;

  constructor ( private http: HttpClient, private logger: LoggerService ) { }

  public sendEmail ( email: Email, tenantId: string, user: string ): Observable<any> {
    this.logger.info( 'SEND EMAIL', {
      tenantId,
      user,
      to: ( email as any )?.to,
      subject: ( email as any )?.subject
    } );

    return this.http.post( `${environment.backendURL}/send-email`, { ...email, tenantId } ).pipe(
      tap( response => {
        this.logger.info( 'Email server responded successfully:', response );
      } ),
      catchError( err => {
        const sendError = this.buildSendEmailError( err );
        this.logger.error( 'Email server returned error:', {
          originalError: err,
          message: sendError.message
        } );
        return throwError( () => sendError );
      } )
    );
  }

  public sendPostInterestEmail (
    toEmail: string,
    userId: string,
    overrides?: {
      postId?: string;
      postPreview?: string;
      interestedUid?: string;
      interestedDisplayName?: string;
      interestedHandle?: string;
      message?: string;
    }
  ): Observable<any> {
    const params = {
      toEmail,
      postId: ( overrides?.postId || '' ),
      postPreview: overrides?.postPreview,
      interestedUid: overrides?.interestedUid,
      interestedDisplayName: overrides?.interestedDisplayName,
      interestedHandle: overrides?.interestedHandle,
      message: overrides?.message,
    };

    const email = ( params?.toEmail || '' ).trim();
    const postId = ( params?.postId || '' ).trim();

    if ( !email || !postId ) {
      this.logger.warn( 'sendPostInterestEmail skipped: missing toEmail or postId', params );
      return of( null );
    }

    const who = ( params?.interestedDisplayName || params?.interestedHandle || 'Someone' ).trim();
    const handle = ( params?.interestedHandle || '' ).trim();

    const previewRaw = ( params?.postPreview || '' ).trim();
    const preview = previewRaw ? previewRaw.slice( 0, 180 ) : '—';

    const noteRaw = ( params?.message || '' ).trim();

    const postUrl = `${window.location.origin}/post/${encodeURIComponent( postId )}`;

    const subject = `Someone is interested in your post`;

    const textBody = [
      'Hello,',
      '',
      `${who}${handle ? ` (@${handle})` : ''} tapped “I’m interested” on your post.`,
      '',
      'Post:',
      preview,
      '',
      noteRaw ? 'Message:' : '',
      noteRaw ? noteRaw : '',
      noteRaw ? '' : '',
      `View it in-app: ${postUrl}`,
      '',
      '— Say It',
    ].filter( Boolean ).join( '\n' );

    const escapeHtml = ( s: string ) =>
      String( s )
        .replace( /&/g, '&amp;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' )
        .replace( /"/g, '&quot;' )
        .replace( /'/g, '&#39;' );

    const htmlWho = escapeHtml( who );
    const htmlHandle = handle ? escapeHtml( handle ) : '';
    const htmlPreview = escapeHtml( preview );
    const htmlNote = noteRaw ? escapeHtml( noteRaw ) : '';

    const htmlBody =
      `<p>Hello,</p>` +
      `<p><strong>${htmlWho}</strong>${htmlHandle ? ` (@${htmlHandle})` : ''} tapped <strong>“I’m interested”</strong> on your post.</p>` +
      `<p><strong>Post</strong><br/>${htmlPreview}</p>` +
      ( htmlNote
        ? `<p><strong>Message</strong><br/>${htmlNote}</p>`
        : '' ) +
      `<p><a href="${postUrl}">Open in Say It</a></p>` +
      this.footer;

    const emailPayload: Email & any = {
      to: email,
      cc: 'ty.showers@taliferro.tech',
      subject,
      text: textBody,
      html: `<div>${htmlBody}</div>`,
      contactName: 'Post Interest',
      date: new Date().toISOString(),
      from: 'noreply@taliferro.tech'
    };

    return this.sendEmail( emailPayload as any, environment.taliferroTenantId, userId ).pipe(
      tap( response => this.logger.log( 'Post interest email queued. Response:', response ) ),
      catchError( err => {
        this.logger.error( 'Failed to send post interest email:', err );
        return of( null );
      } )
    );
  }

  private buildSendEmailError ( err: unknown ): Error {
    if ( err instanceof HttpErrorResponse ) {
      const payload = err.error && typeof err.error === 'object' ? err.error as Record<string, any> : {};
      const backendError = String( payload?.['error'] || payload?.['message'] || '' ).trim();

      if ( backendError ) {
        return new Error( backendError );
      }

      if ( err.message ) {
        return new Error( err.message );
      }
    }

    return new Error( 'Failed to send email.' );
  }
}
