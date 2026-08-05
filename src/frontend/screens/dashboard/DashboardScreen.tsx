import Link from "next/link";

import { Card } from "@/frontend/components/ui/Card";

const LAYERS = [
  {
    path: "src/frontend",
    role: "Kullanıcı arayüzü",
    detail:
      "Ekranlar, bileşenler, hook'lar ve API istemcisi. Veritabanını da, iş kurallarını da bilmez.",
  },
  {
    path: "src/app",
    role: "Yönlendirme kabuğu",
    detail:
      "URL'leri ekranlara ve API uçlarına bağlar. Buradaki dosyalar bilerek birkaç satırdır.",
  },
  {
    path: "src/backend",
    role: "Sunucu katmanı",
    detail:
      "Doğrulama, iş mantığı ve veri erişimi. React'i bilmez; olduğu gibi NestJS'e taşınabilir.",
  },
  {
    path: "src/shared",
    role: "Ortak sözleşme",
    detail: "İki tarafın da kullandığı saf tipler. Tek doğruluk kaynağı burasıdır.",
  },
];

export function DashboardScreen() {
  return (
    <div className="space-y-8">
      <div>
        <p className="tabular text-xs tracking-widest text-ledger uppercase">
          Kurulum tamamlandı
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Katmanlar ayrıldı, sınırlar korumalı.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Arayüz kodu ile sunucu kodu ayrı klasörlerde duruyor ve bu ayrımı ESLint
          zorunlu kılıyor. Bir bileşen yanlışlıkla veritabanı katmanını çağırmaya
          kalkarsa build aşamasında hata alırsınız.
        </p>
      </div>

      <Card title="Klasör haritası" hint="src/">
        <ul className="divide-y divide-rule">
          {LAYERS.map((layer) => (
            <li key={layer.path} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr]">
              <div>
                <p className="tabular text-sm text-ledger">{layer.path}</p>
                <p className="text-xs text-muted">{layer.role}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted">{layer.detail}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Çalıştığını görün" hint="canlı uç noktalar">
        <ul className="space-y-2 text-sm">
          <li>
            <Link
              href="/senaryolar"
              className="text-ledger underline underline-offset-4 hover:text-ink"
            >
              Senaryolar ekranı
            </Link>
            <span className="text-muted"> — arayüzün API’yi çağırdığı örnek.</span>
          </li>
          <li>
            <a
              href="/api/scenarios"
              className="tabular text-ledger underline underline-offset-4 hover:text-ink"
            >
              GET /api/scenarios
            </a>
            <span className="text-muted"> — ham JSON çıktısı.</span>
          </li>
          <li>
            <a
              href="/api/health"
              className="tabular text-ledger underline underline-offset-4 hover:text-ink"
            >
              GET /api/health
            </a>
            <span className="text-muted"> — sağlık kontrolü.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
