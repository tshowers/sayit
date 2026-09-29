import { Pipe, PipeTransform } from '@angular/core';
import { Post } from '../shared/models/message.model';

@Pipe({
  name: 'authorProfileUrl'
})
export class AuthorProfileUrlPipe implements PipeTransform {

  transform(post: Post | null | undefined): string[] | null {
    try {
      if (!post) return null;
      // Do not link system or Newsstand posts
      if ((post as any).user === 'TODD' || (post as any).category === 'news') return null;

      const handle: any = (post as any).authorHandle;
      if (handle) return ['/business', String(handle)];

      const uid = (post as any).userId || (post as any).user;
      if (uid) return ['/business', String(uid)];

      return null;
    } catch {
      return null;
    }
  }

}
