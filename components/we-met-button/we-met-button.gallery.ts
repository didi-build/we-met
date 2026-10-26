import specMarkdown from "../../specs/we-met-button.md?raw";
import type { GalleryEntry } from "../../gallery/lib/types.js";
import { WeMetButton } from "./WeMetButton.js";

export const weMetButtonGallery: GalleryEntry = {
  id: "we-met-button",
  title: "WeMetButton",
  specPath: "specs/we-met-button.md",
  specMarkdown,
  component: WeMetButton as unknown as GalleryEntry["component"],
  variants: [
    {
      name: "Primary",
      props: { children: "Continue", variant: "primary" },
    },
    {
      name: "Outline",
      props: { children: "Learn more", variant: "outline" },
    },
    {
      name: "Disabled",
      props: { children: "Unavailable", variant: "primary", disabled: true },
    },
  ],
};
