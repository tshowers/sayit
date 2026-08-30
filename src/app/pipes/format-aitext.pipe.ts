import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatAIText',
  standalone: true
})
export class FormatAITextPipe implements PipeTransform {
  private extractDisplayText(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    const tryParse = (input: string): string | null => {
      try {
        const parsed = JSON.parse(input);
        if (typeof parsed === 'string') {
          return parsed;
        }

        if (parsed && typeof parsed === 'object') {
          const candidate = parsed.response || parsed.text || parsed.content || parsed.message;
          if (typeof candidate === 'string') {
            return candidate;
          }
        }
      } catch {
        return null;
      }

      return null;
    };

    const parsed = tryParse(raw);
    if (parsed) {
      return parsed;
    }

    const unescaped = raw
      .replace(/^"(.*)"$/s, '$1')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');

    const parsedUnescaped = tryParse(unescaped);
    return parsedUnescaped || unescaped;
  }

  private cleanTransportNoise(value: string): string {
    let cleaned = String(value || '');

    cleaned = cleaned
      .replace(/^\s*\{\s*/g, '')
      .replace(/\s*\}\s*$/g, '')
      .replace(/^\s*"response"\s*:\s*/gm, '')
      .replace(/^\s*"text"\s*:\s*/gm, '')
      .replace(/^\s*"content"\s*:\s*/gm, '')
      .replace(/^\s*"message"\s*:\s*/gm, '')
      .replace(/^\s*"route"\s*:\s*null\s*,?\s*$/gim, '')
      .replace(/^\s*"action"\s*:\s*null\s*,?\s*$/gim, '')
      .replace(/^\s*"[^"]+"\s*:\s*null\s*,?\s*$/gim, '')
      .replace(/,\s*$/gm, '')
      .replace(/^"(.*)"$/s, '$1')
      .replace(/\\"/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned;
  }

  transform(value: string): string {
    if (!value) {
      return value;
    }

    value = this.extractDisplayText(value);
    value = this.cleanTransportNoise(value);

    // Replace hashtags with corresponding HTML heading tags
    value = value.replace(/^#### (.*?)$/gm, '<h4>$1</h4>') // Convert ### to <h3>
                 .replace(/^### (.*?)$/gm, '<h3>$1</h3>') // Convert ### to <h3>
                 .replace(/^## (.*?)$/gm, '<h2>$1</h2>')  // Convert ## to <h2>
                 .replace(/^# (.*?)$/gm, '<h1>$1</h1>');   // Convert # to <h1>

    // Replace '**' with bold HTML tags
    value = value.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // Replace numbered list indicators with new lines and formatting
    value = value.replace(/(\d+\.\s\*\*.*?\*\*)/g, '<br>$1<br>');

    value = value.replace(/(^|\n)-\s+/g, '$1• ');

    // Replace double newlines with paragraph breaks
    value = value.replace(/\n+/g, '<br><br>');

    return value;
  }

}
