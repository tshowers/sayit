import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'linkify',
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  transform(value: any): string {
    // this.logger.log('LinkifyPipe input:', value); 
    if (typeof value !== 'string') {
      return value;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return value.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank">shared link</a>`;
    });
  }
}
