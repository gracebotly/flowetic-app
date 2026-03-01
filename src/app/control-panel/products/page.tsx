import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/onboarding");

  const tenantId = membership.tenant_id;

  const { data: products } = await supabase
    .from("workflow_products")
    .select("id, name, slug, status, pricing_model, price_cents, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const items = products ?? [];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Turn your workflows into sellable products.
          </p>
        </div>
        <Link
          href="/control-panel/products/create"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + New Product
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-12 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No products yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create your first product from a connected Make or n8n workflow.
          </p>
          <Link
            href="/control-panel/products/create"
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + Create Product
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Pricing</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === "active"
                          ? "bg-green-50 text-green-700"
                          : p.status === "draft"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.pricing_model === "free"
                      ? "Free"
                      : `$${(p.price_cents / 100).toFixed(2)}${
                          p.pricing_model === "monthly"
                            ? "/mo"
                            : p.pricing_model === "per_run"
                              ? "/run"
                              : ""
                        }`}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/products/${p.slug}`}
                      target="_blank"
                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
