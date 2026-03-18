import { redirect } from "next/navigation";

export default function ProductsSubscribeRedirect({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/p/${params.slug}/subscribe`);
}
