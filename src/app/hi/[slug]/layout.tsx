import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { buildHiCardThemeBootstrapScript } from "@/lib/hi-card/hi-theme-bootstrap";
import { hiUiA11y } from "@/lib/hi-card/ui-a11y";
import { resolveHiCardPage } from "@/lib/hi-card/resolve-card-route";
import Script from "next/script";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function HiCardLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const card = await resolveHiCardPage(slug);
  const bootstrapScript = buildHiCardThemeBootstrapScript();
  const skipHref = card.alternate?.url?.trim();

  return (
    <>
      <Script id="hi-card-theme-bootstrap" strategy="beforeInteractive">
        {bootstrapScript}
      </Script>
      <ThemeProvider>
        {skipHref ? (
          <a
            href={skipHref}
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-accent focus:px-4 focus:py-2.5 focus:text-accent-ink"
          >
            {hiUiA11y.skipToBooking}
          </a>
        ) : null}
        {children}
      </ThemeProvider>
    </>
  );
}
