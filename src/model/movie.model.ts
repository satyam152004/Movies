import {z} from 'zod';

// Zod schema for a download link parsed from the detail page
export const DownloadLinkSchema = z.object({
  label: z.string(), // E.g., "720p x264 [1.2GB]"
  url: z.string().url(), // Direct file link or external host URL
  type: z.enum(['download', 'watch', 'unknown']),
  resolution: z.string().optional(), // E.g., "480p", "720p", "1080p", "4K"
  size: z.string().optional(), // E.g., "460MB", "2GB"
});

// Zod schema for a single movie item parsed from catalog lists
export const CatalogItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  year: z.string().optional(),
  resolution: z.string().optional(),
  isDualAudio: z.boolean().optional(),
  isHEVC: z.boolean().optional(),
});

// Zod schema for the complete parsed movie detail info
export const MovieDetailSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  date: z.string().optional(),
  imageUrl: z.string().url().optional(),
  categories: z.array(z.string()),
  genres: z.array(z.string()),
  stars: z.array(z.string()),
  director: z.string().optional(),
  language: z.string().optional(),
  quality: z.string().optional(),
  screenshots: z.array(z.string().url()),
  downloadLinks: z.array(DownloadLinkSchema),
  storyline: z.string().optional(),
  rawHtmlMetadata: z.record(z.string(), z.string()).optional(),
  tmdbId: z.string().optional(),
  backdropUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  runtime: z.number().optional(),
  certification: z.string().optional(),
  country: z.string().optional(),
  budget: z.number().optional(),
  revenue: z.number().optional(),
  studios: z.array(z.string()).optional(),
  homepage: z.string().optional(),
  enrichedCast: z
    .array(
      z.object({
        name: z.string(),
        character: z.string(),
        profileUrl: z.string(),
      }),
    )
    .optional(),
  enrichedCrew: z
    .array(
      z.object({
        name: z.string(),
        job: z.string(),
      }),
    )
    .optional(),
});

export type DownloadLink = z.infer<typeof DownloadLinkSchema>;
export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type MovieDetail = z.infer<typeof MovieDetailSchema>;
