import { redirect } from "next/navigation";

export default function ProductsRedirect({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/p/${params.slug}`);
}
