import { redirect } from "next/navigation";

export default function ProductsResultsRedirect({
  params,
}: {
  params: { slug: string; executionId: string };
}) {
  redirect(`/p/${params.slug}/results/${params.executionId}`);
}
