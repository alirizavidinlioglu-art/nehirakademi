# Nehir Akademi

Vercel için [production dağıtım adımları ve secret listesi](docs/VERCEL-DEPLOYMENT.md).

Nehir için veritabanına bağlı kişisel öğrenme platformu. Öğrenci, ebeveyn ve yönetici alanları ayrıdır. Çalışmalar kalıcı olarak kaydedilir; ekranlardaki istatistikler gerçek girişimlerden hesaplanır.

**Durum:** Yerel geliştirme ve production build hazırlanmıştır. Tam resmî müfredat ve canlı AI doğrulaması beklemektedir. Başlangıçtaki bağımsız matematik atölyeleri MEB müfredatı değildir; uygulamada da bu şekilde işaretlenir. Bu sürüm şartnamenin bütün tamamlanma kriterlerini karşılamış bir canlı ürün olarak sunulmaz.

## Çalıştırma

Node 24.19.0 önerilir; Node 22.9+ da desteklenir. Kilit dosyasıyla kurulum:

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev:accounts
npm run dev
```

Var olan `.env.local` dosyasını kopyalama komutuyla ezmeyin. `DATABASE_URL` boşken kalıcı PGlite PostgreSQL `.local/database` altında çalışır. PGlite yerel geliştirme için **tek uygulama sürecinde** açılmalıdır; aynı dizini iki sunucu veya migration komutuyla eşzamanlı açmayın. Dış PostgreSQL bağlantısı için `DATABASE_URL` tanımlayın; SSL doğrulamasını kapatmayın.

Yerel öğrenci, ebeveyn ve admin hesaplarının e-posta/parolaları `.local/development-accounts.json` dosyasındadır. Dosya 0600 izinli ve Git dışında tutulur. Rastgele parolalar üretilir; sabit veya kaynak koda gömülü parola yoktur. Komut mevcut hesapları/parolaları değiştirmez. Bunlar yalnızca geliştirme hesaplarıdır; dış PostgreSQL veya production için oluşturulmaz.

Gerçek ilk yönetici hesabını, `BOOTSTRAP_PASSWORD` değişkenini güvenli biçimde ortamda sağlayarak oluşturun:

```bash
npm run user:create -- --email=admin@example.com --name=Yönetici --role=ADMIN
```

Parola en az 12 karakter olmalıdır. Parolayı shell komutuna, Git'e veya sohbet mesajına yazmayın. Yönetici panelinden öğrenci ve ebeveyn hesapları oluşturup bağlantı kurabilirsiniz.

Production build ve başlangıç:

```bash
npm run build
npm start
```

Üretim için dış PostgreSQL, HTTPS üzerinden erişilen doğru `APP_URL`, gerçek kullanıcılar ve e-posta/AI bağlantıları yapılandırılmalıdır. Çok süreçli veya serverless kurulumlarda PGlite dizinini paylaşmayın. `REQUIRE_EXTERNAL_DATABASE=true` ayarı production'da yerel veritabanına yanlışlıkla düşmeyi engeller. PostgreSQL adaptörü gerçek yerel PostgreSQL ile Vercel modunda test edildi; production sağlayıcısının bağlantısı deploy sonrasında doğrulanmalı. Harici DB şeması için önce `npm run db:migrate` çalıştırın.

## Mimari

- Next.js 15 App Router, React 19, strict TypeScript, Tailwind 4 ve merkezi tasarım tokenları.
- Fredoka/Nunito yerel font paketleri; fontlar için Google'a istek gönderilmez.
- PostgreSQL SQL şeması; yerelde PGlite, dış sunucuda `postgres` sürücüsü. Supabase kullanılmadığı için tarayıcıya Supabase veya veritabanı kimlik bilgisi verilmez.
- bcrypt ile parolalar; veritabanında hashlenmiş oturum ve yenileme tokenları; HttpOnly/SameSite çerezler; Origin denetimi, giriş sınırı ve her API işleminde rol/sahiplik denetimi.
- Server-side AI, Zod şemaları, bağımsız soru kalite denetimi, soru bankası ve kullanım kaydı.
- Framer Motion maskot sistemi, KaTeX, PWA manifest ve öğrenci verisini önbelleğe almayan service worker.

Ana dizinler: `app/`, `components/`, `components/mascot/`, `components/tests/`, `config/`, `lib/`, `services/`, `database/`, `hooks/`, `types/`, `tests/`.

## Sayfalar

| Yol | İşlev |
| --- | --- |
| `/login`, `/reset` | Giriş, çıkış, kalıcı oturum, parola yenileme |
| `/` | Günlük plan, dersler, hedef, tekrarlar ve yaklaşanlar |
| `/dersler`, `/dersler/:id` | 7/8. sınıf ders ve ünite ağacı |
| `/konu/:id` | Öğrenme, kısa tekrar, test oluşturma, AI ve yanlışlar |
| `/test/:id` | On soru türü, cevap kaydı, geri bildirim ve sonuçlar |
| `/ogretmen` | Beş seviyeli destek, metin, kamera/galeri fotoğrafı |
| `/yanlislarim` | Ders/konu/tarih filtreleri, tekrar ve yeni soru testi |
| `/calismalar` | Hazırlanmış testler, devam etme ve geçmiş sonuçlar |
| `/plan` | 20/30/45/60 dakika plan; 8. sınıfta süreli deneme |
| `/odevler`, `/sinavlar` | Kalıcı ödev/sınav kayıtları ve konu seçimi |
| `/basarim` | Performans, konu hâkimiyeti, hata örüntüleri, rozetler |
| `/ebeveyn` | Yalnızca bağlı öğrencilerin gelişim ve haftalık özeti |
| `/admin` | Müfredat/içerik, soru ve kullanıcı yönetimi; test oluşturma/düzenleme/arşivleme; kaynak/AI kayıtları |

## Veritabanı

`database/schema.sql`, UUID anahtarlar, foreign key'ler, indeksler ve işlem sınırları içerir. `curriculum_nodes`, ders → tema/ünite → konu → alt konu → öğrenme çıktısı → beceri/içerik hiyerarşisini taşır. Ders/ünite/konu/alt konu/öğrenme çıktısı görünümleri bu tabloda saklanan veriyi sunar. Yıl, sınıf, ders, kaynak URL, sürüm, çıktı kodu ve doğrulama durumu kayıtların parçasıdır.

Kullanıcı/profil/ebeveyn bağlantıları; sorular/seçenekler/doğrulamalar; test/soru/oturum/girişimler; mastery/hata/tekrar; plan/çalışma/ödev/sınav; rozet/seri; AI konuşma/mesaj/kullanım ve bildirim tabloları bulunur. Bildirim tablosu ve hata tipi sınıflandırma alanları altyapıdır; otomatik bildirim gönderimi ve güvenilir hata teşhisi bu sürümde tamamlanmadı.

Seed tekrar çalıştırılabilir. 7 ve 8. sınıfta toplam 12 ders ile **134 özgün bağımsız alıştırma** vardır. Resmî ünite ve kazanım kodu tahmin edilmez. Testte kullanılan sorular sonradan değiştirilmez; bankadan çıkarılınca geçmiş sonuçları korunur. Yönetici düzeltmeyi yeni soru kaydı olarak ekler.

Mastery; yakın dönem başarı, zorluk, yardım seviyesi, yanıt süresi ve tekrar eden hata kanıtını birlikte değerlendirir. Bu, sınav notu veya bilimsel tanı değildir. Hata türü kanıtla belirlenmediyse `unclassified` tutulur. Tekrar aralıkları 1/3/7/14/30 gündür; başarısız veya yoğun yardımlı çözüm aralığı kısaltır. Gün/seri hesapları Europe/Istanbul kullanır.

## Resmî müfredat

Kaynak önceliği `tymm.meb.gov.tr`, `mufredat.meb.gov.tr`, `www.meb.gov.tr` adresleridir. Bu ortamda resmî portal isteği ağ proxy'sinde 403 ile engellendi. Gereken alan adları ortam yapılandırma taslağına kaydedildi; çalışan ortama henüz uygulanmadı.

Bu nedenle tam 7/8. sınıf MEB programları **aktarılmadı**. Her sınıfın ve dersin hangi program/sürüme tabi olduğu, uygulama takvimiyle birlikte resmî belgelerden kontrol edilmelidir. Özellikle TYMM'nin kademeli uygulanması nedeniyle 7/8. sınıfı otomatik olarak aynı sürüme bağlamayın.

Erişim açıldığında resmî programı inceleyip admin ağacından kaynağı, yılı, sürümü, üniteyi, konuyu ve çıktı kodunu ekleyin. “Doğruladım” işareti adminin belgeyi incelemesi anlamındadır; yalnızca URL'nin MEB alan adı olması içerik doğrulaması sayılmaz. AI soru üretimi, doğrulanmış konu ve en az bir doğrulanmış öğrenme çıktısı olmadan çalışmaz. Bağımsız alıştırmaları resmî kazanım diye işaretlemeyin.

## AI sistemi

`services/ai.ts` merkezi öğretmen talimatını ve sağlayıcı adaptörünü içerir. İstekler yalnızca sunucudadır; sisteme öğrenci e-postası veya bütün veritabanı gönderilmez. Özet mastery/hata bilgisi, son altı konuşma mesajı ve ilgili konu/soru bağlamı kullanılır.

Soru üretimi → yapısal doğrulama → ikinci bağımsız AI denetimi → bankaya kayıt akışı vardır. Tek doğru cevap, çözüm, yaş, müfredat kapsamı, açıklık ve tekrar denetlenir. Reddedilen soru öğrencinin testine çıkmaz; üç başarısız denemeden sonra açık hata verilir. Daha önce doğrulanan sorular bankadan tekrar kullanılabilir. Otomatik denetim matematiksel doğruluk garantisi değildir; yönetici incelemesi de desteklenir.

Öğretmen 1–5 destek seviyesiyle ilerler. Test sorusundaki yardım aynı soru ve test kaydına bağlanır. Fotoğraf PNG/JPEG/WebP ve en fazla 2 MB olabilir; sunucuda imza/uzunluk denetimi yapılır. Fotoğraf dosyası veya base64 verisi veritabanına kaydedilmez; sağlayıcıya gönderilir. Konuşma metni saklanır. Sayısal/eşleştirme/kısa cevap değerlendirmesi bankadaki kanonik cevapla yapılır; serbest metne semantik not verme henüz yoktur.

API anahtarı yoksa AI işlemleri 503 ve anlaşılır hata döndürür; sahte yanıt üretilmez. Bu ortamda canlı AI, fotoğraf analizi ve canlı AI soru kalitesi henüz doğrulanmadı. Entegrasyon testleri kontrollü sağlayıcı test yanıtları kullanır; bunlar canlı sağlayıcı testi değildir.

`AI_API_KEY` ortam ayarlarında güvenli biçimde sağlanmalıdır. Proxy kimlik bilgisi kullanılıyorsa hedef `api.openai.com` olmalıdır. Sunucu adaptörü mevcut HTTP/HTTPS proxy'sini ve CA doğrulamasını korur; doğrulamayı devre dışı bırakmaz.

## Ortam değişkenleri

| Değişken | Kullanım |
| --- | --- |
| `DATABASE_URL` | Dış PostgreSQL; boşsa yerel PGlite |
| `LOCAL_DATABASE_PATH` | Yerel DB dizini; varsayılan `.local/database` |
| `REQUIRE_EXTERNAL_DATABASE` | Production için dış DB zorunluluğu |
| `APP_URL` | Uygulamanın gerçek origin'i; HTTPS'de Secure çerez |
| `AI_API_KEY` | Gizli, yalnızca sunucuda kullanılan sağlayıcı anahtarı |
| `AI_MODEL` | Varsayılan `gpt-4.1-mini` |
| `AI_BASE_URL` | Varsayılan `https://api.openai.com/v1`; HTTPS zorunlu |
| `AI_INPUT_PRICE_PER_MILLION`, `AI_OUTPUT_PRICE_PER_MILLION` | USD/token fiyatları; yoksa maliyet “yapılandırılmadı” |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Resend ile gerçek parola yenileme e-postası |
| `DEV_MAIL_OUTBOX` | Production modunda yalnızca test için yerel outbox etkinleştirme |
| `DEV_MAIL_OUTBOX_PATH` | Test/dev outbox dizini; varsayılan `.local/mail-outbox` |
| `BOOTSTRAP_PASSWORD` | İlk gerçek kullanıcı oluşturma komutuna geçici parola |
| `CHROMIUM_PATH` | Tarayıcı testlerinde özel Chromium yolu |

Geliştirmede e-posta yapılandırılmamışsa yenileme bağlantısı özel `.local/mail-outbox` dosyasına yazılır. Production'da gerçek e-posta teslimi için `api.resend.com` ağ erişimi ve Resend ayarları gerekir; bu ortamda gerçek e-posta teslimi denenmedi. Kullanıcıya hesabın varlığını açıklamayan genel yanıt verilir. Token 30 dakika geçerli ve tek kullanımlıktır; parola değişikliği mevcut oturumları iptal eder.

## Maskot ve PWA

Gönderilen RAR'dan sekiz Nehir pozu alındı; diğer on ilgisiz görsel kullanılmadı. Yeni maskot veya alternatif avatar üretilmedi. Optimize WebP dosyaları `public/mascot/`, orijinal PNG'ler `assets/mascot-source/` altındadır. Eşleme `config/mascot.ts`, bileşen `MascotGuide`, kuyruk ve tercihler `MascotProvider` içindedir. Aynı poz bazı ilişkili durumlarda yeniden kullanılır.

Maskot animasyonları reduced-motion tercihine uyar. Mesajlar öncelikli kuyrukla ve tekrar engeliyle gösterilir. Küçültme ve ilk giriş tercihi veritabanında saklanır. Rehber soru ve butonların üzerine sabitlenmez. Yalnızca aktif görsel öncelikli yüklenir; bütün pozlar başta yüklenmez.

PWA manifest, maskottan türetilmiş ikonlar ve çevrimdışı bilgilendirme sayfası vardır. Service worker giriş yapılmış sayfaları, API sonuçlarını veya öğrenci verilerini önbelleğe almaz. Çevrimdışı test çözümü/sonradan senkronizasyon bu sürümde yoktur.

## Kontroller

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E testleri kendi `.local/e2e-database` veritabanını sıfırlar; ana geliştirme verisini değiştirmez. Test e-postaları `.local/e2e-mail-outbox` altında tutulur. Chromium bu bulut ortamında hazırdır; diğer makinelerde `npx playwright install chromium` veya `CHROMIUM_PATH` kullanın. `test:e2e` kendi production build'ini ve 3001 portundaki sunucusunu başlatır.

Son doğrulama sonuçları ve açık işler için `docs/VALIDATION.md` dosyasına bakın. Yerel geliştirme dizinindeki parolalar, DB dosyaları, reset bağlantıları ve test kayıtları Git'e alınmaz. Bulut task'ları zaten izoledir; mevcut checkout'u kullanın, ayrıca worktree oluşturmayın.
