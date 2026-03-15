import { Suspense } from "react";
import AuthShell from "@/app/login/login-client";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AuthShell />
    </Suspense>
  );
}
