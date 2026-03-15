import { Suspense } from "react";
import AuthShell from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AuthShell />
    </Suspense>
  );
}
