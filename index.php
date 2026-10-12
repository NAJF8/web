<?php
declare(strict_types=1);

// الصفحة الرئيسية العامة: تُبنى من قاعدة البيانات بنفس بنية index.html السابقة (الأصناف والمعرّفات كما هي)
// كي تعمل css/style.css وjs/main.js دون تغيير في الشكل. كل قيمة ديناميكية تمر عبر e().

require __DIR__ . '/app/bootstrap.php';
require APP_PATH . '/site.php';
require APP_PATH . '/views/public_chrome.php';
require APP_PATH . '/views/creative_parts.php';

$site = site_data();
$S = $site['settings'];
$C = $site['content'];
$c = static fn(string $sec, string $f): string => e($C[$sec][$f] ?? '');
$raw = static fn(string $sec, string $f): string => (string)($C[$sec][$f] ?? '');
$on = static fn(string $k): bool => ($S[$k] ?? '1') === '1';

$wa = preg_replace('/\D/', '', $S['whatsapp_number'] ?? '') ?: '';
$waUrl = 'https://wa.me/' . $wa;
$discount = (float)($S['yearly_discount_percent'] ?? 17);
$pct = num_trim($discount);
$cats = $site['plans'];
$firstCat = $cats[0] ?? null;
[$lightW, $lightH] = $site['dims']['logo_light'] ?: [920, 364];
$favicon = $S['favicon'] ?? 'assets/favicon.png';
$favType = str_ends_with($favicon, '.png') ? 'image/png' : (str_ends_with($favicon, '.webp') ? 'image/webp' : 'image/jpeg');
$metaTitle = $S['meta_title'] ?? 'الأساس';
$metaDesc = $S['meta_description'] ?? '';
$ogImage = ($S['og_image'] ?? '') !== '' ? $S['og_image'] : ($S['logo_dark'] ?? 'assets/logo-dark.png');
$siteName = $S['site_name_ar'] ?? 'الأساس';
$popBadge = $raw('pricing', 'popular_badge');
// قسم الإنتاج الإبداعي: يظهر فقط بعد تطبيق الترحيل وتفعيل الإعداد
$cr = $site['creative'];
$showCreative = $cr !== null && $on('show_creative_section');
$creativeWa = preg_replace('/\D/', '', $S['creative_whatsapp'] ?? '') ?: $wa;
$chrome = compact('site', 'S', 'c', 'raw', 'on', 'siteName', 'lightW', 'lightH', 'waUrl', 'wa') + ['home' => true];

// ===== وضع الصيانة: الزوار يرون صفحة 503، والمشرفون المسجلون يرون الموقع مع شريط تنبيه =====
$maintenanceAdmin = false;
if (($S['maintenance_mode'] ?? '0') === '1') {
    if (public_admin_peek() === null) {
        http_response_code(503);
        header('Retry-After: 3600');
        require APP_PATH . '/views/maintenance.php';
        exit;
    }
    $maintenanceAdmin = true;
}


// ===== بيانات JavaScript (تُحقن كـ JSON آمن) =====
$plansJs = [];
foreach ($cats as $cat) {
    $plansJs[$cat['key']] = array_map(static fn(array $p) => [
        'id' => (int)$p['id'],
        'n' => $p['name'],
        's' => (string)$p['subtitle'],
        'p' => (float)$p['price_monthly_usd'],
        'pop' => (int)$p['is_popular'],
        'link' => $p['order_link'] ? safe_url($p['order_link'], '') : '',
        'spec' => array_map(static fn($s) => [$s['label'], $s['value']], $p['specs']),
    ], $cat['plans']);
}
$siteJs = [
    'plans' => $plansJs,
    'iqdRate' => (float)($S['iqd_rate'] ?? 1310),
    'iqdRoundTo' => (int)($S['iqd_round_to'] ?? 250),
    'yearlyDiscount' => $discount,
    'defaultCurrency' => ($S['currency_default'] ?? 'USD') === 'IQD' ? 'IQD' : 'USD',
    'tlds' => array_map(static fn($t) => ['tld' => $t['tld'], 'price' => (float)$t['price_year_usd']], $site['tlds']),
    'whatsapp' => $wa,
    'texts' => [
        'perMonth' => $raw('pricing', 'per_month'),
        'perMonthYearly' => $raw('pricing', 'per_month_yearly'),
        'order' => $raw('pricing', 'order_text'),
        'popular' => $popBadge,
        'saveBadge' => str_replace('{percent}', $pct, $raw('pricing', 'save_badge')),
    ],
    'api' => ['order' => 'api/order.php', 'domain' => 'api/domain-order.php', 'contact' => 'api/contact.php'],
];
$jsonFlags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE;

/** رابط واتساب احتياطي (دون JavaScript) لزر طلب خطة */
$waOrder = static fn(string $plan): string => $waUrl . '?text=' . rawurlencode('مرحباً، أرغب بطلب خطة ' . $plan);

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
<meta name="theme-color" content="<?= e(valid_color($S['color_ink'] ?? null) ? $S['color_ink'] : '#000000') ?>">
<meta property="og:type" content="website">
<meta property="og:locale" content="ar_IQ">
<meta property="og:site_name" content="<?= e($siteName) ?>">
<meta property="og:title" content="<?= e($metaTitle) ?>">
<meta property="og:description" content="<?= e($metaDesc) ?>">
<meta property="og:image" content="<?= e(absolute_url($ogImage)) ?>">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="<?= e($favType) ?>" href="<?= e($favicon) ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="<?= e(google_fonts_url($S['font_display'] ?? '', $S['font_body'] ?? '')) ?>">
<link rel="stylesheet" href="css/style.css">
<style><?= brand_css($S) ?></style>
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
<div class="progress" aria-hidden="true"><span id="progressBar"></span></div>
<?php if ($maintenanceAdmin): ?>
<div class="admin-bar on-ink" role="note">وضع الصيانة مفعّل: الزوار يرون صفحة الصيانة حالياً. <a href="admin/settings.php#toggles">إدارة الإعداد</a></div>
<?php endif; ?>
<?php public_header($chrome); ?>

<main id="top">
<section class="hero">
  <div class="wrap">
    <div>
      <span class="eyebrow"><?= $c('hero', 'eyebrow') ?></span>
      <h1><?= $c('hero', 'title') ?> <em><?= $c('hero', 'title_highlight') ?></em> <?= $c('hero', 'title_after') ?></h1>
      <p class="lead"><?= $c('hero', 'lead') ?></p>
      <div class="cta">
        <a href="<?= e(safe_url($raw('hero', 'cta_primary_link'))) ?>" class="btn btn-lime"><?= $c('hero', 'cta_primary_text') ?></a>
        <a href="<?= e(safe_url($raw('hero', 'cta_secondary_link'))) ?>" class="btn btn-ghost"><?= $c('hero', 'cta_secondary_text') ?></a>
      </div>

      <div class="domain" id="domain">
        <label for="domainInput"><?= $c('hero', 'domain_label') ?></label>
        <form id="domainForm">
          <div class="field">
            <input id="domainInput" type="text" placeholder="yourbrand" autocomplete="off" spellcheck="false" autocapitalize="off" inputmode="url" aria-describedby="domainErr">
            <select id="tldSelect" aria-label="الامتداد">
              <?php foreach ($site['tlds'] as $t): ?><option><?= e($t['tld']) ?></option><?php endforeach; ?>

            </select>
          </div>
          <button class="btn btn-lime" type="submit" id="domainBtn"><span class="spinner" aria-hidden="true"></span><span class="lbl">بحث</span></button>
          <p class="field-err" id="domainErr"></p>
        </form>
        <div class="result" id="domainResult" aria-live="polite"></div>
        <?php
        $hinted = array_filter($site['tlds'], static fn($t) => trim((string)$t['hint']) !== '');
        $plain = array_filter($site['tlds'], static fn($t) => trim((string)$t['hint']) === '');
        ?>
        <div class="tlds"><?php foreach ($hinted as $t): ?><span><b><?= e($t['tld']) ?></b> <?= e($t['hint']) ?></span><?php endforeach; ?><?php if ($plain): ?><span><?= implode(' ', array_map(static fn($t) => '<b>' . e($t['tld']) . '</b>', $plain)) ?></span><?php endif; ?></div>
      </div>
    </div>

    <div class="rack on-ink" aria-label="<?= $c('hero', 'rack_title') ?> (توضيحي)">
      <div class="head"><span class="ttl"><?= $c('hero', 'rack_title') ?> <span class="live"><i aria-hidden="true"></i>LIVE</span></span><span class="mono">ALASAS-DC01</span></div>
      <div class="unit">
        <div class="leds"><i class="on"></i><i class="on"></i><i></i></div>
        <div><div class="name">vps-node-01</div><div class="bar"><span style="width:42%"></span></div></div>
        <div class="stat" data-live="CPU">CPU 42%</div>
      </div>
      <div class="unit">
        <div class="leds"><i class="on"></i><i class="on"></i><i></i></div>
        <div><div class="name">web-cluster-02</div><div class="bar"><span style="width:28%"></span></div></div>
        <div class="stat" data-live="CPU">CPU 28%</div>
      </div>
      <div class="unit">
        <div class="leds"><i class="on"></i><i class="on"></i><i class="on"></i></div>
        <div><div class="name">nvme-storage-03</div><div class="bar"><span style="width:61%"></span></div></div>
        <div class="stat" data-live="I/O">I/O 61%</div>
      </div>
      <div class="unit">
        <div class="leds"><i class="on"></i><i></i><i></i></div>
        <div><div class="name">backup-vault</div><div class="bar"><span style="width:17%"></span></div></div>
        <div class="stat">Snap 03:00</div>
      </div>
      <div class="meta"><?= $c('hero', 'rack_note') ?></div>
    </div>
  </div>
</section>

<section class="block" id="services">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow"><?= $c('services', 'eyebrow') ?></span>
        <h2 style="margin-top:12px"><?= $c('services', 'title') ?></h2>
        <p><?= $c('services', 'lead') ?></p>
      </div>
    </div>
    <div class="services">
<?php foreach ($site['services'] as $sv): ?>
      <a class="svc" href="<?= e(safe_url($sv['link'])) ?>">
        <?= service_icon_html($sv['icon']) ?>

        <h3><?= e($sv['title']) ?><?php if (trim((string)$sv['badge_text']) !== ''): ?><span class="tag"><?= e($sv['badge_text']) ?></span><?php endif; ?></h3><p><?= nl2br_e($sv['description']) ?></p><span class="more"><?= $c('services', 'more_text') ?> <span class="arr" aria-hidden="true">←</span></span>
      </a>
<?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($showCreative): ?>
<section class="cr-band on-ink" id="creative" aria-labelledby="creative-title">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow"><?= $c('creative', 'eyebrow') ?></span>
        <h2 id="creative-title" style="margin-top:12px"><?= $c('creative', 'title') ?></h2>
        <p><?= $c('creative', 'lead') ?></p>
      </div>
      <div class="cta">
        <button type="button" class="btn btn-lime" data-cr-order><?= $c('creative', 'cta_quote_text') ?></button>
        <a href="<?= e(creative_url('portfolio')) ?>" class="btn btn-ghost"><?= $c('creative', 'cta_portfolio_text') ?></a>
      </div>
    </div>
    <div class="cr-cats">
<?php foreach (['social' => 'social', 'production' => 'camera', 'design' => 'brand'] as $catKey => $icon): ?>
      <a class="cr-cat" href="<?= e(creative_url($catKey)) ?>">
        <?= creative_icon_html($icon) ?>
        <h3><?= $c('creative', $catKey . '_title') ?></h3>
        <p><?= $c('creative', $catKey . '_desc') ?></p>
        <ul><?php foreach (array_slice(lines($raw('creative', $catKey . '_points')), 0, 4) as $pt): ?><li><?= e($pt) ?></li><?php endforeach; ?></ul>
        <span class="more"><?= $c('creative', 'more_text') ?> <span class="arr" aria-hidden="true">←</span></span>
      </a>
<?php endforeach; ?>
    </div>
<?php if ($cr['featured']): ?>
    <div class="cr-strip">
      <h3><?= $c('creative', 'featured_title') ?></h3>
      <div class="bento" data-pf-list>
<?php foreach ($cr['featured'] as $i => $it): ?>
        <?= portfolio_card($it, $i, 'pf-item bento-item') ?>

<?php endforeach; ?>
      </div>
    </div>
<?php endif; ?>
  </div>
</section>
<?php endif; ?>

<section class="block" id="pricing">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow"><?= $c('pricing', 'eyebrow') ?></span>
        <h2 style="margin-top:12px"><?= $c('pricing', 'title') ?></h2>
        <p><?= $c('pricing', 'lead') ?></p>
      </div>
    </div>
    <div class="price-ctrl">
      <div class="tabs" role="tablist" aria-label="نوع الخدمة">
        <span class="tab-ind" aria-hidden="true"></span>
<?php foreach ($cats as $i => $cat): ?>
        <button type="button" role="tab" id="tab-<?= e($cat['key']) ?>" aria-selected="<?= $i === 0 ? 'true' : 'false' ?>" aria-controls="plans" tabindex="<?= $i === 0 ? '0' : '-1' ?>" data-tab="<?= e($cat['key']) ?>"><?= e($cat['name']) ?></button>
<?php endforeach; ?>
      </div>
      <div class="cycle">
        <button type="button" class="switch" id="cycSwitch" role="switch" aria-checked="false" aria-label="الدفع السنوي">
          <span class="lbl-m" aria-hidden="true"><?= $c('pricing', 'monthly_label') ?></span><span class="track" aria-hidden="true"><span class="thumb"></span></span><span class="lbl-y" aria-hidden="true"><?= $c('pricing', 'yearly_label') ?></span>
        </button>
        <span class="save"><?= e(str_replace('{percent}', $pct, $raw('pricing', 'save_text'))) ?></span>
      </div>
    </div>
    <div class="plans" id="plans" role="tabpanel" aria-labelledby="tab-<?= e($firstCat['key'] ?? 'vps') ?>" tabindex="0">
      <!-- static fallback (no JS); replaced by render() in js/main.js -->
<?php foreach ($firstCat['plans'] ?? [] as $p):
    $link = $p['order_link'] ? safe_url($p['order_link']) : $waOrder($p['name']); ?>
      <article class="plan<?= $p['is_popular'] ? ' pop' : '' ?>" data-badge="<?= e($popBadge) ?>"><div><h3><?= e($p['name']) ?></h3><div class="sub"><?= e($p['subtitle']) ?></div></div><div class="price"><div class="amount"><span class="n"><?= e(num_trim($p['price_monthly_usd'])) ?></span><span class="cur">USD</span></div></div><div class="per"><?= $c('pricing', 'per_month') ?></div><ul class="specs"><?php foreach ($p['specs'] as $sp): ?><li><span><?= e($sp['label']) ?></span><span><?= e($sp['value']) ?></span></li><?php endforeach; ?></ul><a href="<?= e($link) ?>" class="btn <?= $p['is_popular'] ? 'btn-lime' : 'btn-ghost' ?>" target="_blank" rel="noopener"><?= $c('pricing', 'order_text') ?></a></article>
<?php endforeach; ?>
    </div>
    <p class="note"><?= $c('pricing', 'note') ?></p>
  </div>
</section>

<?php if ($on('show_stats_band') && $site['stats']): ?>
<div class="band on-ink">
  <div class="wrap">
<?php foreach ($site['stats'] as $st):
    $countAttr = '';
    if ($st['count_to'] !== null) {
        $num = num_trim($st['count_to']);
        $suffix = trim(str_replace($num, '', (string)$st['value_text']));
        $countAttr = ' data-count="' . e($num) . '"' . ($suffix !== '' ? ' data-suffix="' . e($suffix) . '"' : '');
    } ?>
    <div><div class="v"<?= $countAttr ?>><?= e($st['value_text']) ?></div><div class="l"><?= e($st['label']) ?></div></div>
<?php endforeach; ?>
  </div>
</div>
<?php endif; ?>

<section class="block" id="why">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow"><?= $c('why', 'eyebrow') ?></span>
        <h2 style="margin-top:12px"><?= $c('why', 'title') ?></h2>
      </div>
    </div>
    <div class="why">
<?php foreach ($site['features'] as $f): ?>
      <div class="feat"><span class="k"><?= e($f['key_label']) ?></span><h3><?= e($f['title']) ?></h3><p><?= nl2br_e($f['description']) ?></p></div>
<?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($on('show_network')): ?>
<section class="block" id="network">
  <div class="wrap split">
    <div>
      <span class="eyebrow"><?= $c('network', 'eyebrow') ?></span>
      <h2 style="margin-top:12px"><?= $c('network', 'title') ?></h2>
      <p><?= $c('network', 'lead') ?></p>
      <ul>
<?php foreach (lines($raw('network', 'bullets')) as $b): ?>
        <li><?= e($b) ?></li>
<?php endforeach; ?>
      </ul>
    </div>
    <div class="latency" aria-label="زمن الاستجابة (أرقام توضيحية)">
<?php foreach ($site['network'] as $r): $ms = (int)$r['latency_ms']; ?>
      <div class="row"><span><?= e($r['city']) ?></span><div class="track"><span style="width:<?= min(100, max(0, $ms)) ?>%"></span></div><span class="ms"><?= $ms ?> ms</span></div>
<?php endforeach; ?>
      <span class="cap"><?= $c('network', 'caption') ?></span>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if ($on('show_chips')): ?>
<section class="block">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <span class="eyebrow"><?= $c('chips', 'eyebrow') ?></span>
        <h2 style="margin-top:12px"><?= $c('chips', 'title') ?></h2>
      </div>
    </div>
<?php foreach (['os' => 'os_title', 'panel' => 'panel_title'] as $grp => $titleField): if (!$site['chips'][$grp]) { continue; } ?>
    <div class="chip-group">
      <h3><?= $c('chips', $titleField) ?></h3>
      <div class="chips"><?php foreach ($site['chips'][$grp] as $chip): ?><span><?= e($chip) ?></span><?php endforeach; ?></div>
    </div>
<?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<?php if ($on('show_faq') && $site['faq']): ?>
<section class="block" id="faq">
  <div class="wrap">
    <div class="sec-head"><div><span class="eyebrow"><?= $c('faq', 'eyebrow') ?></span><h2 style="margin-top:12px"><?= $c('faq', 'title') ?></h2></div></div>
    <div class="faq">
<?php foreach ($site['faq'] as $i => $q): ?>
      <details<?= $i === 0 ? ' open' : '' ?>><summary><?= e($q['question']) ?></summary><p><?= nl2br_e($q['answer']) ?></p></details>
<?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="final">
  <div class="wrap">
    <div class="box">
      <div><h2><?= $c('final_cta', 'title') ?></h2><p><?= $c('final_cta', 'lead') ?></p></div>
      <div class="cta"><a href="<?= e(safe_url($raw('final_cta', 'primary_link'))) ?>" class="btn btn-lime"><?= $c('final_cta', 'primary_text') ?></a><a href="<?= e($waUrl) ?>" class="btn btn-ghost" data-contact target="_blank" rel="noopener"><?= $c('final_cta', 'secondary_text') ?></a></div>
    </div>
  </div>
</section>
</main>

<?php public_footer($chrome); ?>
<dialog class="modal" id="leadModal" aria-labelledby="leadTitle">
  <form id="leadForm" class="modal-card" novalidate>
    <div class="modal-head">
      <h2 id="leadTitle">طلب خطة</h2>
      <button type="button" class="icon-btn" data-close aria-label="إغلاق">✕</button>
    </div>
    <div class="modal-summary" id="leadSummary"></div>
    <div class="mf" data-only="contact"><label for="lf-subject">الموضوع <span>(اختياري)</span></label><input id="lf-subject" name="subject" maxlength="160" aria-describedby="lf-subject-err"><p class="mf-err" id="lf-subject-err"></p></div>
    <div class="mf"><label for="lf-name">الاسم الكامل</label><input id="lf-name" name="name" maxlength="80" autocomplete="name" required aria-describedby="lf-name-err"><p class="mf-err" id="lf-name-err"></p></div>
    <div class="mf"><label for="lf-phone">رقم الهاتف</label><input id="lf-phone" name="phone" type="tel" inputmode="tel" dir="ltr" placeholder="07XXXXXXXXX" maxlength="20" autocomplete="tel" aria-describedby="lf-phone-err"><p class="mf-err" id="lf-phone-err"></p></div>
    <div class="mf"><label for="lf-email">البريد الإلكتروني <span>(اختياري)</span></label><input id="lf-email" name="email" type="email" dir="ltr" maxlength="190" autocomplete="email" aria-describedby="lf-email-err"><p class="mf-err" id="lf-email-err"></p></div>
    <div class="mf"><label for="lf-notes" id="lf-notes-label">ملاحظات <span>(اختياري)</span></label><textarea id="lf-notes" name="notes" rows="3" maxlength="2000" aria-describedby="lf-notes-err"></textarea><p class="mf-err" id="lf-notes-err"></p></div>
    <div class="hp" aria-hidden="true"><label>اترك هذا الحقل فارغاً <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <p class="mf-err mf-global" id="lf-global" role="alert"></p>
    <div class="modal-actions">
      <button type="submit" class="btn btn-lime" id="lf-submit"><span class="spinner" aria-hidden="true"></span><span class="lbl">إرسال الطلب</span></button>
      <button type="button" class="btn btn-ghost" data-close>إلغاء</button>
    </div>
  </form>
</dialog>

<script id="site-data" type="application/json"><?= json_encode($siteJs, $jsonFlags) ?></script>
<script src="js/main.js"></script>
<?php if ($showCreative): ?>
<?= creative_request_modal($cr['packages'], $raw('creative_page', 'request_title') ?: 'اطلب عرض سعر', $raw('creative_page', 'request_lead')) ?>
<?= creative_lightbox() ?>
<script id="creative-data" type="application/json"><?= json_encode(creative_js_data($cr, $S, $cr['featured'], $creativeWa, ['success' => 'وصل طلبك، سيتواصل معك فريق الإنتاج قريباً']), $jsonFlags) ?></script>
<script src="js/creative.js" defer></script>
<?php endif; ?>
</body>
</html>
