import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'isVideoLink',
  standalone: true
})
export class IsVideoLinkPipe implements PipeTransform {

  transform(url: string): boolean {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be|be\.com)\/(?:watch\?v=|embed\/|v\/)?([^&\s]+)/;
    const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
    const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/.+\/video\/(\d+)/;

    return youtubeRegex.test(url) || vimeoRegex.test(url) || tiktokRegex.test(url);
  }

}
