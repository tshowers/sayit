import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** SayIt's part of the universal menu: what you can do in SayIt. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'sayit',
  name: 'SayIt',
  items: [
    { label: 'For you', icon: 'home', route: '/', keywords: 'feed home' },
    { label: 'Orgs', icon: 'building', route: '/businesses', keywords: 'businesses companies' },
    { label: 'Inbox', icon: 'inbox', route: '/interests', keywords: 'interests messages' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
