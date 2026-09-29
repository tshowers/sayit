import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component( {
  selector: 'app-not-authorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div data-cy="not-authorized-shell" style="max-width: 480px; margin: 4rem auto; text-align: center; padding: 0 1rem;">
      <h1>Not authorized</h1>
      <p>You don't have access to this page.</p>
      <a routerLink="/">Back to Say It</a>
    </div>
  `,
} )
export class NotAuthorizedComponent { }
