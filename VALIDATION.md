# Doğrulama ve açık işler

Bu sonuçlar mevcut bulut makinesinde alınmıştır. Ortam yayımlanmadı; yeni task'ta snapshot/startup doğrulaması yapılmadı.

## Geçen kontroller

- `npm run lint`: geçti; ESLint hata/uyarı yok.
- `npm run typecheck`: geçti; strict TypeScript hata yok.
- `npm test`: **24/24** test geçti. Mastery/tekrar/cevap normalizasyonu, negatif grafik koordinatları, PGlite üzerinde PostgreSQL şeması ve transaction/foreign key/seed tekrarları; Vercel origin/HTTPS/harici DB zorunluluğu; AI zinciri için kontrollü sağlayıcı testleri.
- `npm run build`: production build geçti. `test:e2e` aynı build'i çalıştırarak uygulamayı doğruladı.
- `npm run test:e2e`: **16/16** tarayıcı senaryosu geçti. Testler sıfır test veya yalnızca açık port kontrolü değildir.

Tarayıcı kontrolleri Chromium'da yapıldı:

1. Giriş/çıkış, kalıcı oturum, rol ayrımı ve CSRF kontrolü.
2. Ebeveyn yalnızca bağlı öğrenciyi görür; öğrenci kaydını değiştiremez.
3. Doğru, yanlış ve boş cevap; kalıcı sonuçlar/mastery/tekrar kaydı.
4. Başka öğrencinin testine erişim, sıra dışı veya tekrar cevap engeli.
5. Ödev oluştur/tamamla/sil, sınav konuları ve günlük plan kaydı.
6. Admin müfredat oluştur/güncelle/sil; yanlış kaynak doğrulama engeli.
7. Gizli ve tek kullanımlık parola yenileme; eski oturum iptali. Test e-postası yerel outbox kullanır.
8. Anahtarsız AI için açık 503/hata durumu; sahte yanıt gösterilmez.
9. Öğrenci ekranları 320/375/390/430/768/1024/1280/1440 px genişliklerde: yatay taşma yok; beklenmeyen pageerror ve yerel varlık 404 yok. Maskot/PWA dosyaları HTTP 200.
10. On soru türünün tamamı UI üzerinden doğru cevaplanır; kullanılan sorunun geçmişi korunur.
11. 8. sınıf süreli deneme ve sonuç kaydı.
12. Ebeveyn/admin 390 ve 1440 px ekranları; bütün admin sekmeleri.
13. Admin test oluşturma/ad değiştirme/arşivleme/geri alma; öğrenci çalışmalar listesi ve ilk erişimde sayaç başlatma.

390/1440 px dashboard, parent ve admin ekran görüntüleri `.local/` altında incelendi. Gerçek telefonda kamera, PWA kurulum diyaloğu, Safari ve Firefox ayrıca test edilmedi. AI anahtarı yokken beklenen 503 yanıtı test edilen bir eksik yapılandırma durumudur; canlı AI başarısı değildir.

Kaydedilen kurulum betiği çalıştırıldı. Geliştirme sunucusunda gerçek giriş → dashboard → müfredat → çıkış isteği HTTP 200 ile tamamlandı; /login hazır, AI bağlantısı false. `npm ci` ve migration/seed tekrarları çalıştırıldı; veriler ve yerel geliştirme parolaları korundu. TLS doğrulaması açık, mevcut proxy üzerinden npm registry HEAD isteği HTTP 200 döndü. Bu sonuç api.openai.com veya MEB yetkisini kanıtlamaz.

## Hazır işlevler

Kalıcı yerel DB, üç rol, auth/reset altyapısı, 7/8 sınıf ve ders kayıtları, bağımsız öğrenme atölyesi, on soru türü, test bankası/girişimleri/sonuçları, yanlışlar, adaptif tekrar/mastery, günlük plan, ödev/sınav, rozet/seri, ebeveyn raporu, admin müfredat/soru/kullanıcı/test işlemleri, maskot seti/durumları/kuyruğu/tercihleri, animasyonlar, KaTeX, yerel Fredoka/Nunito ve PWA.

## Bekleyen zorunlu dış bağımlılıklar

| İş | Kanıt / neden | Sonraki adım |
| --- | --- | --- |
| Tam resmî 7/8 MEB programı | tymm.meb.gov.tr isteği proxy'de 403; çalışan ortamın izin listesinde MEB yok | Ortam ayarlarında kaydedilmiş ağ eklemelerini uygulayın; resmî belge/sürüm/takvimi inceleyip veri aktarımını tamamlayın |
| Canlı AI öğretmen/üretim/doğrulama/fotoğraf | AI_API_KEY bağlanmadı; mevcut runtime'da anahtar yok | Ortam ayarlarında AI_API_KEY değerini güvenli ekleyin ve api.openai.com erişimini uygulayın; canlı akışları doğrulayın |

Bu iki iş nedeniyle tam ürün şartnamesi tamamlanmış değildir. AI kodu/testleri hazır olsa da canlı kullanım çalışıyor diye işaretlenmez. Resmî müfredat yerine tahmin edilen konu veya kazanım üretilmedi.

## Üretim ve gelişim için kalanlar

- Gerçek yerel PostgreSQL 18 üzerinde migration iki kez çalıştırıldı; 12 ders / 134 soru korundu. `VERCEL=1` production sunucusunda giriş, Secure/HttpOnly/SameSite çerez, rol/CSRF, test oluşturma/cevaplama/dashboard ve çıkış geçti. Sağlayıcının uzak TLS bağlantısı ve gerçek Vercel function dağıtımı henüz denenmedi.
- Gerçek parola yenileme e-postası Resend kimlik bilgileri ve api.resend.com erişimi gerektirir. Yerel outbox akışı test edildi; gerçek teslim test edilmedi.
- Tam LGS soru dağılımı, resmî deneme formatı ve yeni nesil soru bankası tamamlanmadı. Mevcut süreli deneme bağımsız çalışma olarak etiketlenir.
- Serbest metne semantik not verme, güvenilir otomatik hata teşhisi ve tüm derslerin kapsamlı öğretim içeriği tamamlanmadı.
- Beceri/içerik/bildirim veri alanları ve modüler renderer genişletilebilir; otomatik bildirim gönderimi, zamanlanmış e-posta raporları, çevrimdışı çalışma/senkronizasyon ve tüm domain yönetimleri için ayrıntılı editörler bu sürümde yoktur.
- Uygulama, GitHub'a push edilmedi ve ortam yayımlanmadı. Kod seçili checkout'ta kullanıcı incelemesi için durur.

Kurulum ve başlangıç talimatları `scripts/cloud-install.sh` ve `scripts/cloud-start-skill.md` içinde; aynı içerikler `install_script` ve `start_skill` alanları olarak ortam yapılandırma taslağına kaydedildi. Gereken MEB alan adları, api.openai.com erişimi ve AI_API_KEY gereksinimi de taslakta bulunur. Taslak kaydı runtime'a uygulama veya yayınlama anlamına gelmez.

## Vercel hazırlığı

`vercel.json`, Node.js API runtime ve 300 saniye function bütçesi hazır. Vercel harici PostgreSQL olmadan yerel dosya oluşturmaya düşmez; pooler için prepared statements kapalı ve süreç başına bağlantı sayısı 1. Harici migration/runtime ayrıldı, başarısız DB bağlantısı sonraki istekte yeniden denenebilir. Production origin/HTTPS reset bağlantıları ve Secure çerezler hazır. Fotoğraf sınırı 2 MB. Başarılı girişler başarısız deneme sayacını temizler; ardışık başarılı girişler ve başarısız giriş limiti test edildi.

PWA manifest, bütün WebP/PNG/public dosyaları, service worker başlıkları ve offline fallback production build üzerinden test edildi. Özel verilerin cache'e alınmadığı kontrol edildi. Next.js function tracing boyutları yaklaşık 15–16 MB; SQL dosyası izlenen dosyalar içinde. Bu değer gerçek Vercel artifact boyutu yerine yerel Next.js izidir.

Dağıtım adımları, gerçek secret adları, ilk admin oluşturma ve deploy sonrası kontroller `docs/VERCEL-DEPLOYMENT.md` içinde. Gerçek env, özel anahtarlar, development DB/hesaplar ve Vercel yerel ayarları Git ignore kapsamında. `.git` yazma izni yok; commit/push yapılmadı.

Son `npm run build`, `VERCEL=1` ve deployment origin ile, harici DB/gerçek anahtar olmadan geçti. Geçici sentetik credential işareti ve öğretmen sistem talimatı `.next/static` public bundle dosyalarında bulunmadı. Gerçek API anahtarı kullanılmadı.
