import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import PortalPreviewClient from "./portal-preview-client";

export default function PortalPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <PortalPreviewClient />
    </Suspense>
  );
}
