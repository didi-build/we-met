import { notFound } from "next/navigation";
import { isValidSlug } from "@/card-data/slug";
import { resolveCardForRequest } from "@/card-data/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function HiCardPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const card = await resolveCardForRequest(`/hi/${slug}`);
  if (!card || card.slug !== slug) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8">
      <p className="text-sm uppercase tracking-wide text-neutral-500">We Met</p>
      <h1 className="text-3xl font-semibold">{card.pageCopy.pageTitle}</h1>
      <p className="text-lg text-neutral-700">{card.displayName}</p>
      <p className="text-sm text-neutral-600">
        Stand-in card page for <span className="font-mono">/hi/{card.slug}</span> (full
        UI in a follow-up ticket).
      </p>
    </main>
  );
}
