import type { AppApi } from "@/app-api/app-api";
import { readStubFailureFlags } from "@/app-api/stub-failures";
import {
  AppApiError,
  type AppCardBundle,
  type AppSession,
  type EditorCard,
} from "@/app-api/types";
import { CARD_FIELD_LIMITS } from "@/card-data/limits";

const RESERVED = [
  "app",
  "www",
  "api",
  "admin",
  "hi",
  "help",
  "support",
  "login",
  "signin",
  "signup",
  "settings",
  "account",
  "we-met",
  "wemet",
  "mail",
  "static",
];

const TAKEN = ["sam", "alex", "jordan", "taylor", "test", "demo"];

const SAMPLE_SESSION: AppSession = {
  email: "didi.shoukralla@gmail.com",
  name: "Didi Shoukralla",
  allowed: true,
};

const SAMPLE_CARD: EditorCard = {
  slug: "didi",
  name: "Didi Shoukralla",
  role: "Software Engineer and Technical Advisor",
  photo: "",
  about: [
    "I'm a software engineer in Toronto. I help founders who built their app with AI get it ready for real users, paying customers, or investors.",
    "I've shipped software at startups and on production teams, so I know what breaks once people actually show up.",
    "If you're building something, I'm happy to give you an honest, straight read during your free consultation.",
  ],
  services: [
    {
      title: "System audit",
      description:
        "I review your app and give you a written summary: what's solid, what's risky, and what to do next.",
    },
    {
      title: "Custom development",
      description:
        "I build what your product needs, whether that's a new feature or a custom tool made just for you.",
    },
    {
      title: "Technical advisory",
      description:
        "I answer your technical questions in plain English and help you decide what to build, what to skip, and what to ask your developers.",
    },
    {
      title: "Fractional CTO",
      description:
        "I act as your part-time technical lead: I guide the technical decisions and the team, without a full-time hire.",
    },
    {
      title: "AI Integrations",
      description:
        "I add AI to your product where it helps, like a chat assistant, smarter search, or an agent that handles tasks for you.",
    },
  ],
  links: {
    website: "https://didi.build",
    linkedin: "https://www.linkedin.com/in/diadem-shoukralla/",
    github: "https://github.com/DiademShoukralla/",
    instagram: "https://instagram.com/didi.build",
  },
  alternate: { url: "https://didi.build/book", label: "or book a time directly" },
};

export function emptyEditorCard(): EditorCard {
  return {
    slug: "",
    name: "",
    role: "",
    photo: "",
    about: [],
    services: [],
    links: { website: "", linkedin: "", github: "", instagram: "" },
    alternate: { url: "", label: "" },
  };
}

function cloneCard(card: EditorCard): EditorCard {
  return JSON.parse(JSON.stringify(card)) as EditorCard;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugFormatMessage(slug: string): string | null {
  if (!slug) {
    return "Choose your link to publish.";
  }
  if (/[^a-z0-9-]/.test(slug)) {
    return "Use only lowercase letters, numbers and hyphens.";
  }
  if (slug.length < CARD_FIELD_LIMITS.slugMin) {
    return `Use at least ${CARD_FIELD_LIMITS.slugMin} characters.`;
  }
  if (slug.length > CARD_FIELD_LIMITS.slugMax) {
    return `Keep it to ${CARD_FIELD_LIMITS.slugMax} characters or fewer.`;
  }
  if (/^-|-$/.test(slug)) {
    return "It can't start or end with a hyphen.";
  }
  if (/--/.test(slug)) {
    return "Use one hyphen at a time.";
  }
  return null;
}

export function createStubApi(search = ""): AppApi {
  const flags = readStubFailureFlags(search);
  let session: AppSession | null = null;
  let draft: EditorCard = cloneCard(SAMPLE_CARD);
  let published: EditorCard | null = cloneCard(SAMPLE_CARD);
  let updatedAt = new Date().toISOString();
  let saveFailedOnce = false;

  const api: AppApi = {
    async getSession() {
      await wait(150);
      return session;
    },

    async signIn(mode?: "redirect" | "popup") {
      void mode;
      await wait(1200);
      if (flags.has("login-error")) {
        throw new AppApiError("canceled");
      }
      session = {
        ...SAMPLE_SESSION,
        allowed: !flags.has("closed"),
      };
      return session;
    },

    async signOut() {
      await wait(200);
      session = null;
    },

    async getCard(): Promise<AppCardBundle> {
      await wait(250);
      if (!session) {
        throw new AppApiError("unauthorized");
      }
      return {
        draft: cloneCard(draft),
        published: published ? cloneCard(published) : null,
        updatedAt,
      };
    },

    async saveDraft(card) {
      await wait(600);
      if (flags.has("session-expired")) {
        throw new AppApiError("unauthorized");
      }
      if (flags.has("save-error") && !saveFailedOnce) {
        saveFailedOnce = true;
        throw new AppApiError("network");
      }
      draft = cloneCard(card);
      updatedAt = new Date().toISOString();
      return { updatedAt };
    },

    async checkSlug(slug) {
      await wait(500);
      const fmt = slugFormatMessage(slug);
      if (fmt) {
        return { status: "invalid", message: fmt };
      }
      if (published && slug === published.slug) {
        return { status: "available" };
      }
      if (flags.has("slug-taken") || TAKEN.includes(slug)) {
        return { status: "taken" };
      }
      if (RESERVED.includes(slug)) {
        return { status: "reserved" };
      }
      return { status: "available" };
    },

    async uploadPhoto(blob) {
      await wait(1400);
      if (flags.has("upload-error")) {
        throw new AppApiError("network");
      }
      return { url: URL.createObjectURL(blob) };
    },

    async deletePhoto() {
      await wait(300);
      if (flags.has("session-expired")) {
        throw new AppApiError("unauthorized");
      }
      if (draft) {
        draft = { ...draft, photo: "" };
      }
    },

    async publish(card) {
      await wait(900);
      if (!session) {
        throw new AppApiError("unauthorized");
      }
      if (!card.name.trim()) {
        throw new AppApiError("name-missing");
      }
      const fmt = slugFormatMessage(card.slug);
      if (fmt) {
        throw new AppApiError("slug-invalid", fmt);
      }
      if (RESERVED.includes(card.slug)) {
        throw new AppApiError("slug-reserved");
      }
      if (flags.has("slug-taken") || TAKEN.includes(card.slug)) {
        if (!published || card.slug !== published.slug) {
          throw new AppApiError("slug-taken");
        }
      }
      draft = cloneCard(card);
      published = cloneCard(card);
      updatedAt = new Date().toISOString();
      return { url: `https://we-met.link/hi/${card.slug}` };
    },
  };

  return api;
}
