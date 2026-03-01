export default function PortalNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Portal Not Found</h1>
        <p className="mt-3 text-gray-500">
          This portal link may have expired or is no longer active.
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Contact your service provider for a new link.
        </p>
      </div>
    </div>
  );
}
