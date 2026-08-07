import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginScreen } from "@/frontend/screens/auth/LoginScreen";

export const metadata: Metadata = { title: "Giriş Yap · FP&A Platform" };

// LoginScreen `useSearchParams` (?next=) kullanıyor -> Next.js bunu bir
// Suspense sınırı içinde ister, yoksa build hata verir.
export default function Page() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
