import type { ComponentType } from "react";

export type GalleryVariant = {
  name: string;
  props: Record<string, unknown>;
};

export type GalleryEntry = {
  id: string;
  title: string;
  sourcePath: string;
  /** Unspecced pipeline seed note (no design spec in repo). */
  pipelineNote?: string;
  pipelineUrl?: string;
  component: ComponentType<Record<string, unknown>>;
  variants: GalleryVariant[];
};
