import * as cheerio from 'cheerio';
import {CatalogItem} from '../model/movie.model';

/**
 * Parses catalog/listing page HTML to extract movie cards and pagination links
 */
export function parseCatalog(
  html: string,
  baseUrl: string,
): {items: CatalogItem[]; nextPageUrl: string | null} {
  const $ = cheerio.load(html);
  const items: CatalogItem[] = [];

  $('li.thumb, .thumb').each((_, el) => {
    const $el = $(el);

    // Get Detail Link
    let url =
      $el.find('figure a').attr('href') ||
      $el.find('figcaption a').attr('href') ||
      '';
    if (url && !url.startsWith('http')) {
      url = new URL(url, baseUrl).toString();
    }

    // Get Title
    let title =
      $el.find('figcaption p').text().trim() ||
      $el.find('img').attr('alt')?.trim() ||
      $el.find('img').attr('title')?.trim() ||
      'Unknown Movie';

    // Get Thumbnail/Poster Image
    const $img = $el.find('img');
    let imageUrl =
      $img.attr('data-src') ||
      $img.attr('data-lazy-src') ||
      $img.attr('data-original') ||
      $img.attr('src') ||
      '';

    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = new URL(imageUrl, baseUrl).toString();
    }

    if (url && title) {
      // Extract year (4 digit starting with 19 or 20)
      const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : undefined;

      // Extract resolution
      const resMatch = title.match(/(480p|720p|1080p|2160p|4K|8K)/i);
      const resolution = resMatch ? resMatch[1].toLowerCase() : undefined;

      // Extract dual audio status
      const isDualAudio =
        /dual[- ]?audio/i.test(title) ||
        (title.toLowerCase().includes('hindi') &&
          title.toLowerCase().includes('english'));

      // Extract HEVC codec status
      const isHEVC = /hevc|x265|10bit/i.test(title);

      // Extract rating from badge/imdb classes if present
      let rating = $el
        .find('.imdb, .rating, [class*="rating"], [class*="imdb"]')
        .text()
        .trim();
      if (rating) {
        rating = rating.replace(/imdb|★|⭐|\/10/gi, '').trim();
      }

      items.push({
        title,
        url,
        imageUrl,
        year,
        resolution,
        isDualAudio,
        isHEVC,
        rating: rating || undefined,
      });
    }
  });

  // Parse next page URL
  let nextPageUrl: string | null = null;
  const $nextBtn = $('.pagination-wrap a.next, .pagination-wrap a.page-numbers')
    .filter((_, el) => {
      const text = $(el).text().toLowerCase();
      const classList = $(el).attr('class') || '';
      return (
        text.includes('next') ||
        classList.includes('next') ||
        $(el).find('i').text().toLowerCase().includes('next') ||
        $(el).find('span').text().toLowerCase().includes('next')
      );
    })
    .first();

  if ($nextBtn.length) {
    const href = $nextBtn.attr('href');
    if (href) {
      nextPageUrl = href.startsWith('http')
        ? href
        : new URL(href, baseUrl).toString();
    }
  }

  return {items, nextPageUrl};
}
