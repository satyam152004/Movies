import * as cheerio from 'cheerio';
import {MovieDetail, DownloadLink} from '../model/movie.model';

/**
 * Parses individual movie detail pages to extract complete metadata and link sheets
 */
export function parseMovieDetail(html: string, pageUrl: string): MovieDetail {
  const $ = cheerio.load(html);

  // 1. Extract Title
  let title =
    $('.page-title .material-text').text().trim() ||
    $('.page-title').text().trim() ||
    $('h1').first().text().trim() ||
    '';
  // Strip icon text if included
  title = title.replace(/^[\s\S]*?(?=\b[A-Za-z0-9])/, '').trim();

  // 2. Date
  const date =
    $('.page-meta em.material-text b').text().trim() ||
    $('.page-meta span').first().text().trim() ||
    '';

  // 3. Categories / Genres from metadata top row
  const categories: string[] = [];
  $('.page-meta a[href*="/category/"]').each((_, el) => {
    const cat =
      $(el).find('em.material-text').text().trim() || $(el).text().trim();
    if (cat && !categories.includes(cat)) {
      categories.push(cat);
    }
  });

  const pageBody = $('.page-body, main, #main, article').first();
  const bodyText = pageBody.text();

  // 4. Poster Image
  let imageUrl =
    pageBody
      .find('img.aligncenter, img[class*="aligncenter"]')
      .first()
      .attr('src') ||
    pageBody.find('img').first().attr('src') ||
    '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = new URL(imageUrl, pageUrl).toString();
  }

  // Helper to extract fields using text matching
  const extractSpec = (regex: RegExp): string => {
    const match = bodyText.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
    return '';
  };

  // 5. Spec Row Extractions
  // Match "iMDB Rating: 8.0/10" or "iMDB: 8.0"
  let imdbRating =
    extractSpec(/iMDB\s*Rating\s*:\s*([^\n|]+)/i) ||
    extractSpec(/iMDB\s*:\s*([^\n|]+)/i) ||
    '';

  // Genres
  const genresStr = extractSpec(/Genre\s*s?\s*:\s*([^\n|]+)/i);
  const genres = genresStr
    ? genresStr
        .split(/[|,/]/)
        .map(g => g.trim())
        .filter(Boolean)
    : [];

  // Stars
  const starsStr =
    extractSpec(/Stars\s*:\s*([^\n|]+)/i) ||
    extractSpec(/Cast\s*:\s*([^\n|]+)/i);
  const stars = starsStr
    ? starsStr
        .split(/[,|]/)
        .map(s => s.trim())
        .filter(Boolean)
    : [];

  // Technical properties
  const director = extractSpec(/Director\s*s?\s*:\s*([^\n|]+)/i);
  const language = extractSpec(/Language\s*s?\s*:\s*([^\n|]+)/i);
  const quality = extractSpec(/Quality\s*:\s*([^\n|]+)/i);

  // 6. Storyline
  let storyline = '';
  // Try search-result description structure
  const descContainer = pageBody.find('.kno-rdesc');
  if (descContainer.length) {
    storyline = descContainer
      .text()
      .replace(/^.*?(Storyline|Description)?\s*:\s*/i, '')
      .trim();
  }
  if (!storyline) {
    // Search body paragraphs containing Storyline
    pageBody.find('p, div').each((_, el) => {
      const text = $(el).text();
      if (/Storyline|Synopsis/i.test(text) && text.length > 20) {
        storyline = text.replace(/^.*?(Storyline|Synopsis)\s*:\s*/i, '').trim();
        return false; // break loop
      }
    });
  }

  // 7. Screenshots
  const screenshots: string[] = [];
  pageBody.find('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      const isScreenshot =
        src.includes('.th.') ||
        src.includes('catimages.co') ||
        src.includes('imgshare.info') ||
        src.includes('screenshot');
      const isNotPoster = src !== imageUrl && !src.includes('joinwhatsapp');

      if (isScreenshot || (isNotPoster && screenshots.length < 6)) {
        const fullUrl = src.startsWith('http')
          ? src
          : new URL(src, pageUrl).toString();
        if (!screenshots.includes(fullUrl)) {
          screenshots.push(fullUrl);
        }
      }
    }
  });

  // 8. Download & Watch Links
  const downloadLinks: DownloadLink[] = [];
  pageBody.find('a[href]').each((_, el) => {
    const $link = $(el);
    const href = $link.attr('href') || '';
    const label = $link.text().trim();

    if (!href || href === '#' || href.startsWith('javascript:')) {
      return;
    }

    // Filter out internal nav tags, categories, tags, or share banners
    const isExcludedUrl =
      href.includes('whatsapp.com') ||
      href.includes('t.me') ||
      href.includes('how-to-download') ||
      href.includes('/category/') ||
      href.includes('disclaimer') ||
      href === pageUrl;

    if (isExcludedUrl) {
      return;
    }

    const fullUrl = href.startsWith('http')
      ? href
      : new URL(href, pageUrl).toString();
    const cleanLabel = label
      .replace(/[\n\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if the label represents a resolution/download link or a stream link
    const isWatch = /watch|stream|player|online|play/i.test(cleanLabel);
    const isDownload =
      /480p|720p|1080p|2160p|4K|10Bit|HEVC|Download|Size|MB|GB|⚡|Link/i.test(
        cleanLabel,
      ) || /hubcdn|hubdrive|gadgetsweb|hdstream/i.test(fullUrl);

    if (isDownload || isWatch) {
      // Determine resolution
      const resMatch = cleanLabel.match(/(480p|720p|1080p|2160p|4K)/i);
      const resolution = resMatch ? resMatch[0] : undefined;

      // Determine size
      const sizeMatch = cleanLabel.match(/(\d+(?:\.\d+)?\s*(?:MB|GB))/i);
      const size = sizeMatch ? sizeMatch[0] : undefined;

      downloadLinks.push({
        label: cleanLabel || 'Download Link',
        url: fullUrl,
        type: isWatch ? 'watch' : 'download',
        resolution,
        size,
      });
    }
  });

  return {
    title,
    url: pageUrl,
    date,
    imageUrl,
    categories,
    imdbRating: imdbRating || undefined,
    genres,
    stars,
    director: director || undefined,
    language: language || undefined,
    quality: quality || undefined,
    screenshots,
    downloadLinks,
    storyline: storyline || undefined,
  };
}

/**
 * Parses a download redirect portal page (e.g. hubdrive) to extract final direct download mirrors
 */
export function parseDownloadPage(
  html: string,
  pageUrl: string,
): {label: string; url: string}[] {
  const $ = cheerio.load(html);
  const links: {label: string; url: string}[] = [];

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const text = $el.text().trim();

    if (!href || href === '#' || href.startsWith('javascript:')) {
      return;
    }

    // Filter out common layout, rules, and privacy paths
    if (
      href.includes('/page/') ||
      href.includes('privacy-policy') ||
      href.includes('terms-conditions') ||
      href === 'https://hubdrive.tips'
    ) {
      return;
    }

    const fullUrl = href.startsWith('http')
      ? href
      : new URL(href, pageUrl).toString();

    // Exclude promo/tutorial links
    const isPromo =
      href.includes('t.me/') ||
      href.includes('telegram.me') ||
      href.includes('telegram.org') ||
      /tutorial|how to/i.test(text);

    // Look for target download platforms or button texts
    const isTargetLink =
      (href.includes('hubcloud') ||
        href.includes('drive.google.com') ||
        href.includes('mega.nz') ||
        href.includes('pixeldrain.com') ||
        /download|server|gdrive|direct|hubcloud|mega|pixeldrain|drive|gdtot/i.test(
          text,
        )) &&
      !isPromo;

    if (isTargetLink && !links.some(l => l.url === fullUrl)) {
      links.push({
        label: text.replace(/\s+/g, ' ').trim() || 'Download Mirror',
        url: fullUrl,
      });
    }
  });

  // Check forms (e.g., GDrive [Login] redirects)
  $('form[action="/gsign.php"], form[action*="gsign"]').each((_, el) => {
    const $form = $(el);
    const btnText = $form.find('button').text().trim() || 'GDrive [Login]';
    const inputVal = $form.find('input[name="r"]').val();
    if (inputVal && typeof inputVal === 'string') {
      const fullUrl = inputVal.startsWith('http')
        ? inputVal
        : new URL(inputVal, pageUrl).toString();
      if (!links.some(l => l.url === fullUrl)) {
        links.push({
          label: btnText.replace(/\s+/g, ' ').trim(),
          url: fullUrl,
        });
      }
    }
  });

  return links;
}

/**
 * Parses the final file landing page (e.g. hubcloud) to extract direct file download URLs
 */
export function parseDirectDownloadPage(
  html: string,
  pageUrl: string,
): {label: string; url: string}[] {
  const $ = cheerio.load(html);
  const links: {label: string; url: string}[] = [];

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const text = $el.text().trim();

    if (!href || href === '#' || href.startsWith('javascript:')) {
      return;
    }

    // Filter layout/navigation elements
    const isExcluded =
      href.includes('hubcloud.fans') ||
      href.includes('/drive/admin') ||
      href.includes('t.me/') ||
      href.includes('telegram.me') ||
      href.includes('telegram.org') ||
      href.includes('telegram.dog') ||
      href.includes('how-to-download') ||
      /tutorial|how to/i.test(text);

    if (isExcluded) {
      return;
    }

    const fullUrl = href.startsWith('http')
      ? href
      : new URL(href, pageUrl).toString();

    // Direct download matching
    const isDirect =
      /download/i.test(text) ||
      /direct/i.test(text) ||
      /fsl/i.test(text) ||
      /pixel/i.test(text) ||
      /server/i.test(text) ||
      /buzz/i.test(text) ||
      href.includes('/download.php') ||
      fullUrl.includes('drive.google.com/uc') ||
      /mkv|mp4|avi|zip/i.test(href);

    if (isDirect && !links.some(l => l.url === fullUrl)) {
      links.push({
        label: text.replace(/\s+/g, ' ').trim() || 'Direct Download Link',
        url: fullUrl,
      });
    }
  });

  return links;
}

/**
 * Parses final hosting websites (e.g., pixeldrain, bzzhr) to get the direct file download URL
 */
export function parseDirectFileHost(
  html: string,
  pageUrl: string,
): string | null {
  const $ = cheerio.load(html);
  let directLink: string | null = null;

  // Auto-bypass for PixelDrain
  if (
    pageUrl.includes('pixeldrain.com') ||
    pageUrl.includes('pixeldrain.dev')
  ) {
    const match = pageUrl.match(
      /(?:pixeldrain\.com|pixeldrain\.dev)\/u\/([a-zA-Z0-9_-]+)/,
    );
    if (match) {
      return `https://pixeldrain.com/api/file/${match[1]}?download`;
    }
  }

  // Scan all links
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const text = $el.text().trim();

    if (!href || href === '#' || href.startsWith('javascript:')) {
      return;
    }

    const fullUrl = href.startsWith('http')
      ? href
      : new URL(href, pageUrl).toString();

    // Check if it matches direct file types
    const isDirectFile =
      /mkv|mp4|avi|zip|rar/i.test(href) &&
      !href.includes('hubcloud') &&
      !href.includes('gamerxyt');
    const isDownloadText =
      /direct download|download file|download now|click here to download|fsl/i.test(
        text,
      );

    if (isDirectFile || isDownloadText) {
      directLink = fullUrl;
      return false; // Break loop
    }
  });

  // Check forms if no links matched
  if (!directLink) {
    $('form[action]').each((_, el) => {
      const $form = $(el);
      const action = $form.attr('action') || '';
      if (action.includes('download') || action.includes('file')) {
        directLink = action.startsWith('http')
          ? action
          : new URL(action, pageUrl).toString();
        return false;
      }
    });
  }

  return directLink;
}
