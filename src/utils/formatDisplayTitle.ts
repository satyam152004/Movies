/**
 * Extracts a clean display title from raw scraper/catalog names.
 * Example: "The Odyssey (2026) V2 HQ-HDTC [Hindi (LiNE) & English] 1080p..."
 *       -> "The Odyssey (2026)"
 */
export function formatDisplayTitle(rawTitle: string): string {
  if (!rawTitle?.trim()) {
    return rawTitle;
  }

  let title = rawTitle.trim();

  title = title.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();

  const withYear = title.match(/^(.+?\(\d{4}\))/);
  if (withYear) {
    return withYear[1].trim();
  }

  const withSeason = title.match(/^(.+?\((?:Season|S)\s*\d+[^)]*\))/i);
  if (withSeason) {
    return withSeason[1].trim();
  }

  const techPattern =
    /\s+(?=\d{3,4}p\b|2160p|4k\b|8k\b|hevc|webrip|web[- ]?dl|bluray|bdrip|hdrip|hdtc|hdts|camrip|telesync|dvdscr|x264|x265|10bit|dual\s+audio|\bhindi\b|\benglish\b|\btamil\b|\btelugu\b|\bbengali\b|\bhq[-\w]*|\bv\d+\b)/i;
  title = title.split(techPattern)[0].trim();

  title = title
    .replace(
      /\s+(V\d+|HQ[-\w]*|WEB[-\w]*|HDTC|HDTS|CAM|TS|DVDScr|PROPER|REPACK|EXTENDED|UNRATED)\b.*$/i,
      '',
    )
    .trim();

  title = title.replace(/[\s\-–—|&:.,]+$/g, '').trim();

  return title || rawTitle.trim();
}
