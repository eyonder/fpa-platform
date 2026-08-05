import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ---------------------------------------------------------------------
  // MİMARİ SINIR KURALLARI
  // Klasörleri ayırmak yeterli değildir; kimsenin duvarı delmediğinden emin
  // olmak gerekir. Aşağıdaki kurallar bu ayrımı derleme zamanında zorunlu kılar.
  // ---------------------------------------------------------------------
  {
    name: "sinir/frontend",
    files: ["src/frontend/**/*.{ts,tsx}", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/backend/*", "@/backend", "**/backend/**"],
              message:
                "Arayüz kodu sunucu katmanını doğrudan çağıramaz. Veriye @/frontend/lib/api-client üzerinden erişin.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "sinir/backend",
    files: ["src/backend/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "Sunucu katmanı React'e bağımlı olmamalı." },
            { name: "react-dom", message: "Sunucu katmanı React'e bağımlı olmamalı." },
            {
              name: "next/navigation",
              message: "Sunucu katmanı Next.js yönlendirmesine bağımlı olmamalı.",
            },
          ],
          patterns: [
            {
              group: ["@/frontend/*", "**/frontend/**"],
              message:
                "Sunucu katmanı arayüz kodunu çağıramaz. Ortak tipleri @/shared altına taşıyın.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "sinir/shared",
    files: ["src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/frontend/*", "@/backend/*", "next/*", "react"],
              message:
                "Ortak katman saf tip ve sabit içerir; hiçbir tarafa bağımlı olamaz.",
            },
          ],
        },
      ],
    },
  },

  // Prettier ile çakışan biçim kurallarını kapatır. HER ZAMAN en sonda kalmalı.
  prettier,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**"]),
]);

export default eslintConfig;
