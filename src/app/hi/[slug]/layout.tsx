import { ThemeProvider } from "@/components/theme/ThemeProvider";
import {
  buildHiCardThemeBootstrapScript,
  hiCardPalette,
} from "@/lib/hi-card/hi-theme-bootstrap";
import { hiUiA11y } from "@/lib/hi-card/ui-a11y";
import { resolveHiCardPage } from "@/lib/hi-card/resolve-card-route";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function HiCardLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const card = await resolveHiCardPage(slug);
  const palette = hiCardPalette(card.variant);
  const bootstrapScript = buildHiCardThemeBootstrapScript(palette);
  const skipHref = card.fallbackUrl ?? card.links.bookingUrl;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
      <ThemeProvider>
        {skipHref ? (
          <a
            href={skipHref}
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-accent focus:px-4 focus:py-2.5 focus:text-accent-ink"
          >
            {hiUiA11y.skipToBooking}
          </a>
        ) : null}
        <div data-palette={palette} data-theme="light" className="contents">
          {children}
        </div>
      </ThemeProvider>
    </>
  );
}
