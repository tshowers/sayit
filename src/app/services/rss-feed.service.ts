import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class RssFeedService {


  constructor(private http: HttpClient, private logger: LoggerService) { }

  /**
   * Retrieves an array of RSS feed items from a specified URL and maps each item to include an image property.
   * If an item contains an enclosure, the image property is set to the enclosure's link; otherwise, it defaults to an empty string.
   *
   * @returns {Observable<any[]>} An Observable that emits an array of feed items with added image properties.
   */
  getFeed(): Observable<any[]> {
    const rssToJsonServiceUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://taliferro.blog/rss.xml';
    return this.http.get<any>(rssToJsonServiceUrl)
      .pipe(
        map(response => response.items.map((item: { enclosure: string; }) => ({
          ...item,
          image: item.enclosure ? item.enclosure.link : ''
        })))
      );
  }

  /**
   * Fetches an RSS feed and converts it to a JSON representation. Optionally takes the RSS
   * feed directly without conversion if `straightFeed` is true.
   * @param {string} feed - The URL of the RSS feed to fetch.
   * @param {boolean} [straightFeed] - Boolean flag to determine whether to convert the feed to JSON or use it directly.
   * @returns {Observable<any[]>} An Observable that emits the list of items in the feed as JSON objects.
   */
  getRSSFeed(feed: string, straightFeed?: boolean): Observable<any[]> {
    let rssToJsonServiceUrl;
    if (straightFeed)
      rssToJsonServiceUrl = feed;
    else
      rssToJsonServiceUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + feed;

    this.logger.log(rssToJsonServiceUrl);
    return this.http.get<any>(rssToJsonServiceUrl)
      .pipe(
        map(response => {
          this.logger.log('Full response:', response);  // Log the full response to see what is returned
          return response.items.map((item: any) => ({
            ...item,
            image: item.enclosure ? item.enclosure.link : '',
          }));
        })
      );
  }
}
