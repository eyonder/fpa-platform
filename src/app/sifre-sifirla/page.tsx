import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordScreen } from "@/frontend/screens/auth/ResetPasswordScreen";

export const metadata: Metadata = { title: "Şifre Sıfırla · FP&A Platform" };

// ResetPasswordScreen `useSearchParams` (?token=) kullanıyor -> Suspense sınırı gerekli.
export default function Page() {
  return (
    <Suspense>
      <ResetPasswordScreen />
    </Suspense>
  );
}
