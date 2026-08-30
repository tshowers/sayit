import { Routes } from '@angular/router';
import { sayItSignInGuard } from './guards/sayit-signin.guard';
import { sayItProfilePageGuard } from './guards/sayit-profile-page.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import( './chat-board/chat-board.component' ).then( ( m ) => m.ChatBoardComponent ),
    title: 'Say It',
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
    path: 'login',
    loadComponent: () =>
      import( './components/sayit-login/sayit-login.component' ).then( ( m ) => m.SayitLoginComponent ),
    title: 'Say It - Sign In',
  },
  {
    path: 'post/:id',
    loadComponent: () =>
      import( './post-view/post-view.component' ).then( ( m ) => m.PostViewComponent ),
    title: 'Say It - Post',
    canActivate: [sayItSignInGuard],
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
