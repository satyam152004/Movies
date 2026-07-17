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
      items.push({
        title,
        url,
        imageUrl,
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
