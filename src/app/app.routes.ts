import { Routes } from '@angular/router';
import { sayItSignInGuard } from './guards/sayit-signin.guard';
import { sayItProfilePageGuard } from './guards/sayit-profile-page.guard';
import { legacyPostLinkGuard } from './guards/legacy-post-link.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './chat-board/chat-board.component' ).then( ( m ) => m.ChatBoardComponent ),
    title: 'Say It',
    canActivate: [legacyPostLinkGuard],
  },
  {
    path: 'businesses',
    loadComponent: () =>
      import( './sayit-business-directory/sayit-business-directory.component' ).then( ( m ) => m.SayitBusinessDirectoryComponent ),
    title: 'Say It - Directory',
  },
  {
    path: 'business/:identifier',
    loadComponent: () =>
      import( './sayit-business-profile/sayit-business-profile.component' ).then( ( m ) => m.SayitBusinessProfileComponent ),
    title: 'Say It - Business',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import( './sayit-profile-editor/sayit-profile-editor.component' ).then( ( m ) => m.SayitProfileEditorComponent ),
    title: 'Say It - Profile',
    canActivate: [sayItProfilePageGuard],
  },
  {
    path: 'interests',
    loadComponent: () =>
      import( './interest-inbox/interest-inbox.component' ).then( ( m ) => m.InterestInboxComponent ),
    title: 'Say It - Interests',
    canActivate: [sayItSignInGuard],
  },
  {
    path: 'get-started',
    loadComponent: () =>
      import( './get-started/get-started.component' ).then( ( m ) => m.GetStartedComponent ),
    title: 'Say It - Get Started',
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import( './auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
    title: 'Say It - Signing In',
  },
  {
    path: 'login',
    loadComponent: () =>
      import( './components/sayit-login/sayit-login.component' ).then( ( m ) => m.SayitLoginComponent ),
    title: 'Say It - Sign In',
  },
  {
    path: 'post/:id',
    loadComponent: () =>
      import( './post-view/post-view.component' ).then( ( m ) => m.PostViewComponent ),
    // Public, so shared links work for anyone; the page itself hides
    // commenting and other actions until the visitor signs in.
    title: 'Say It - Post',
  },
  {
    path: 'not-authorized',
    loadComponent: () =>
      import( './not-authorized/not-authorized.component' ).then( ( m ) => m.NotAuthorizedComponent ),
    title: 'Say It - Not Authorized',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
