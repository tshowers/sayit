import { Pipe, PipeTransform } from '@angular/core';

@Pipe( {
  name: 'extractVideoId',
  standalone: true
} )
export class ExtractVideoIdPipe implements PipeTransform {

  transform ( url: string, platform: string ): string | null {
    let regex;
    switch ( platform ) {
      case 'youtube':
        regex = /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be|be\.com)\/(?:watch\?v=|embed\/|v\/)?([^&\s]+)/;
        break;
      case 'vimeo':
        regex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
        break;
      case 'tiktok':
        regex = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/.+\/video\/(\d+)/;
        break;
      default:
        return null;
    }
    const match = url.match( regex );

    return match ? match[1].split( '?' )[0] : null;
  }

}
