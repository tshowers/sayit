
/*****************************************************************************
*                 Taliferro License Notice
*
* The contents of this file are subject to the Taliferro License
* (the "License"). You may not use this file except in
* compliance with the License. A copy of the License is available at
* http://taliferro.com/license/
*
*
* Title: Artcle
* @author Tyrone Showers
*
* @copyright 1997-2026 Taliferro, Inc. All Rights Reserved.
*
*        Change Log
*
* Version     Date       Description
* -------   ----------  -------------------------------------------------------
*  0.1      04/23/2024  Upgrade to 17 and adhere to Typescript Naming 
*****************************************************************************/

export interface Article {

  title: string;
  link: string;
  pubDate: string;

  blog_id: string;
  _isPermaLink: boolean;
  __text: string;
  description: string;
  articleText: string;

  url: string;

  author: string; 
  urlToImage: string; 
  publishedAt: string;

  
}
