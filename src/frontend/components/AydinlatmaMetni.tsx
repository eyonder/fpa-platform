/**
 * KVKK (6698 sayılı Kişisel Verilerin Korunması Kanunu) Aydınlatma Metni —
 * giriş, şifremi unuttum ve şifre sıfırlama ekranlarında gösterilir.
 *
 * ÖNEMLİ: Bu metin bir ŞABLONDUR (demo amaçlı). Gerçek bir üretim ortamında
 * kullanılmadan önce şirketinizin hukuk/uyum (compliance) ekibi tarafından
 * incelenmeli ve şirketinize özgü veri işleme faaliyetlerini doğru
 * yansıtacak şekilde güncellenmelidir.
 */
export function AydinlatmaMetni() {
  return (
    <details className="mt-4 rounded-md border border-rule px-3 py-2 text-xs text-muted">
      <summary className="cursor-pointer font-medium text-ink">
        Kişisel Verilerin Korunması Kanunu (KVKK) Aydınlatma Metni
      </summary>
      <div className="mt-2 space-y-2">
        <p>
          FP&amp;A Platformu (&quot;Şirket&quot;) olarak, 6698 sayılı Kişisel Verilerin
          Korunması Kanunu (&quot;KVKK&quot;) uyarınca veri sorumlusu sıfatıyla, giriş
          işlemi sırasında işlediğimiz kişisel verilerinize ilişkin sizi bilgilendirmek
          isteriz.
        </p>
        <p>
          <span className="font-medium text-ink">İşlenen veriler:</span> ad-soyad,
          e-posta adresi, giriş zaman damgası ve oturum bilgileri.
        </p>
        <p>
          <span className="font-medium text-ink">İşleme amacı:</span> kimlik doğrulama,
          yetkilendirme (rol bazlı erişim kontrolü) ve hesap güvenliğinin sağlanması
          (KVKK m. 5/2-c, sözleşmenin kurulması/ifasıyla doğrudan doğruya ilgili
          olması).
        </p>
        <p>
          <span className="font-medium text-ink">Saklama süresi:</span> oturum kaydı,
          oturum sona erene ya da siz çıkış yapana kadar; denetim (audit) kayıtları
          ilgili mevzuatın öngördüğü süre boyunca saklanır.
        </p>
        <p>
          <span className="font-medium text-ink">Haklarınız:</span> KVKK m. 11
          kapsamında verilerinize erişme, düzeltilmesini/silinmesini isteme ve
          işlenmesine itiraz etme haklarına sahipsiniz.
        </p>
        <p className="italic">
          Bu metin bir şablondur (demo amaçlı); üretime almadan önce hukuk
          departmanınızca gözden geçirilmelidir.
        </p>
      </div>
    </details>
  );
}
