import { Button } from "@/components/ui/Button";
import type { GalleryEntry } from "../../gallery/lib/types.js";

export const uiButtonGallery: GalleryEntry = {
  id: "ui-button",
  title: "Button",
  sourcePath: "src/components/ui/Button.tsx",
  pipelineNote:
    "Unspecced pipeline seed (gallery wiring only; not a design-approved spec).",
  pipelineUrl: "https://linear.app/didi-build/issue/DIDI-849",
  component: Button as unknown as GalleryEntry["component"],
  variants: [
    {
      name: "primary",
      props: { children: "Label", variant: "primary" },
    },
    {
      name: "outline",
      props: { children: "Label", variant: "outline" },
    },
  ],
};
