import { AppPreviewClient } from "@/app/app-preview/AppPreviewClient";
import { readWeMetHostConfig } from "@/config/we-met";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "We Met — App preview",
  robots: { index: false, follow: false },
};

export default async function AppPreviewPage() {
  const { env } = await getCloudflareContext({ async: true });
  const { weMetEnv } = readWeMetHostConfig(env);
  if (weMetEnv === "production") {
    notFound();
  }
  return <AppPreviewClient />;
}
