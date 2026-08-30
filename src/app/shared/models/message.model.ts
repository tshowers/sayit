import { Article } from './article.model';
/*****************************************************************************
 *                 Taliferro License Notice
 *
 * The contents of this file are subject to the Taliferro License
 * (the "License"). You may not use this file except in
 * compliance with the License. A copy of the License is available at
 * http://taliferro.com/license/
 *
 *
 * Title: Message
 * @author Tyrone Showers
 *
 * @copyright 1997-2026 Taliferro, Inc. All Rights Reserved.
 *
 *        Change Log
 *
 * Version     Date       Description
 * -------   ----------  -------------------------------------------------------
 *  0.1      11/13/2017  Baselined
 *  0.2      04/23/2024  Upgrade to 17 and adhere to Typescript Naming
 *****************************************************************************/

export interface Message {
  text: string;
  name: string;

  linkUrl?: string;
  article?: Article;

  replies?: Array<any>;

  iconClass?: string;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  isPrivate: boolean;
}

export interface Post {
  id: string;
  /**
   * Firebase UID of the author.
   * Prefer this over `user` which is retained for backward compatibility.
   */
  userId?: string;
  /** @deprecated Use userId instead. Retained for backward compatibility. */
  user?: string;
  displayName?: string;
  authorContactId?: string; // Contact.id if linked to a contact
  authorHandle?: string; // Shortcut for routing to /u/:handle
  content: string;
  imageUrl: string;
  image?: string;
  category: string;
  postImageUrl?: string | null;
  postImageThumbUrl?: string | null; // if you ever generate thumbnails
  postImagePath?: string | null;     // storage path if you need deletes later

  /**
   * When reading from Firestore, normalize to `Date` in the data service (e.g., ts.toDate()).
   * This interface expects a Date instance at render time.
   */
  timestamp: Date;
  likeUserIds: string[];
  linkPreview?: {
    title: string;
    description: string;
    url: string;
    image: string;
  };
  contentRating: number;
  ratingExplanation: string;
  favoriteCount: number;
  emailAddress: string;
  isInternal: boolean;
  tenantId: string | null;
  groupId?: string; // Optional groupId for group posts
}
