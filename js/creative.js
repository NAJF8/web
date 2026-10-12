/* الأساس للإنتاج الإبداعي — نموذج الطلب، نافذة عرض الأعمال، التبويبات، المعرض، والعملة.
   يعمل في الصفحة الرئيسية (مع main.js) وفي صفحة الإنتاج (وحده). Vanilla JS بلا مكتبات. */
(function(){
  "use strict";

  var D = {};
  try { var el = document.getElementById("creative-data"); if (el) D = JSON.parse(el.textContent) || {}; } catch (e) { D = {}; }
  var API = D.api || {request: "api/creative-request.php", portfolio: "api/portfolio.php"};
  var RATE = +D.iqdRate || 1310, ROUND = +D.iqdRoundTo || 250;
  var TXT = D.texts || {};
  var PAGE = document.body.classList.contains("cr-page"); // صفحة الإنتاج (main.js غير محمّل)

  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return "&#" + c.charCodeAt(0) + ";"; }); }
  function store(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch (e) { return null; } }
  function rtl(){ return getComputedStyle(document.documentElement).direction === "rtl"; }

  // ===== Toasts (نفس حاوية الموقع) =====
  var toastBox = $("#toasts");
  function toast(msg){
    if (!toastBox) return;
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    toastBox.appendChild(t);
    while (toastBox.children.length > 3) toastBox.removeChild(toastBox.firstChild);
    setTimeout(function(){ t.classList.add("out"); setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, rmq.matches ? 0 : 260); }, 3200);
  }

  // ===== Currency (يشارك اختيار الصفحة الرئيسية عبر localStorage) =====
  var cur = store("alasas.cur");
  if (cur !== "USD" && cur !== "IQD") cur = D.defaultCurrency === "IQD" ? "IQD" : "USD";
  function toCur(usd){ return cur === "IQD" ? Math.round(usd * RATE / ROUND) * ROUND : usd; }
  function fmt(usd){ var v = toCur(usd); return cur === "IQD" ? v.toLocaleString("en-US") : (v % 1 ? v.toFixed(2) : String(v)); }
  function drawPrices(){
    $$("[data-usd]").forEach(function(n){ n.textContent = fmt(+n.dataset.usd); });
    $$("[data-cur-label]").forEach(function(c){ c.textContent = cur; });
    $$("[data-cur]").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.cur === cur); });
    forms.forEach(function(f){ f._summary && f._summary(); });
  }
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-cur]");
    if (!b) return;
    cur = b.dataset.cur; store("alasas.cur", cur); drawPrices();
  });

  // ===== Page chrome on creative.php (main.js not loaded there) =====
  if (PAGE) (function(){
    var header = $("header.main"), bar = $("#progressBar"), toTop = $("#toTop"), menuBtn = $("#menuBtn"), nav = $("#nav"), ticking = false;
    function onScroll(){
      ticking = false;
      var y = window.pageYOffset, max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
      if (header) header.classList.toggle("is-scrolled", y > 24);
      if (toTop) toTop.classList.toggle("show", y > window.innerHeight);
    }
    window.addEventListener("scroll", function(){ if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, {passive: true});
    onScroll();
    if (toTop) toTop.addEventListener("click", function(){ window.scrollTo({top: 0, behavior: rmq.matches ? "auto" : "smooth"}); var b = $(".brand"); if (b) b.focus({preventScroll: true}); });
    function setMenu(open, focus){
      nav.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); menuBtn.textContent = open ? "✕" : "☰";
      nav.style.height = open ? nav.scrollHeight + "px" : "0px";
      if (!open && focus) menuBtn.focus();
    }
    if (menuBtn && nav) {
      menuBtn.addEventListener("click", function(){ setMenu(!nav.classList.contains("open")); });
      document.addEventListener("keydown", function(e){ if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false, true); });
      $$("a", nav).forEach(function(a){ a.addEventListener("click", function(){ if (nav.classList.contains("open")) setMenu(false); }); });
    }
    var cartBtn = $("#cartBtn"), cartCount = $("#cartCount"), cart = parseInt(store("alasas.cart"), 10) || 0;
    if (cartBtn && cartCount) {
      cartCount.textContent = cart; cartCount.hidden = cart === 0;
      cartBtn.addEventListener("click", function(){ toast(cart ? "في سلتك " + cart + " عناصر، وسيتواصل معك فريقنا لإتمام الطلب" : "سلتك فارغة حالياً"); });
    }
  })();

  // ===== Hero video: only loaded when motion is allowed =====
  var hv = $("[data-hero-video]"), hvBtn = $("[data-hero-toggle]");
  function heroPlay(on){
    if (!hv) return;
    if (on) {
      if (!hv.src) hv.src = hv.dataset.heroVideo;
      var p = hv.play(); if (p && p.catch) p.catch(function(){});
      hv.classList.add("on");
    } else { hv.pause(); }
    if (hvBtn) { hvBtn.hidden = false; hvBtn.setAttribute("aria-pressed", !on); hvBtn.textContent = on ? "إيقاف الفيديو" : "تشغيل الفيديو"; }
  }
  if (hv) {
    hv.removeAttribute("autoplay");
    heroPlay(!rmq.matches);
    if (rmq.addEventListener) rmq.addEventListener("change", function(){ heroPlay(!rmq.matches); });
    if (hvBtn) hvBtn.addEventListener("click", function(){ heroPlay(hv.paused); });
  }

  // ===== Tabs with deep links (#social, #production, #design) =====
  var tabs = $$("[data-cr-tab]");
  function selectTab(key, focus){
    var found = false;
    tabs.forEach(function(t){
      var on = t.dataset.crTab === key;
      found = found || on;
      t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
      if (on && focus) t.focus();
    });
    return found;
  }
  if (tabs.length) {
    $$(".cr-panel").forEach(function(p){ p.removeAttribute("data-inactive"); });
    tabs.forEach(function(t, i){
      t.addEventListener("click", function(){
        selectTab(t.dataset.crTab);
        if (history.replaceState) history.replaceState(null, "", "#" + t.dataset.crTab);
      });
      t.addEventListener("keydown", function(e){
        var n = tabs.length, j = null;
        if (e.key === "ArrowLeft") j = rtl() ? i + 1 : i - 1;
        else if (e.key === "ArrowRight") j = rtl() ? i - 1 : i + 1;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = n - 1;
        if (j === null) return;
        e.preventDefault();
        var t2 = tabs[(j + n) % n];
        selectTab(t2.dataset.crTab, true);
        if (history.replaceState) history.replaceState(null, "", "#" + t2.dataset.crTab);
      });
    });
    var fromHash = function(scroll){
      var key = location.hash.slice(1);
      if (selectTab(key) && scroll) {
        var sec = $("#services-tabs");
        if (sec) sec.scrollIntoView({behavior: rmq.matches ? "auto" : "smooth"});
      }
      return key;
    };
    if (!tabs.some(function(t){ return t.dataset.crTab === fromHash(true); })) selectTab(tabs[0].dataset.crTab);
    window.addEventListener("hashchange", function(){ fromHash(true); });
  }

  // ===== Request forms (modal + inline) =====
  var modal = $("#crModal"), hasDialog = !!(modal && typeof modal.showModal === "function"), opener = null;
  var PKGS = D.packages || [];
  function pkgById(id){ for (var i = 0; i < PKGS.length; i++) if (PKGS[i].id === +id) return PKGS[i]; return null; }
  var forms = $$("form[data-creative-form]");

  forms.forEach(function(form){
    var catSel = form.elements.service_category, pkgSel = form.elements.package_id, summary = $("[data-cr-summary]", form);
    var global = $("[data-cr-global]", form), submit = $('button[type="submit"]', form), sending = false;
    var allOpts = $$("option", pkgSel).map(function(o){ return o.cloneNode(true); });
    function errEl(name){ return document.getElementById(form.id.replace(/-form$/, "") + "-" + name + "-err"); }
    function fieldFor(name){ return name === "attachments" ? form.elements["brief[]"] : (name === "platforms" ? null : form.elements[name]); }
    function setErr(name, msg){
      var e = errEl(name), f = fieldFor(name);
      if (e) e.textContent = msg || "";
      if (f && f.setAttribute) { if (msg) f.setAttribute("aria-invalid", "true"); else f.removeAttribute("aria-invalid"); }
      return !!e;
    }
    function clearErrs(){ $$(".mf-err", form).forEach(function(e){ e.textContent = ""; }); $$("[aria-invalid]", form).forEach(function(f){ f.removeAttribute("aria-invalid"); }); }
    function syncCat(keepPkg){
      var c = catSel.value, keep = keepPkg ? String(keepPkg) : pkgSel.value;
      pkgSel.textContent = "";
      allOpts.forEach(function(o){ if (!o.value || o.dataset.cat === c) pkgSel.appendChild(o.cloneNode(true)); });
      pkgSel.value = $$("option", pkgSel).some(function(o){ return o.value === keep; }) ? keep : "";
      $$("[data-only-cat]", form).forEach(function(x){ x.hidden = x.dataset.onlyCat !== c; });
      form._summary();
    }
    form._summary = function(){
      var p = pkgById(pkgSel.value);
      if (!p) { summary.innerHTML = ""; return; }
      var parts = [];
      if (p.m != null) parts.push('<span><span class="ltr">' + esc(fmt(p.m)) + " " + cur + "</span> شهرياً</span>");
      if (p.o != null) parts.push("<span>" + (p.note ? esc(p.note) + " " : "") + '<span class="ltr">' + esc(fmt(p.o)) + " " + cur + "</span> لمرة واحدة</span>");
      summary.innerHTML = "<b>" + esc(p.name) + "</b>" + parts.join("") + '<span class="muted">' + esc((D.cats || {})[p.cat] || "") + " · السعر النهائي بعد مناقشة التفاصيل</span>";
    };
    form._preset = function(cat, pkg){
      if (cat) catSel.value = cat;
      syncCat(pkg || "");
      clearErrs(); global.textContent = "";
    };
    catSel.addEventListener("change", function(){ syncCat(); });
    pkgSel.addEventListener("change", form._summary);
    syncCat();

    function validate(){
      clearErrs();
      var ok = true, v = function(n){ return (form.elements[n].value || "").trim(); };
      var name = v("name"), phone = v("phone").replace(/[\s\-().]/g, ""), email = v("email"), desc = v("description");
      if (name.length < 2 || name.length > 80) ok = setErr("name", "اكتب اسمك (من 2 إلى 80 حرفاً).") && false;
      if (!/^(?:0|\+964|00964)7\d{9}$/.test(phone)) ok = setErr("phone", "رقم الهاتف غير صالح. اكتبه بالصيغة 07XXXXXXXXX أو ‎+9647XXXXXXXXX‎.") && false;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ok = setErr("email", "البريد الإلكتروني غير صالح.") && false;
      if (desc.length < 10) ok = setErr("description", "اكتب وصفاً لمشروعك (10 أحرف على الأقل).") && false;
      var fi = form.elements["brief[]"], files = fi && fi.files ? Array.prototype.slice.call(fi.files) : [];
      var total = files.reduce(function(s, f){ return s + f.size; }, 0);
      if (files.length > +fi.dataset.maxFiles) ok = setErr("attachments", "يمكن إرفاق " + fi.dataset.maxFiles + " ملفات كحد أقصى.") && false;
      else if (files.some(function(f){ return f.size > +fi.dataset.maxBytes; })) ok = setErr("attachments", "كل ملف يجب ألا يتجاوز 5MB.") && false;
      else if (files.some(function(f){ return !/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type); })) ok = setErr("attachments", "المسموح: PDF وJPG وPNG وWebP فقط.") && false;
      else if (total > +fi.dataset.postMax * 0.95) ok = setErr("attachments", "حجم المرفقات معاً أكبر مما تسمح به الاستضافة. صغّرها أو أرسل روابطها.") && false;
      if (!ok) { var bad = $("[aria-invalid=true]", form); if (bad) bad.focus(); }
      return ok;
    }
    form.addEventListener("submit", function(e){
      e.preventDefault();
      if (sending || !validate()) return;
      sending = true; submit.disabled = true; submit.classList.add("is-loading"); global.textContent = "";
      var fd = new FormData(form);
      fd.append("currency", cur);
      if (form.elements.service_category.value !== "production") fd.delete("preferred_date");
      fetch(API.request, {method: "POST", body: fd, credentials: "same-origin", headers: {"Accept": "application/json"}})
        .then(function(r){ return r.json().catch(function(){ return {ok: false, errors: {_: r.status === 413 ? "حجم المرفقات أكبر من المسموح." : "تعذّر قراءة رد الخادم."}}; }); })
        .then(function(res){
          sending = false; submit.disabled = false; submit.classList.remove("is-loading");
          if (res && res.ok) {
            form.reset(); syncCat();
            if (form.closest("dialog")) form.closest("dialog").close();
            else global.textContent = "";
            toast(TXT.success || "وصل طلبك، سيتواصل معك فريق الإنتاج قريباً");
            return;
          }
          var errs = (res && res.errors) || {_: "تعذّر إرسال الطلب، حاول مجدداً."};
          Object.keys(errs).forEach(function(k){ if (k === "_" || !setErr(k, errs[k])) global.textContent = errs[k]; });
          var bad = $("[aria-invalid=true]", form); if (bad) bad.focus(); else global.focus && global.focus();
        })
        .catch(function(){
          sending = false; submit.disabled = false; submit.classList.remove("is-loading");
          global.textContent = "تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.";
        });
    });
  });

  // فتح النموذج: الأزرار تفتح النافذة؛ روابط #request في صفحة الإنتاج تنتقل للنموذج المضمّن
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-cr-order]");
    if (!b) return;
    var inline = $("#ci-form");
    if (b.tagName === "A" && inline) {
      e.preventDefault();
      inline._preset(b.dataset.cat, b.dataset.pkg);
      $("#request").scrollIntoView({behavior: rmq.matches ? "auto" : "smooth"});
      setTimeout(function(){ inline.elements.name.focus({preventScroll: true}); }, rmq.matches ? 0 : 450);
      return;
    }
    var mform = $("#cm-form");
    if (!hasDialog || !mform) {
      if (D.whatsapp) window.open("https://wa.me/" + D.whatsapp, "_blank", "noopener");
      return;
    }
    e.preventDefault();
    opener = b;
    mform._preset(b.dataset.cat || (location.hash.slice(1) in (D.cats || {}) ? location.hash.slice(1) : ""), b.dataset.pkg);
    modal.showModal();
    (b.dataset.pkg ? mform.elements.name : mform.elements.service_category).focus();
  });
  function trap(dlg, e){
    if (e.key !== "Tab") return;
    var f = $$("input:not([type=hidden]):not([tabindex='-1']), select, textarea, button, a[href], iframe, video", dlg).filter(function(x){ return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (hasDialog) {
    modal.addEventListener("click", function(e){ if (e.target === modal || e.target.closest("[data-close]")) modal.close(); });
    modal.addEventListener("keydown", function(e){ trap(modal, e); });
    modal.addEventListener("close", function(){ if (opener && document.contains(opener)) opener.focus(); });
  }

  // ===== Portfolio items & lightbox =====
  var ITEMS = {};
  (D.items || []).forEach(function(it){ ITEMS[it.id] = it; });
  var lb = $("#lightbox"), lbOk = !!(lb && typeof lb.showModal === "function");
  var stage = lb && $("[data-lb-stage]", lb), cur_ = {list: [], pos: 0, slide: 0, opener: null};
  function slidesOf(it){
    if (it.type === "video_file" && it.video) return [{video: it.video, poster: it.cover}];
    if (it.type === "video_embed" && it.embed) return [{embed: it.embed, poster: it.cover}];
    var g = it.gallery && it.gallery.length ? it.gallery : [{src: it.cover, w: it.w, h: it.h}];
    return g;
  }
  function stopMedia(){ if (!stage) return; $$("video", stage).forEach(function(v){ v.pause(); v.removeAttribute("src"); v.load(); }); stage.textContent = ""; }
  function render(){
    var it = ITEMS[cur_.list[cur_.pos]];
    if (!it) return;
    var slides = slidesOf(it), s = slides[cur_.slide] || slides[0];
    stopMedia();
    if (s.video) {
      var v = document.createElement("video");
      v.controls = true; v.playsInline = true; v.preload = "metadata"; v.poster = s.poster; v.src = s.video;
      v.setAttribute("aria-label", it.title);
      stage.appendChild(v);
    } else if (s.embed) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "lb-poster";
      btn.setAttribute("aria-label", "تشغيل الفيديو: " + it.title);
      btn.innerHTML = '<img src="' + esc(s.poster) + '" alt=""><span class="pf-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>';
      btn.addEventListener("click", function(){
        var f = document.createElement("iframe");
        f.src = s.embed.src; f.title = it.title; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
        f.referrerPolicy = "strict-origin-when-cross-origin";
        stage.textContent = ""; stage.appendChild(f); f.focus();
      });
      stage.appendChild(btn);
    } else {
      var img = document.createElement("img");
      img.src = s.src; img.alt = it.title + (slides.length > 1 ? " — صورة " + (cur_.slide + 1) : "");
      if (s.w) { img.width = s.w; img.height = s.h; }
      stage.appendChild(img);
    }
    $("[data-lb-title]", lb).textContent = it.title;
    $("[data-lb-meta]", lb).textContent = [it.categoryLabel, it.client, it.date].filter(Boolean).join(" · ");
    $("[data-lb-res]", lb).textContent = it.results || "";
    $("[data-lb-desc]", lb).textContent = it.description || "";
    $("[data-lb-tags]", lb).innerHTML = (it.tags || []).map(function(t){ return "<span>#" + esc(t) + "</span>"; }).join("");
    var ext = $("[data-lb-ext]", lb);
    ext.hidden = !it.external; if (it.external) ext.href = it.external;
    var count = slides.length > 1 ? "صورة " + (cur_.slide + 1) + " من " + slides.length + " · " : "";
    $("[data-lb-count]", lb).textContent = count + "عمل " + (cur_.pos + 1) + " من " + cur_.list.length;
    var single = cur_.list.length < 2 && slides.length < 2;
    $("[data-lb-prev]", lb).hidden = single; $("[data-lb-next]", lb).hidden = single;
  }
  function step(d){
    var it = ITEMS[cur_.list[cur_.pos]], n = slidesOf(it).length;
    if (cur_.slide + d >= 0 && cur_.slide + d < n) { cur_.slide += d; }
    else {
      cur_.pos = (cur_.pos + d + cur_.list.length) % cur_.list.length;
      cur_.slide = d > 0 ? 0 : slidesOf(ITEMS[cur_.list[cur_.pos]]).length - 1;
    }
    render();
  }
  function openItem(a){
    var scope = a.closest("[data-pf-list]") || document;
    cur_.list = $$("[data-pf-open]", scope).map(function(x){ return +x.dataset.pfOpen; }).filter(function(id){ return ITEMS[id]; });
    cur_.pos = Math.max(0, cur_.list.indexOf(+a.dataset.pfOpen)); cur_.slide = 0; cur_.opener = a;
    render();
    lb.showModal();
    $("[data-lb-close]", lb).focus();
  }
  if (lbOk) {
    document.addEventListener("click", function(e){
      var a = e.target.closest("[data-pf-open]");
      if (!a || !ITEMS[+a.dataset.pfOpen]) return;
      e.preventDefault(); openItem(a);
    });
    $("[data-lb-close]", lb).addEventListener("click", function(){ lb.close(); });
    // في RTL: «التالي» على اليسار
    $("[data-lb-next]", lb).addEventListener("click", function(){ step(1); });
    $("[data-lb-prev]", lb).addEventListener("click", function(){ step(-1); });
    lb.addEventListener("click", function(e){ if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", function(e){
      if (e.target.tagName === "VIDEO" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return; // تقديم الفيديو
      if (e.key === "ArrowLeft") { e.preventDefault(); step(rtl() ? 1 : -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(rtl() ? -1 : 1); }
      else trap(lb, e);
    });
    var tx = null, ty = null;
    lb.addEventListener("touchstart", function(e){ tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, {passive: true});
    lb.addEventListener("touchend", function(e){
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      tx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step((dx > 0) === rtl() ? 1 : -1);
    });
    lb.addEventListener("close", function(){ stopMedia(); if (cur_.opener && document.contains(cur_.opener)) cur_.opener.focus(); });
  }

  // ===== Gallery filters & load more (creative page) =====
  var grid = $(".pf-gallery[data-pf-list]"), more = $("[data-pf-more]"), empty = $("[data-pf-empty]");
  var filt = {cat: "", tag: "", page: 1, pages: grid ? +grid.dataset.pages || 1 : 1};
  function card(it, i){
    var w = it.w || 600, h = it.h || 450, video = it.type !== "image";
    return '<a class="pf-item is-new" href="' + esc(it.cover) + '" data-pf-open="' + it.id + '" data-index="' + i + '" data-cat="' + esc(it.category) + '">' +
      '<img src="' + esc(it.thumb) + '" alt="' + esc(it.title) + '" width="' + w + '" height="' + h + '" loading="lazy" decoding="async">' +
      (video ? '<span class="pf-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' : "") +
      '<span class="pf-ov"><b>' + esc(it.title) + "</b><span>" + esc(it.categoryLabel + (it.client ? " · " + it.client : "")) + "</span>" +
      (it.results ? "<em>" + esc(it.results) + "</em>" : "") + '</span><span class="sr-only">' + (video ? " — فيديو" : "") + " فتح العرض</span></a>";
  }
  function load(page, replace){
    more.classList.add("is-loading"); more.disabled = true;
    var url = API.portfolio + "?page=" + page + (filt.cat ? "&category=" + encodeURIComponent(filt.cat) : "") + (filt.tag ? "&tag=" + encodeURIComponent(filt.tag) : "");
    return fetch(url, {headers: {"Accept": "application/json"}}).then(function(r){ return r.json(); }).then(function(res){
      more.classList.remove("is-loading"); more.disabled = false;
      if (!res.ok) throw new Error();
      res.items.forEach(function(it){ ITEMS[it.id] = it; });
      var start = replace ? 0 : grid.children.length;
      var html = res.items.map(function(it, k){ return card(it, start + k); }).join("");
      if (replace) grid.innerHTML = html; else grid.insertAdjacentHTML("beforeend", html);
      filt.page = res.page; filt.pages = res.pages;
      more.hidden = res.page >= res.pages;
      empty.hidden = res.total > 0;
      var first = grid.children[start]; if (!replace && first) first.focus({preventScroll: true});
    }).catch(function(){
      more.classList.remove("is-loading"); more.disabled = false;
      toast("تعذّر تحميل الأعمال، حاول مجدداً.");
    });
  }
  if (grid && more) {
    more.addEventListener("click", function(){ load(filt.page + 1, false); });
    $$("[data-pf-filters] .chip-btn").forEach(function(b){
      b.addEventListener("click", function(){
        if (b.hasAttribute("data-filter-cat")) {
          filt.cat = b.dataset.filterCat;
          $$("[data-filter-cat]").forEach(function(x){ x.setAttribute("aria-pressed", x === b); });
        } else {
          var on = b.getAttribute("aria-pressed") !== "true";
          filt.tag = on ? b.dataset.filterTag : "";
          $$("[data-filter-tag]").forEach(function(x){ x.setAttribute("aria-pressed", on && x === b); });
        }
        load(1, true);
      });
    });
  }

  drawPrices();
})();
