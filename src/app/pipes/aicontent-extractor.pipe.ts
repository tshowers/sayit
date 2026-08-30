import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'aicontentextractor',
  standalone: true
})
export class AIContentExtractorPipe implements PipeTransform {
  transform(value: any): any {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object' && value.response) {
      value = value.response;
    }

    if (typeof value !== 'string') {
      return value;
    }

    // Apply the desired formatting to the string
    return value.replace(/some pattern/g, 'replacement text'); // Adjust this line as needed
  }

}
