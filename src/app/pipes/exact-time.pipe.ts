import { Pipe, PipeTransform } from '@angular/core';
import { format } from 'date-fns';

@Pipe({
  name: 'exactTime',
  standalone: true
})
export class ExactTimePipe implements PipeTransform {

  transform(value: Date | string): string {
    const date = typeof value === 'string' ? new Date(value) : value;
    return format(date, 'PPpp');
  }

}
