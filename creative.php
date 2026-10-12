<?php
declare(strict_types=1);

// صفحة «الأساس للإنتاج الإبداعي» (/creative): الواجهة (صورة أو فيديو صامت)، تبويبات الخدمات والباقات (#social #production #design)،
// طريقة العمل، معرض الأعمال بالفلاتر و«عرض المزيد»، العملاء، الأسئلة الشائعة، نموذج الطلب المضمّن، وبيانات JSON-LD.

require __DIR__ . '/app/bootstrap.php';
require APP_PATH . '/site.php';
require APP_PATH . '/views/public_chrome.php';
require APP_PATH . '/views/creative_parts.php';

$site = site_data();
$S = $site['settings'];
$C = $site['content'];
$cr = $site['creative'];
if ($cr === null) {
    // الترحيل غير مطبّق بعد: نعيد الزائر للصفحة الرئيسية بدلاً من صفحة فارغة
    header('Location: ./', true, 302);
    exit;
}
$c = static fn(string $sec, string $f): string => e($C[$sec][$f] ?? '');
$raw = static fn(string $sec, string $f): string => (string)($C[$sec][$f] ?? '');
$on = static fn(string $k): bool => ($S[$k] ?? '1') === '1';

$wa = preg_replace('/\D/', '', $S['whatsapp_number'] ?? '') ?: '';
$creativeWa = preg_replace('/\D/', '', $S['creative_whatsapp'] ?? '') ?: $wa;
$waUrl = 'https://wa.me/' . $creativeWa;
[$lightW, $lightH] = $site['dims']['logo_light'] ?: [920, 364];
$favicon = $S['favicon'] ?? 'assets/favicon.png';
$favType = str_ends_with($favicon, '.png') ? 'image/png' : (str_ends_with($favicon, '.webp') ? 'image/webp' : 'image/jpeg');
$siteName = $S['site_name_ar'] ?? 'الأساس';
$metaTitle = $S['creative_meta_title'] ?? (($S['creative_section_title'] ?? 'الإنتاج الإبداعي') . ' | ' . $siteName);
$metaDesc = $S['creative_meta_description'] ?? '';
$ogImage = $cr['featured'][0]['cover'] ?? (($S['og_image'] ?? '') !== '' ? $S['og_image'] : ($S['logo_dark'] ?? 'assets/logo-dark.png'));
$heroImg = preg_match(PORTFOLIO_PATH_RE, (string)($S['creative_hero_image'] ?? '')) ? $S['creative_hero_image'] : '';
$heroVid = preg_match(PORTFOLIO_PATH_RE, (string)($S['creative_hero_video'] ?? '')) && str_ends_with((string)$S['creative_hero_video'], '.mp4') ? $S['creative_hero_video'] : '';

// وضع الصيانة يسري على هذه الصفحة أيضاً
if (($S['maintenance_mode'] ?? '0') === '1' && public_admin_peek() === null) {
    http_response_code(503);
    header('Retry-After: 3600');
    require APP_PATH . '/views/maintenance.php';
    exit;
}

$T = [
    'monthly' => $raw('creative_page', 'monthly_label') ?: 'شهرياً',
    'once' => $raw('creative_page', 'once_label') ?: 'دفعة واحدة',
    'order' => $raw('creative_page', 'order_text') ?: 'اطلب الباقة',
    'popular' => $raw('pricing', 'popular_badge') ?: 'الأكثر طلباً',
];
$first = $cr['first_page'];
$chrome = compact('site', 'S', 'c', 'raw', 'on', 'siteName', 'lightW', 'lightH', 'waUrl', 'wa') + ['home' => false];
$jsonFlags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE;

// ===== JSON-LD: Service لكل خدمة، وCreativeWork لكل عمل مميز =====
$pageUrl = absolute_url(creative_url());
$ld = ['@context' => 'https://schema.org', '@graph' => []];
foreach ($cr['services'] as $cat => $rows) {
    foreach ($rows as $sv) {
        $ld['@graph'][] = ['@type' => 'Service', 'name' => $sv['title'], 'description' => $sv['short_desc'], 'serviceType' => CREATIVE_CATS[$cat],
            'areaServed' => ['@type' => 'Country', 'name' => 'Iraq'], 'provider' => ['@type' => 'Organization', 'name' => $siteName, 'url' => absolute_url('./')], 'url' => $pageUrl . '#' . $cat];
    }
}
foreach ($cr['featured'] as $it) {
    $ld['@graph'][] = array_filter(['@type' => 'CreativeWork', 'name' => $it['title'], 'genre' => $it['categoryLabel'], 'image' => absolute_url($it['cover']),
        'description' => $it['description'] ?: null, 'dateCreated' => $it['date'] ?: null, 'creator' => ['@type' => 'Organization', 'name' => $siteName],
        'keywords' => $it['tags'] ? implode(', ', $it['tags']) : null]);
}

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
?><!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($metaTitle) ?></title>
<meta name="description" content="<?= e($metaDesc) ?>">
<link rel="canonical" href="<?= e($pageUrl) ?>">
<meta name="theme-color" content="<?= e(valid_color($S['color_ink'] ?? null) ? $S['color_ink'] : '#000000') ?>">
<meta property="og:type" content="website">
<meta property="og:locale" content="ar_IQ">
<meta property="og:site_name" content="<?= e($siteName) ?>">
<meta property="og:title" content="<?= e($metaTitle) ?>">
<meta property="og:description" content="<?= e($metaDesc) ?>">
<meta property="og:url" content="<?= e($pageUrl) ?>">
<meta property="og:image" content="<?= e(absolute_url($ogImage)) ?>">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="<?= e($favType) ?>" href="<?= e($favicon) ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="<?= e(google_fonts_url($S['font_display'] ?? '', $S['font_body'] ?? '')) ?>">
<link rel="stylesheet" href="css/style.css">
<style><?= brand_css($S) ?></style>
<script>document.documentElement.classList.add("js")</script>
<?php if ($heroImg !== ''): ?><link rel="preload" as="image" href="<?= e($heroImg) ?>"><?php endif; ?>
<script type="application/ld+json"><?= json_encode($ld, $jsonFlags | JSON_UNESCAPED_SLASHES) ?></script>
</head>
<body class="cr-page">
<div class="progress" aria-hidden="true"><span id="progressBar"></span></div>
<?php public_header($chrome); ?>

<main id="top">
<section class="cr-hero on-ink<?= $heroImg !== '' ? ' has-media' : '' ?>">
<?php if ($heroImg !== ''): ?>
  <div class="cr-hero-media" aria-hidden="true">
    <img src="<?= e($heroImg) ?>" alt="" width="1920" height="1080" fetchpriority="high">
<?php if ($heroVid !== ''): ?>
    <video muted playsinline autoplay loop preload="none" poster="<?= e($heroImg) ?>" data-hero-video="<?= e($heroVid) ?>"></video>
<?php endif; ?>
  </div>
<?php endif; ?>
  <div class="wrap">
    <span class="eyebrow"><?= $c('creative_page', 'hero_eyebrow') ?></span>
    <h1><?= $c('creative_page', 'hero_title') ?> <em><?= $c('creative_page', 'hero_highlight') ?></em></h1>
    <p class="lead"><?= $c('creative_page', 'hero_lead') ?></p>
    <div class="cta">
      <a href="#request" class="btn btn-lime" data-cr-order><?= $c('creative', 'cta_quote_text') ?></a>
      <a href="#portfolio" class="btn btn-ghost"><?= $c('creative', 'cta_portfolio_text') ?></a>
    </div>
<?php if ($heroVid !== ''): ?>
    <button type="button" class="cr-motion" data-hero-toggle aria-pressed="false" hidden>إيقاف الفيديو</button>
<?php endif; ?>
  </div>
</section>

<section class="block" id="services-tabs" aria-labelledby="tabs-title">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow"><?= e($S['creative_section_title'] ?? '') ?></span><h2 id="tabs-title" style="margin-top:12px"><?= $c('creative_page', 'tabs_title') ?></h2></div>
      <div class="seg cr-cur" role="group" aria-label="العملة"><button type="button" aria-pressed="true" data-cur="USD">USD</button><button type="button" aria-pressed="false" data-cur="IQD">IQD</button></div>
    </div>
    <div class="tabs cr-tabs" role="tablist" aria-label="أقسام الإنتاج">
<?php $i = 0; foreach (CREATIVE_CATS as $k => $l): ?>
      <button type="button" role="tab" id="tab-<?= e($k) ?>" aria-controls="<?= e($k) ?>" aria-selected="<?= $i === 0 ? 'true' : 'false' ?>" tabindex="<?= $i === 0 ? '0' : '-1' ?>" data-cr-tab="<?= e($k) ?>"><?= e($l) ?></button>
<?php $i++; endforeach; ?>
    </div>
<?php $i = 0; foreach (CREATIVE_CATS as $k => $l): ?>
    <div class="cr-panel" id="<?= e($k) ?>" role="tabpanel" aria-labelledby="tab-<?= e($k) ?>" tabindex="0"<?= $i++ ? ' data-inactive' : '' ?>>
      <h3 class="cr-panel-title"><?= e($l) ?></h3>
<?php if ($cr['services'][$k]): ?>
      <div class="cr-services">
<?php foreach ($cr['services'][$k] as $sv): $dl = json_list($sv['deliverables']); ?>
        <article class="cr-svc">
          <?= creative_icon_html((string)$sv['icon']) ?>
          <h4><?= e($sv['title']) ?></h4>
          <p><?= nl2br_e($sv['short_desc']) ?></p>
<?php if (trim((string)$sv['long_desc']) !== ''): ?>
          <details><summary>التفاصيل</summary><p><?= nl2br_e($sv['long_desc']) ?></p></details>
<?php endif; ?>
<?php if ($dl): ?>
          <ul class="cr-dl"><?php foreach ($dl as $d): ?><li><?= e($d) ?></li><?php endforeach; ?></ul>
<?php endif; ?>
        </article>
<?php endforeach; ?>
      </div>
<?php endif; ?>
<?php if ($cr['packages'][$k]): ?>
      <h3 class="cr-sub"><?= $c('creative_page', 'packages_title') ?></h3>
      <div class="plans cr-pkgs"><?php foreach ($cr['packages'][$k] as $p): ?><?= creative_package_card($p, $T) ?><?php endforeach; ?></div>
<?php endif; ?>
    </div>
<?php endforeach; ?>
    <p class="note"><?= $c('creative_page', 'packages_note') ?></p>
  </div>
</section>

<section class="block cr-process-wrap" id="process" aria-labelledby="process-title">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow"><?= $c('creative_page', 'process_eyebrow') ?></span><h2 id="process-title" style="margin-top:12px"><?= $c('creative_page', 'process_title') ?></h2></div></div>
    <ol class="cr-process">
<?php for ($n = 1; $n <= 4; $n++): ?>
      <li><span class="num mono" aria-hidden="true">0<?= $n ?></span><h3><?= $c('creative_page', 'step' . $n . '_title') ?></h3><p><?= $c('creative_page', 'step' . $n . '_text') ?></p></li>
<?php endfor; ?>
    </ol>
  </div>
</section>

<section class="block" id="portfolio" aria-labelledby="portfolio-title">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow"><?= $c('creative_page', 'portfolio_eyebrow') ?></span><h2 id="portfolio-title" style="margin-top:12px"><?= $c('creative_page', 'portfolio_title') ?></h2><p><?= $c('creative_page', 'portfolio_lead') ?></p></div></div>
<?php if ($first['total'] > 0): ?>
    <div class="pf-filters" role="group" aria-label="تصفية الأعمال" data-pf-filters>
      <button type="button" class="chip-btn" data-filter-cat="" aria-pressed="true">الكل</button>
<?php foreach (CREATIVE_CATS as $k => $l): ?>
      <button type="button" class="chip-btn" data-filter-cat="<?= e($k) ?>" aria-pressed="false"><?= e($l) ?></button>
<?php endforeach; ?>
<?php if ($cr['tags']): ?>
      <span class="sep" aria-hidden="true"></span>
<?php foreach ($cr['tags'] as $tg): ?>
      <button type="button" class="chip-btn tag" data-filter-tag="<?= e($tg) ?>" aria-pressed="false">#<?= e($tg) ?></button>
<?php endforeach; ?>
<?php endif; ?>
    </div>
    <div class="pf-gallery" data-pf-list data-page="1" data-pages="<?= (int)$first['pages'] ?>" aria-live="polite">
<?php foreach ($first['items'] as $i => $it): ?>
      <?= portfolio_card($it, $i) ?>

<?php endforeach; ?>
    </div>
    <p class="pf-empty" data-pf-empty hidden>لا توجد أعمال في هذا التصنيف بعد.</p>
    <div class="pf-more"><button type="button" class="btn btn-ghost" data-pf-more<?= $first['pages'] > 1 ? '' : ' hidden' ?>><span class="spinner" aria-hidden="true"></span><span class="lbl"><?= $c('creative_page', 'load_more_text') ?></span></button></div>
<?php else: ?>
    <p class="note">نضيف أعمالنا قريباً. اطلب نماذج من أعمالنا عبر واتساب.</p>
<?php endif; ?>
  </div>
</section>

<?php if ($cr['clients']): ?>
<section class="block cr-clients" aria-labelledby="clients-title">
  <div class="wrap">
    <h2 id="clients-title" class="cr-clients-title"><?= $c('creative_page', 'clients_title') ?></h2>
    <ul class="logos">
<?php foreach ($cr['clients'] as $cl): [$lw, $lh] = image_dims((string)$cl['logo']) ?: [160, 60]; ?>
      <li><?php if ($cl['url'] && preg_match('~^https://~i', (string)$cl['url'])): ?><a href="<?= e($cl['url']) ?>" target="_blank" rel="noopener noreferrer"><?php endif; ?><img src="<?= e($cl['logo']) ?>" alt="<?= e($cl['name']) ?>" width="<?= (int)($lw ?: 160) ?>" height="<?= (int)($lh ?: 60) ?>" loading="lazy"><?php if ($cl['url'] && preg_match('~^https://~i', (string)$cl['url'])): ?></a><?php endif; ?></li>
<?php endforeach; ?>
    </ul>
  </div>
</section>
<?php endif; ?>

<?php if ($cr['faq']): ?>
<section class="block" id="faq" aria-labelledby="cfaq-title">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">أسئلة شائعة</span><h2 id="cfaq-title" style="margin-top:12px"><?= $c('creative_page', 'faq_title') ?></h2></div></div>
    <div class="faq">
<?php foreach ($cr['faq'] as $i => $q): ?>
      <details<?= $i === 0 ? ' open' : '' ?>><summary><?= e($q['question']) ?></summary><p><?= nl2br_e($q['answer']) ?></p></details>
<?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="block cr-request" id="request" aria-labelledby="ci-title">
  <div class="wrap cr-request-grid">
    <div>
      <span class="eyebrow"><?= $c('creative_page', 'hero_eyebrow') ?></span>
      <h2 id="ci-title" style="margin-top:12px"><?= $c('creative_page', 'request_title') ?></h2>
      <p class="lead"><?= $c('creative_page', 'request_lead') ?></p>
<?php if ($creativeWa !== ''): ?>
      <a class="btn btn-ghost cr-wa" href="<?= e($waUrl . '?text=' . rawurlencode('مرحباً، أرغب بعرض سعر لخدمات الإنتاج الإبداعي')) ?>" target="_blank" rel="noopener"><?= $c('creative_page', 'whatsapp_text') ?></a>
<?php endif; ?>
    </div>
    <?= creative_request_form('ci', $cr['packages'], false, '') ?>
  </div>
</section>

<section class="final">
  <div class="wrap">
    <div class="box">
      <div><h2><?= $c('creative_page', 'final_title') ?></h2><p><?= $c('creative_page', 'final_lead') ?></p></div>
      <div class="cta"><a href="#request" class="btn btn-lime" data-cr-order><?= $c('creative_page', 'final_cta_text') ?></a><?php if ($creativeWa !== ''): ?><a href="<?= e($waUrl) ?>" class="btn btn-ghost" target="_blank" rel="noopener"><?= $c('creative_page', 'whatsapp_text') ?></a><?php endif; ?></div>
    </div>
  </div>
</section>
</main>

<?php public_footer($chrome); ?>
<?= creative_request_modal($cr['packages'], $raw('creative_page', 'request_title') ?: 'اطلب عرض سعر', $raw('creative_page', 'request_lead')) ?>
<?= creative_lightbox() ?>
<script id="creative-data" type="application/json"><?= json_encode(creative_js_data($cr, $S, $first['items'], $creativeWa, ['success' => 'وصل طلبك، سيتواصل معك فريق الإنتاج قريباً']), $jsonFlags | JSON_UNESCAPED_SLASHES) ?></script>
<script src="js/creative.js" defer></script>
</body>
</html>
