import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-gray-900">Authentication Error</h1>
        <p className="mt-2 text-sm text-gray-600">
          We couldn't complete sign-in. The link may have expired or the redirect URL is not allowed in
          Supabase.
        </p>

        <div className="mt-6 space-y-2 text-sm text-gray-700">
          <p className="font-medium">Checklist</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Supabase Site URL must be <code className="px-1 py-0.5 bg-gray-100 rounded">https://app.getflowetic.com</code>
            </li>
            <li>
              Additional Redirect URL must include{" "}
              <code className="px-1 py-0.5 bg-gray-100 rounded">https://app.getflowetic.com/auth/callback</code>
            </li>
          </ol>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Try Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}