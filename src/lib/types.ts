// ── Section types ──
export type Section = "motion-tracking" | "motion-design" | "voiceover";
export type JobStatus = "queued" | "processing" | "complete" | "failed";
export type GenerationMode = "t2v" | "i2v" | "v2v";
export type VoiceoverTab = "generate" | "match" | "clone";
export type CharacterOrientation = "image" | "video";
export type CloneMethod = "instant" | "professional";

// ── Motion Tracking ──
export interface MotionTrackingModel {
  id: string;
  name: string;
  badge: string;
  description: string;
  details: string;
  costPer5s: number;
  modelId: string;
}

export const MOTION_TRACKING_MODELS: MotionTrackingModel[] = [
  {
    id: "kling-2.6-pro",
    name: "Kling 2.6 Pro",
    badge: "BEST",
    description: "Full-body transfer · Finger-level accuracy · 30s max output",
    details: "",
    costPer5s: 0.67,
    modelId: "fal-ai/kling-video/v2.6/pro/motion-control",
  },
  {
    id: "kling-2.6-std",
    name: "Kling 2.6 Standard",
    badge: "BUDGET",
    description: "Cost-efficient · Simple gestures and basic animations",
    details: "",
    costPer5s: 0.34,
    modelId: "fal-ai/kling-video/v2.6/standard/motion-control",
  },
];

// ── Motion Design ──
export interface MotionDesignModel {
  id: string;
  name: string;
  badge: string;
  bestFor: string;
  audio: boolean;
  maxResolution: string;
  maxDuration: string;
  costPerSec: number;
  modelIds: { t2v: string; i2v: string; v2v?: string };
}

export const MOTION_DESIGN_MODELS: MotionDesignModel[] = [
  {
    id: "kling-3.0-pro-design",
    name: "Kling 3.0 Pro",
    badge: "MOTION",
    bestFor: "Brand ads, character videos, social content",
    audio: true,
    maxResolution: "1080p",
    maxDuration: "15s",
    costPerSec: 0.28,
    modelIds: {
      t2v: "fal-ai/kling-video/v3/pro/text-to-video",
      i2v: "fal-ai/kling-video/v3/pro/image-to-video",
    },
  },
  {
    id: "veo-3.1",
    name: "Veo 3.1",
    badge: "4K",
    bestFor: "Apple-style renders, luxury brands, product showcases",
    audio: true,
    maxResolution: "4K",
    maxDuration: "8s",
    costPerSec: 0.40,
    modelIds: {
      t2v: "fal-ai/veo3",
      i2v: "fal-ai/veo3",
    },
  },
  {
    id: "sora-2-pro",
    name: "Sora 2 Pro",
    badge: "CINEMATIC",
    bestFor: "Long-form ads, film-quality narrative, complex physics",
    audio: true,
    maxResolution: "1080p",
    maxDuration: "25s",
    costPerSec: 0.50,
    modelIds: {
      t2v: "fal-ai/sora/v2/pro/text-to-video",
      i2v: "fal-ai/sora/v2/pro/image-to-video",
    },
  },
  {
    id: "wan-2.6",
    name: "Wan 2.6",
    badge: "OPEN",
    bestFor: "Unrestricted creative, motion graphics, fast iteration",
    audio: true,
    maxResolution: "1080p",
    maxDuration: "15s",
    costPerSec: 0.08,
    modelIds: {
      t2v: "wan/v2.6/text-to-video",
      i2v: "wan/v2.6/image-to-video",
    },
  },
  {
    id: "hunyuan",
    name: "HunyuanVideo",
    badge: "FREE*",
    bestFor: "Self-hosted runs, high volume, no content restrictions",
    audio: false,
    maxResolution: "1080p",
    maxDuration: "10s",
    costPerSec: 0,
    modelIds: {
      t2v: "fal-ai/hunyuan-video",
      i2v: "fal-ai/hunyuan-video",
    },
  },
];

// ── Character Swap ──
export interface CharacterSwapModel {
  id: string;
  name: string;
  badge: string;
  description: string;
  costPer5s: number;
  modelId: string;
}

export const CHARACTER_SWAP_MODELS: CharacterSwapModel[] = [
  {
    id: "pixverse-swap",
    name: "Pixverse Swap",
    badge: "FULL BODY",
    description: "Full-body replacement · Keeps your background & scene · Up to 1080p",
    costPer5s: 0.30,
    modelId: "fal-ai/pixverse/swap",
  },
];

export function estimateCharacterSwapCost(durationSec: number, costPer5s: number): number {
  return (durationSec * costPer5s) / 5;
}

// ── Voiceover ──
export interface Voice {
  id: string;
  name: string;
  gender: string;
  accent: string;
  tone: string;
  useCase?: string;
}

export const DEFAULT_VOICES: Voice[] = [
  { id: "adam", name: "Adam", gender: "Male", accent: "American", tone: "Deep · Authoritative" },
  { id: "rachel", name: "Rachel", gender: "Female", accent: "American", tone: "Warm · Conversational" },
  { id: "bella", name: "Bella", gender: "Female", accent: "British", tone: "Clear · Professional" },
  { id: "josh", name: "Josh", gender: "Male", accent: "American", tone: "Energetic · Young" },
  { id: "sam", name: "Sam", gender: "Neutral", accent: "American", tone: "Calm · Documentary" },
  { id: "charlotte", name: "Charlotte", gender: "Female", accent: "British", tone: "Warm · Luxury" },
  { id: "marcus", name: "Marcus", gender: "Male", accent: "American", tone: "Smooth · Ad-ready" },
  { id: "nova", name: "Nova", gender: "Female", accent: "American", tone: "Bright · Social" },
];

// ── Job types ──
export interface Job {
  id: string;
  createdAt: string;
  section: Section;
  modelId: string;
  modelName: string;
  status: JobStatus;
  falRequestId?: string;
  inputParams: Record<string, unknown>;
  outputUrl?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  estimatedCost?: number;
  saved: boolean;
  errorMsg?: string;
}

export interface VoiceJobType {
  id: string;
  createdAt: string;
  type: VoiceoverTab;
  script?: string;
  voiceId?: string;
  voiceName?: string;
  clonedFrom?: string;
  outputAudioUrl?: string;
  mergedVideoUrl?: string;
  linkedJobId?: string;
  status: JobStatus;
  estimatedCost?: number;
  errorMsg?: string;
}

export interface CustomVoiceType {
  id: string;
  createdAt: string;
  name: string;
  elevenlabsId: string;
  sourceAudioUrl: string;
  method: CloneMethod;
}

// ── Cost helpers ──
export function estimateMotionTrackingCost(durationSec: number, costPer5s: number): number {
  return (durationSec * costPer5s) / 5;
}

export function estimateMotionDesignCost(durationSec: number, costPerSec: number): number {
  return durationSec * costPerSec;
}

export function estimateVoiceoverCost(charCount: number, model: "multilingual" | "turbo" | "flash"): number {
  const rates = { multilingual: 0.30, turbo: 0.15, flash: 0.08 };
  return (charCount / 1000) * rates[model];
}
