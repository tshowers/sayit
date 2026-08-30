import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'getVideoIcon',
  pure: true // ensures Angular can optimize
})
export class GetVideoIconPipe implements PipeTransform {
  transform(url: string): string {
    if (!url) return '/assets/nophoto.svg';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'assets/youtube-icon-5.svg';
    if (url.includes('vimeo.com')) return 'assets/vimeo-icon-blue.svg';
    if (url.includes('tiktok.com')) return 'assets/tiktok-icon-black.svg';
    return '/assets/nophoto.svg';
  }
}