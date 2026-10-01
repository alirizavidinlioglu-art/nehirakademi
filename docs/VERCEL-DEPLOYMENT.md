# Vercel production dağıtımı

Kod Vercel'in Next.js / Node.js çalışma modeli için hazırlanmıştır. Bu belge bir canlı deployment yapıldığı anlamına gelmez. Vercel ve PostgreSQL hesapları ile gerçek secret'lar bu oturumda bağlı değil; Vercel URL'si deploy sonrasında oluşacak.

## En hızlı yol

1. Bu projenin dosyalarını `alirizavidinlioglu-art/nehirakademi` GitHub deposunun köküne gönderin. Kök dizinde `package.json`, `app/`, `public/`, `vercel.json` olmalı. Arşivdeki üst `nehirakademi/` klasörünü repo içine ayrıca koymayın.
2. Vercel → **Add New → Project → Import Git Repository** ile depoyu seçin. Framework **Next.js**, Root Directory **`.`**, Node.js **24.x**, Install **`npm ci`**, Build **`npm run build`**. Output Directory ve Start Command için Next.js varsayılanlarını koruyun; static export kullanmayın.
3. Kalıcı PostgreSQL oluşturun. En kısa yol Vercel Marketplace üzerinden Neon bağlantısı kurmak veya mevcut PostgreSQL'i bağlamaktır. Sağlayıcının **pooled** bağlantı adresini aşağıdaki `DATABASE_URL` değişkenine koyun; entegrasyon farklı bir ad üretirse değeri `DATABASE_URL` adıyla da tanımlayın. Sağlayıcının TLS ayarlarını koruyun, sertifika doğrulamasını kapatmayın.
4. Aşağıdaki değişkenleri Vercel **Settings → Environment Variables → Production** alanına girin. Preview için ayrı bir test veritabanı ve ayrı secret'lar kullanın. `NEXT_PUBLIC_` ön eki eklemeyin.
5. Veritabanı şemasını **bir kez** hazırlayın ve ilk gerçek admin hesabını oluşturun. Sonra Vercel'de **Deploy** seçin.
6. İlk URL bilinmiyorsa `APP_URL` tanımlamadan deploy edebilirsiniz: kod Vercel'in `VERCEL_URL` değişkeninden HTTPS adresini alır. Vercel'in verdiği kalıcı production adresini `APP_URL=https://proje.vercel.app` olarak girip **Redeploy** yapın. Kendi domain'inizi bağlarsanız `APP_URL` değerini değiştirip yeniden deploy edin.
7. Aşağıdaki canlı kontrolleri yapın. Dışarıdan erişim için production deployment'ın koruma ayarının ziyaretçilere izin verdiğini kontrol edin. Preview deployment korumasını kapatmanız gerekmez.

## Vercel değişkenleri

| Değişken | Gerekli mi? | Değer / amaç |
| --- | --- | --- |
| `DATABASE_URL` | **Zorunlu secret** | Sağlayıcının pooled PostgreSQL bağlantı adresi. Şema önceden migration ile hazırlanmalı. |
| `AI_API_KEY` | **AI için zorunlu secret** | Sağlayıcı anahtarı. Adı değişmedi. Eksikse AI açıkça 503 döndürür; diğer ekranlar çalışabilir. |
| `APP_URL` | Production için önerilir | Tam HTTPS origin; ör. `https://proje.vercel.app`, path olmadan. Eksikse mevcut deployment adresi kullanılır. |
| `REQUIRE_EXTERNAL_DATABASE` | Önerilir | `true`. Vercel'de bu değişkenden bağımsız olarak harici DB zorunludur. |
| `AI_MODEL` | Önerilir | `gpt-4.1-mini` veya JSON schema ve görsel destekleyen erişiminiz olan model. |
| `AI_BASE_URL` | Önerilir | OpenAI için `https://api.openai.com/v1`. |
| `EMAIL_API_KEY` | Parola sıfırlama için zorunlu secret | Resend anahtarı. |
| `EMAIL_FROM` | Parola sıfırlama için zorunlu | Resend'de doğrulanmış domain göndericisi; ör. `Nehir Akademi <hesap@alanadiniz.com>`. |
| `AI_INPUT_PRICE_PER_MILLION` | İsteğe bağlı | USD / milyon giriş token'ı; sağlayıcının güncel fiyatı. |
| `AI_OUTPUT_PRICE_PER_MILLION` | İsteğe bağlı | USD / milyon çıkış token'ı; ikisi de tanımlı değilse maliyet tahmini gösterilmez. |

`LOCAL_DATABASE_PATH`, `DEV_MAIL_OUTBOX`, `DEV_MAIL_OUTBOX_PATH`, `BOOTSTRAP_PASSWORD`, proxy değişkenleri ve geliştirme hesabı dosyası Vercel'e taşınmaz. `NODE_ENV`, `VERCEL` ve `VERCEL_URL` platform tarafından sağlanır; elle eklemeyin. Uygulama JWT veya OAuth kullanmadığı için `NEXTAUTH_SECRET`, Supabase anon key veya bir callback secret'ı gerekmez.

## İlk veritabanı ve admin

Güvenilir yerel makinede Node 24 ve proje dosyalarıyla:

```bash
npm ci
cp .env.example .env.local
```

Var olan `.env.local` dosyasını ezmeyin. `.env.local` içinde gerçek `DATABASE_URL` değerini güvenli biçimde girin, `REQUIRE_EXTERNAL_DATABASE=true` yapın. Bu dosya Git dışında kalır. Terminale secret yazdırmayın.

```bash
npm run db:migrate
```

Bu komut şemayı ve tekrar çalıştırılabilir başlangıç verisini hazırlar; kullanıcı veya sabit parola üretmez. Başlangıçta 12 ders ve 134 özgün bağımsız çalışma sorusu bulunur. Bunlar resmî MEB müfredatı değildir. Migration build sırasında veya her serverless cold start'ta çalışmaz. Yeni şema değişikliklerinde migration'ı deploy öncesi ayrıca çalıştırın; aynı veritabanına eşzamanlı migration çalıştırmayın.

Bash'te ilk admin parolasını ekrana veya komut geçmişine yazmadan geçici olarak sağlayın:

```bash
read -r -s -p 'Admin parolası (en az 12 karakter): ' BOOTSTRAP_PASSWORD
export BOOTSTRAP_PASSWORD
npm run user:create -- --email=admin@alanadiniz.com --name='Yönetici' --role=ADMIN
unset BOOTSTRAP_PASSWORD
```

`admin@alanadiniz.com` örneğini kendi e-postanızla değiştirin. `BOOTSTRAP_PASSWORD` değerini Vercel'e eklemeyin. Admin girişinden sonra `/admin` ekranında öğrenci/ebeveyn hesaplarını ve ebeveyn bağlantılarını oluşturun. Yerel geliştirme hesapları production'a otomatik taşınmaz.

## Supabase seçeneği

Projede Supabase SDK veya Supabase Auth kullanılmıyor. Supabase'i PostgreSQL sağlayıcısı olarak seçerseniz Connect ekranındaki **transaction pooler** adresini `DATABASE_URL` olarak sağlayın. Sürücüde `prepare:false` hazırdır. Şema migration'ı ve özel auth aynı şekilde çalışır. Supabase'in otomatik Data API erişimini devre dışı bırakın veya bu tabloları API'ye açılmayan bir yapılandırmada tutun; uygulamanın kullanıcı/oturum/öğrenci tablolarını anon/authenticated Data API rollerine açmayın. Bu bağlantı yolu gerçek bir Supabase projesinde henüz doğrulanmadı.

## Oturum, API ve PWA

- Giriş kendi `/api/auth/login` endpoint'inde gerçekleşir; yönlendirmeler aynı origin'de `/`, `/admin`, `/ebeveyn` olarak göreli yapılır. OAuth callback kaydı gerekmiyor. Parola yenileme bağlantıları `APP_URL` üzerinden `/reset?token=...` adresine gider. Domain değişince `APP_URL` ve e-posta gönderici domain'ini güncelleyin.
- Oturum/reset token'ları hash olarak PostgreSQL'de tutulur. Vercel'de çerez `HttpOnly`, `Secure`, `SameSite=Lax`; CSRF origin denetimi açık. Farklı Vercel süreçleri aynı PostgreSQL üzerinden oturumu bulur.
- API Route Handler Node.js runtime kullanır, `maxDuration=300`; Fluid Compute açık tutun ve proje süre limitinin buna izin verdiğini kontrol edin. Tek sağlayıcı çağrısı 40 saniyede zaman aşımına uğrar; soru üretimi en çok üç üretim/denetim denemesi yapar. Uzun bankaları tek HTTP isteğinde üretmeyin. Vercel'de öğrenci testi yalnızca mevcut onaylı bankadan oluşturulur; eksik bankayı admin önceden tek soru üretim işlemleriyle tamamlamalıdır.
- Fotoğraflar PNG/JPEG/WebP ve en fazla **2 MB**; JSON/base64 yükü Vercel'in 4.5 MB istek sınırının altında tutulur. Fotoğraflar dosya sistemine/veritabanına yazılmaz.
- Reset e-postası üretimde Resend ile gönderilir; Vercel'de yerel mail outbox kullanılmaz. E-posta ayarları olmadan giriş yapılabilir, gerçek parola yenileme teslimi yapılamaz.
- Maskotlar `public/mascot/*.webp`, ikonlar `public/icon-*.png` içinde; yerel fontlar build'e dahildir. Harici font erişimi gerekmez.
- `/manifest.webmanifest`, `/sw.js` ve `/offline.html` HTTPS'de PWA'yı sağlar. SW güncel sürüm kontrolü için önbelleksiz sunulur. Yalnızca offline sayfa önbelleğe alınır; öğrenci verisi, auth API, sohbet veya raporlar önbelleğe alınmaz. Offline çözüm/senkronizasyon yoktur.

## Deploy sonrası canlı kontrol

- URL'yi gizli tarayıcıda açın; `/login` görüntülenmeli. Admin girişi `/admin` adresine yönlenmeli; öğrenci ve ebeveyn hesapları kendi ekranlarına gidebilmeli.
- Bir bağımsız matematik testi oluşturup çözün, sayfayı yenileyin; sonuç ve oturum korunmalı. Başka öğrenci/rol verilerine erişim reddedilmeli.
- AI anahtarıyla öğretmene bir eğitim sorusu ve 2 MB altı gerçek fotoğraf gönderin. Soru üretimi için doğrulanmış konu/öğrenme çıktıları gerekir; anahtar tek başına resmî müfredatı tamamlamaz.
- Resend ayarlarıyla bir parola yenileme e-postası alın; bağlantının doğru HTTPS domain'ine gittiğini kontrol edin.
- Maskotlar ve ikonları kontrol edin; `/manifest.webmanifest` ve `/sw.js` HTTP 200 dönmeli. DevTools → Application'da worker etkin olmalı; bağlantıyı kesince offline sayfa görünmeli.
- Vercel Runtime Logs'ta hataları inceleyin; DB şeması eksikse migration'ı çalıştırın. Değişken eklendiğinde/değiştiğinde Redeploy yapın.

Bu oturumdaki yerel production testleri Vercel'in gerçek edge/function dağıtımı, sağlayıcı TLS bağlantısı, canlı AI veya e-posta tesliminin yerini tutmaz.

## GitHub'a gönderme

Repo şu anda ilk commit'i bekliyor; source dosyaları hazırlanmış durumda. Aşağıdaki komutları yazılabilir kendi checkout'unuzda çalıştırın:

```bash
git status --short
git add .
git diff --cached --stat
git commit -m "Prepare Nehir Akademi for Vercel deployment"
git branch -M main
git push -u origin main
```

Commit öncesi staged dosya adlarını gözden geçirin: gerçek `.env*`, `.local/`, `.vercel/`, anahtarlar ve `node_modules/` bulunmamalı. `.env.example` yalnızca boş secret alanları ve genel ayarlar içerir. Bu bulut checkout'unda `.git` yazma izni olmadığı için commit/push yapılmadı; proje dosyaları hazırlandı.
