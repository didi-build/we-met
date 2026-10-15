import { buildAppThemeBootstrapScript } from "@/lib/app-editor/app-theme-bootstrap";
import Script from "next/script";

export default function AppPreviewLayout({ children }: { children: React.ReactNode }) {
  const bootstrapScript = buildAppThemeBootstrapScript();
  return (
    <>
      <Script id="wemet-app-theme-bootstrap" strategy="beforeInteractive">
        {bootstrapScript}
      </Script>
      {children}
    </>
  );
}
