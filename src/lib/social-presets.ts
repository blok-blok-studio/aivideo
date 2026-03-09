export interface SocialPreset {
  id: string;
  name: string;
  platform: string;
  aspectRatio: string;
  maxDuration: number;
  resolution: string;
  icon: string; // emoji or icon name
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  {
    id: "ig-reels",
    name: "Instagram Reels",
    platform: "Instagram",
    aspectRatio: "9:16",
    maxDuration: 25,
    resolution: "1080p",
    icon: "IG",
  },
  {
    id: "ig-story",
    name: "Instagram Story",
    platform: "Instagram",
    aspectRatio: "9:16",
    maxDuration: 15,
    resolution: "1080p",
    icon: "IG",
  },
  {
    id: "ig-feed",
    name: "Instagram Feed",
    platform: "Instagram",
    aspectRatio: "1:1",
    maxDuration: 25,
    resolution: "1080p",
    icon: "IG",
  },
  {
    id: "tiktok",
    name: "TikTok",
    platform: "TikTok",
    aspectRatio: "9:16",
    maxDuration: 25,
    resolution: "1080p",
    icon: "TT",
  },
  {
    id: "youtube",
    name: "YouTube",
    platform: "YouTube",
    aspectRatio: "16:9",
    maxDuration: 25,
    resolution: "1080p",
    icon: "YT",
  },
  {
    id: "youtube-shorts",
    name: "YT Shorts",
    platform: "YouTube",
    aspectRatio: "9:16",
    maxDuration: 25,
    resolution: "1080p",
    icon: "YT",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    platform: "LinkedIn",
    aspectRatio: "1:1",
    maxDuration: 10,
    resolution: "1080p",
    icon: "LI",
  },
  {
    id: "x-video",
    name: "X / Twitter",
    platform: "X",
    aspectRatio: "16:9",
    maxDuration: 15,
    resolution: "720p",
    icon: "X",
  },
];
