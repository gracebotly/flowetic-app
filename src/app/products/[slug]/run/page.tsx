import { redirect } from "next/navigation";

export default function ProductsRunRedirect({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/p/${params.slug}/run`);
}
