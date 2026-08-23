import { CatalogItem } from '../data/models';
import { MovieGroup, MovieRelease } from '../models/movie.types';
import { formatDisplayTitle } from './formatDisplayTitle';

export function extractYear(title: string): string | undefined {
  const match = title.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? match[1] : undefined;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function createCanonicalMovieId(title: string, year?: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/\.(?=\w)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(1080p|720p|480p|2160p|4k|hevc|x264|x265|bluray|web-dl|webrip|hdr|10bit)\b/gi, ' ')
    .replace(/\b(dual audio|multi audio|hindi|english|tamil|telugu|dubbed)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const slug = slugify(normalizedTitle);
  return slug + (year ? `-${year}` : '');
}

export function groupCatalogItems(items: CatalogItem[]): MovieGroup[] {
  const groupsMap = new Map<string, MovieGroup>();

  for (const item of items) {
    const year = item.year || extractYear(item.title);
    const movieId = createCanonicalMovieId(item.title, year);
    let group = groupsMap.get(movieId);

    if (!group) {
      group = {
        movieId,
        title: formatDisplayTitle(item.title).split(' (')[0].trim(),
        year,
        imageUrl: item.imageUrl,
        rating: item.rating,
        releases: [],
        representativeItem: { ...item },
      };
      groupsMap.set(movieId, group);
    } else {
      if (!group.imageUrl && item.imageUrl) {
        group.imageUrl = item.imageUrl;
        group.representativeItem.imageUrl = item.imageUrl;
      }
      if (!group.year && year) {
        group.year = year;
        group.representativeItem.year = year;
      }
      if ((group.rating === undefined || group.rating === 0) && item.rating) {
        group.rating = item.rating;
        group.representativeItem.rating = item.rating;
      }

      const resOrder = ['2160p', '1080p', '720p', '480p'];
      const currentResIdx = resOrder.indexOf(group.representativeItem.resolution?.toLowerCase() || '');
      const newResIdx = resOrder.indexOf(item.resolution?.toLowerCase() || '');
      if (newResIdx !== -1 && (currentResIdx === -1 || newResIdx < currentResIdx)) {
        group.representativeItem.resolution = item.resolution;
      }
      if (item.isDualAudio) {
        group.representativeItem.isDualAudio = true;
      }
    }

    let label = item.resolution || '';
    if (item.isDualAudio) {
      label += label ? ' Dual Audio' : 'Dual Audio';
    }

    if (!group.releases.some(r => r.url === item.url)) {
      group.releases.push({
        url: item.url,
        resolution: item.resolution,
        isDualAudio: item.isDualAudio,
        releaseLabel: label || 'Watch Now',
      });
    }
  }

  return Array.from(groupsMap.values());
}
