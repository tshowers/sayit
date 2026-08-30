import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'getVideoPlatform',
  standalone: true
})
export class GetVideoPlatformPipe implements PipeTransform {

  transform(url: string): string | null {
    if (/youtu(?:\.be|be\.com)/.test(url)) {
      return 'youtube';
    }
    if (/vimeo\.com/.test(url)) {
      return 'vimeo';
    }
    if (/tiktok\.com/.test(url)) {
      return 'tiktok';
    }
    return null;
  }

}
