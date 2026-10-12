(function(){
  "use strict";

  // ===== Site data (injected by index.php as JSON; safe defaults if missing) =====
  var SITE = {};
  try {
    var dataEl = document.getElementById("site-data");
    if (dataEl) SITE = JSON.parse(dataEl.textContent) || {};
  } catch (e) { SITE = {}; }
  var data = SITE.plans || {}; // {categoryKey: [{id, n, s, p, pop, link, spec}]}
  var RATE = +SITE.iqdRate || 1310; // IQD per 1 USD
  var ROUND_TO = +SITE.iqdRoundTo || 250;
  var DISCOUNT = SITE.yearlyDiscount != null ? +SITE.yearlyDiscount : 17;
  var YEARLY_FACTOR = 1 - DISCOUNT / 100;
  var WHATSAPP_NUMBER = String(SITE.whatsapp || "").replace(/\D/g, "");
  var DOMAIN_PRICES = {};
  (SITE.tlds || [{tld:".iq", price:25}, {tld:".com", price:12}, {tld:".net", price:14}, {tld:".org", price:13}])
    .forEach(function(t){ DOMAIN_PRICES[t.tld] = +t.price; });
  var T = SITE.texts || {};
  var TXT = {
    perMonth: T.perMonth || "شهرياً",
    perMonthYearly: T.perMonthYearly || "شهرياً، تُدفع سنوياً",
    order: T.order || "اطلب الآن",
    popular: T.popular || "الأكثر طلباً",
    saveBadge: T.saveBadge || ("وفّر " + DISCOUNT + "%")
  };
  var API = SITE.api || {order: "api/order.php", domain: "api/domain-order.php", contact: "api/contact.php"};

  // ===== Helpers =====
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced(){ return rmq.matches; }
  var hasIO = "IntersectionObserver" in window;
  function easeOut(t){ return 1 - Math.pow(1 - t, 3); }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return "&#" + c.charCodeAt(0) + ";"; }); }
  function store(key, val){
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, String(val));
    } catch (e) { return null; }
  }
  // Animate a number from `from` to `to`, calling draw(value) each frame. Returns a cancel fn.
  function tween(from, to, ms, draw){
    if (reduced() || from === to) { draw(to); return function(){}; }
    var t0 = null, id;
    function step(now){
      if (t0 === null) t0 = now;
      var t = Math.min(1, (now - t0) / ms);
      draw(from + (to - from) * easeOut(t));
      if (t < 1) id = requestAnimationFrame(step);
    }
    id = requestAnimationFrame(step);
    return function(){ cancelAnimationFrame(id); };
  }
  // Run cb once when el enters the viewport (immediately if IO is unavailable).
  function onVisible(el, cb, opts){
    if (!el) return;
    if (!hasIO) { cb(); return; }
    var io = new IntersectionObserver(function(entries){
      if (entries[0].isIntersecting) { io.disconnect(); cb(); }
    }, opts || {threshold: .3});
    io.observe(el);
  }

  // ===== State, currency & formatting =====
  var firstTab = document.querySelector("[role=tab]");
  var state = {tab: firstTab ? firstTab.dataset.tab : "", cyc:"m", cur: SITE.defaultCurrency === "IQD" ? "IQD" : "USD"};
  var savedCur = store("alasas.cur");
  if (savedCur === "USD" || savedCur === "IQD") state.cur = savedCur;

  function toCur(usd){ return state.cur === "IQD" ? Math.round(usd * RATE / ROUND_TO) * ROUND_TO : usd; }
  // Format a (possibly mid-tween) value. `exact` = final target, decides USD decimals.
  function fmtNum(v, exact){
    if (state.cur === "IQD") return (Math.round(v / ROUND_TO) * ROUND_TO).toLocaleString("en-US");
    var dec = exact === undefined ? v : exact;
    return dec % 1 ? v.toFixed(2) : String(Math.round(v));
  }
  function fmtPrice(usd){ var v = toCur(usd); return fmtNum(v, v) + " " + state.cur; }

  // ===== Toasts =====
  var toastBox = $("#toasts");
  function showToast(message){
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    toastBox.appendChild(t);
    while (toastBox.children.length > 3) toastBox.removeChild(toastBox.firstChild);
    setTimeout(function(){
      t.classList.add("out");
      setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, reduced() ? 0 : 260);
    }, 2800);
  }

  // ===== Cart =====
  var cartBtn = $("#cartBtn"), cartCount = $("#cartCount");
  var cart = parseInt(store("alasas.cart"), 10) || 0;
  function items(n){ return n === 1 ? "عنصر واحد" : n === 2 ? "عنصران" : n <= 10 ? n + " عناصر" : n + " عنصراً"; }
  function drawCart(bump){
    cartCount.textContent = cart;
    cartCount.hidden = cart === 0;
    cartBtn.setAttribute("aria-label", cart ? "السلة: " + items(cart) : "السلة: لا توجد عناصر");
    if (bump && !reduced()) {
      cartCount.classList.remove("bump"); void cartCount.offsetWidth; cartCount.classList.add("bump");
    }
  }
  function addToCart(msg){
    cart++;
    store("alasas.cart", cart);
    drawCart(true);
    showToast(msg);
  }
  cartBtn.addEventListener("click", function(){
    showToast(cart ? "في سلتك " + items(cart) + "، وسيتواصل معك فريقنا لإتمام الطلب" : "سلتك فارغة حالياً");
  });
  drawCart(false);

  // ===== WhatsApp links =====
  if (WHATSAPP_NUMBER) $$("[data-wa]").forEach(function(a){ a.href = "https://wa.me/" + WHATSAPP_NUMBER; });

  // ===== Header, scroll progress & back-to-top =====
  var header = $("header.main"), bar = $("#progressBar"), toTop = $("#toTop"), hero = $(".hero");
  var heroEnd = 0, ticking = false;
  function measure(){ heroEnd = hero.offsetTop + hero.offsetHeight; }
  function onScroll(){
    ticking = false;
    var y = window.pageYOffset, max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
    header.classList.toggle("is-scrolled", y > 24);
    toTop.classList.toggle("show", y > heroEnd);
  }
  window.addEventListener("scroll", function(){
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, {passive:true});
  toTop.addEventListener("click", function(){
    window.scrollTo({top:0, behavior: reduced() ? "auto" : "smooth"});
    $(".brand").focus({preventScroll:true});
  });

  // Scrollspy: highlight the nav link whose section is in view.
  var navLinks = $$("nav.primary a[href^='#']");
  var spyIds = navLinks.map(function(a){ return a.getAttribute("href").slice(1); })
    .filter(function(id, i, arr){ return arr.indexOf(id) === i && document.getElementById(id); });
  if (hasIO) {
    var inView = {};
    var spy = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ inView[e.target.id] = e.isIntersecting; });
      var current = null;
      spyIds.forEach(function(id){ if (!current && inView[id]) current = id; }); // first in document order
      navLinks.forEach(function(a){
        var on = a.getAttribute("href") === "#" + current;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
    }, {rootMargin: "-90px 0px -55% 0px"});
    spyIds.forEach(function(id){ spy.observe(document.getElementById(id)); });
  }

  // ===== Mobile menu =====
  var menuBtn = $("#menuBtn"), nav = $("#nav");
  function setMenu(open, returnFocus){
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.textContent = open ? "✕" : "☰";
    nav.style.height = open ? nav.scrollHeight + "px" : "0px";
    if (!open && returnFocus) menuBtn.focus();
  }
  menuBtn.addEventListener("click", function(){ setMenu(!nav.classList.contains("open")); });
  navLinks.forEach(function(a){ a.addEventListener("click", function(){ if (nav.classList.contains("open")) setMenu(false); }); });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false, true);
  });
  document.addEventListener("click", function(e){
    if (nav.classList.contains("open") && !nav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
  });

  // ===== Reveal on scroll =====
  function setupReveal(){
    var targets = $$(".sec-head, .svc, .plan, .feat, .chips span, .faq details, .split > div, .latency, .final .box, .chip-group h3");
    if (reduced() || !hasIO) return;
    var vh = window.innerHeight;
    // Batch all reads first, then write.
    var below = targets.filter(function(el){ return el.getBoundingClientRect().top > vh * .92; });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        el.classList.add("is-visible");
        // Drop the reveal classes afterwards so hover transitions are not delayed.
        setTimeout(function(){
          el.classList.remove("reveal", "is-visible");
          el.style.transitionDelay = "";
        }, 700 + (parseInt(el.style.transitionDelay, 10) || 0));
      });
    }, {rootMargin: "0px 0px -8% 0px"});
    below.forEach(function(el){
      var sibs = Array.prototype.filter.call(el.parentNode.children, function(c){ return c.classList.contains("reveal"); }).length;
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(sibs, 8) * 60 + "ms";
      io.observe(el);
    });
  }

  // ===== Animated counters (stats band) =====
  var counters = $$("[data-count]");
  function runCounters(){
    counters.forEach(function(el){
      var target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
      var dec = (el.dataset.count.split(".")[1] || "").length;
      tween(0, target, 1400, function(v){ el.textContent = v.toFixed(dec) + suffix; });
    });
  }
  if (counters.length && !reduced()) {
    counters.forEach(function(el){ el.textContent = (0).toFixed((el.dataset.count.split(".")[1] || "").length) + (el.dataset.suffix || ""); });
    onVisible($(".band"), runCounters, {threshold: .4});
  }

  // ===== Hero server-status panel (illustrative live data) =====
  (function(){
    var rack = $(".rack");
    var units = $$("[data-live]").map(function(stat){
      var b = stat.parentNode.querySelector(".bar span");
      return {stat: stat, bar: b, label: stat.dataset.live, v: parseInt(stat.textContent.replace(/\D/g, ""), 10)};
    });
    var timer = null, onScreen = true;
    function draw(u, v){ u.stat.textContent = u.label + " " + Math.round(v) + "%"; }
    function tick(){
      units.forEach(function(u){
        var from = u.v, to = Math.max(8, Math.min(92, from + Math.round(Math.random() * 24 - 12)));
        u.v = to;
        var hot = to > 80;
        u.bar.style.width = to + "%";
        u.bar.classList.toggle("hot", hot);
        u.stat.classList.toggle("hot", hot);
        tween(from, to, 700, function(v){ draw(u, v); });
      });
    }
    function sync(){
      var run = onScreen && !document.hidden;
      if (run && !timer) timer = setInterval(tick, 2000);
      if (!run && timer) { clearInterval(timer); timer = null; }
    }
    if (hasIO) new IntersectionObserver(function(e){ onScreen = e[0].isIntersecting; sync(); }).observe(rack);
    document.addEventListener("visibilitychange", sync);
    sync();
  })();

  // ===== Service cards: tilt (fine pointer only) =====
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".svc").forEach(function(card){
      var raf = 0, px = 0, py = 0;
      function apply(){
        raf = 0;
        if (reduced()) return;
        var r = card.getBoundingClientRect();
        var x = (px - r.left) / r.width - .5, y = (py - r.top) / r.height - .5;
        card.style.transform = "perspective(800px) rotateX(" + (-y * 12).toFixed(2) + "deg) rotateY(" + (x * 12).toFixed(2) + "deg)";
      }
      card.addEventListener("mousemove", function(e){
        px = e.clientX; py = e.clientY;
        card.classList.add("is-tilting");
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener("mouseleave", function(){
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        card.classList.remove("is-tilting");
        card.style.transform = "";
      });
    });
  }

  // ===== Pricing: tabs, cards, price tweening =====
  var plansEl = $("#plans"), tabs = $$("[role=tab]"), tabList = $(".tabs"), ind = $(".tab-ind");
  var cycSwitch = $("#cycSwitch");
  function monthlyUsd(p){ return state.cyc === "y" ? Math.round(p.p * YEARLY_FACTOR * 100) / 100 : p.p; }

  function cardHtml(p, i){
    var cls = 'btn ' + (p.pop ? 'btn-lime' : 'btn-ghost');
    var orderBtn = p.link
      ? '<a href="' + esc(p.link) + '" class="' + cls + '" target="_blank" rel="noopener">' + esc(TXT.order) + '</a>'
      : '<button type="button" class="' + cls + '" data-order="' + i + '">' + esc(TXT.order) + '</button>';
    return '<article class="plan' + (p.pop ? ' pop' : '') + '" data-badge="' + esc(TXT.popular) + '">' +
      '<div><h3>' + esc(p.n) + '</h3><div class="sub">' + esc(p.s) + '</div></div>' +
      '<span class="save-badge" hidden>' + esc(TXT.saveBadge) + '</span>' +
      '<div class="price"><s class="was" hidden></s>' +
      '<div class="amount"><span class="n"></span><span class="cur"></span></div></div>' +
      '<div class="per"></div>' +
      '<ul class="specs">' + p.spec.map(function(s){ return '<li><span>' + esc(s[0]) + '</span><span>' + esc(s[1]) + '</span></li>'; }).join("") + '</ul>' +
      orderBtn + '</article>';
  }

  // Update prices in place; animate the number when `animate` is true.
  function updatePrices(animate){
    var list = data[state.tab] || [], yearly = state.cyc === "y";
    $$(".plan", plansEl).forEach(function(card, i){
      var p = list[i];
      if (!p) return;
      var target = toCur(monthlyUsd(p));
      var n = $(".n", card), was = $(".was", card);
      var prev = parseFloat(card.dataset.v);
      $(".cur", card).textContent = state.cur;
      $(".per", card).textContent = yearly ? TXT.perMonthYearly : TXT.perMonth;
      $(".save-badge", card).hidden = !yearly;
      was.hidden = !yearly;
      was.textContent = yearly ? fmtPrice(p.p) : "";
      if (yearly) was.setAttribute("aria-label", "السعر الشهري الأصلي " + fmtPrice(p.p));
      card.dataset.v = target;
      if (card._cancel) card._cancel();
      if (animate && !isNaN(prev)) card._cancel = tween(prev, target, 500, function(v){ n.textContent = fmtNum(v, target); });
      else n.textContent = fmtNum(target, target);
    });
  }

  var firstRender = true, swapTimer = 0;
  function render(){
    if (!data[state.tab]) return; // no data: keep the server-rendered cards
    var animate = !firstRender && !reduced();
    function build(){
      plansEl.innerHTML = data[state.tab].map(cardHtml).join("");
      updatePrices(false);
      if (animate) {
        $$(".plan", plansEl).forEach(function(c, i){
          c.style.animationDelay = i * 70 + "ms";
          c.classList.add("is-in");
          setTimeout(function(){ c.classList.remove("is-in"); c.style.animationDelay = ""; }, 450 + i * 70);
        });
        setTimeout(function(){ plansEl.style.minHeight = ""; }, 450 + 4 * 70);
      }
    }
    firstRender = false;
    clearTimeout(swapTimer);
    if (!animate) { build(); return; }
    plansEl.style.minHeight = plansEl.offsetHeight + "px"; // keep height stable during the swap
    $$(".plan", plansEl).forEach(function(c){ c.classList.add("is-out"); });
    swapTimer = setTimeout(build, 120);
  }

  function moveIndicator(){
    var sel = tabs.filter(function(t){ return t.getAttribute("aria-selected") === "true"; })[0];
    if (!sel || !ind) return;
    var x = sel.offsetLeft, y = sel.offsetTop, w = sel.offsetWidth, h = sel.offsetHeight; // reads
    ind.style.width = w + "px"; ind.style.height = h + "px"; // writes
    ind.style.transform = "translate(" + x + "px," + y + "px)";
  }
  function selectTab(tab, focus){
    tabs.forEach(function(t){
      var on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) tab.focus();
    plansEl.setAttribute("aria-labelledby", tab.id);
    moveIndicator();
    if (state.tab !== tab.dataset.tab) { state.tab = tab.dataset.tab; render(); }
  }
  tabs.forEach(function(t, i){
    t.addEventListener("click", function(){ selectTab(t); });
    t.addEventListener("keydown", function(e){
      var rtl = getComputedStyle(tabList).direction === "rtl", n = tabs.length, j = null;
      if (e.key === "ArrowLeft") j = rtl ? i + 1 : i - 1;
      else if (e.key === "ArrowRight") j = rtl ? i - 1 : i + 1;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = n - 1;
      if (j === null) return;
      e.preventDefault();
      selectTab(tabs[(j + n) % n], true);
    });
  });
  if (ind) {
    tabList.classList.add("has-ind");
    var rz = 0;
    window.addEventListener("resize", function(){
      if (!rz) rz = requestAnimationFrame(function(){ rz = 0; moveIndicator(); measure(); });
    }, {passive:true});
  }

  cycSwitch.addEventListener("click", function(){
    state.cyc = state.cyc === "y" ? "m" : "y";
    cycSwitch.setAttribute("aria-checked", state.cyc === "y");
    updatePrices(true);
  });
  function drawCurButtons(){
    $$("[data-cur]").forEach(function(x){ x.setAttribute("aria-pressed", x.dataset.cur === state.cur); });
  }
  $$("[data-cur]").forEach(function(b){
    b.addEventListener("click", function(){
      if (state.cur === b.dataset.cur) return;
      state.cur = b.dataset.cur;
      store("alasas.cur", state.cur);
      drawCurButtons();
      updatePrices(true);
      if (lastSearch) drawResults(lastSearch);
    });
  });
  plansEl.addEventListener("click", function(e){
    var b = e.target.closest("[data-order]");
    var p = b && (data[state.tab] || [])[+b.dataset.order];
    if (p) openLead({type: "order", plan: p, opener: b});
  });
  drawCurButtons();
  render();

  // ===== Domain search =====
  var form = $("#domainForm"), input = $("#domainInput"), tldSel = $("#tldSelect");
  var errEl = $("#domainErr"), out = $("#domainResult"), sBtn = $("#domainBtn"), sLbl = $(".lbl", sBtn);
  var lastSearch = null, busy = false;
  function hash(s){ // FNV-1a, deterministic per query
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function validate(name){
    if (!name) return "اكتب اسم النطاق أولاً، مثل: alasas";
    if (!/^[a-z0-9-]+$/.test(name)) return "يُسمح بالأحرف الإنجليزية والأرقام والشرطة (-) فقط.";
    if (name.length < 2 || name.length > 63) return "يجب أن يتراوح طول الاسم بين 2 و63 حرفاً.";
    if (/^-|-$/.test(name)) return "لا يمكن أن يبدأ الاسم أو ينتهي بشرطة.";
    return "";
  }
  function setError(msg){
    errEl.textContent = msg;
    if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }
  function drawResults(q){
    var tlds = Object.keys(DOMAIN_PRICES);
    tlds.sort(function(a, b){ return (b === q.tld) - (a === q.tld); }); // chosen TLD first
    out.innerHTML = '<div class="dres"><h3>نتائج البحث عن <span class="ltr">' + esc(q.name) + '</span></h3>' +
      tlds.map(function(t){
        var dom = q.name + t, free = hash(dom) % 100 < 70;
        return '<div class="drow"><span class="dn">' + esc(dom) + '</span>' +
          '<span class="chip ' + (free ? 'ok">متاح' : 'no">محجوز') + '</span>' +
          '<span class="dp">' + fmtPrice(DOMAIN_PRICES[t]) + ' / سنة</span>' +
          '<button type="button" class="btn btn-ghost" data-domain="' + esc(dom) + '" data-name="' + esc(q.name) + '" data-tld="' + esc(t) + '"' + (free ? '' : ' disabled') + '>أضف للسلة</button></div>';
      }).join("") + '</div><p class="dnote">النتائج توضيحية، ويُربط التحقق الفعلي من التوفر بنظام التسجيل عند الإطلاق</p>';
  }
  form.addEventListener("submit", function(e){
    e.preventDefault();
    if (busy) return;
    var raw = input.value.trim().toLowerCase(), tld = tldSel.value;
    var dot = raw.indexOf("."); // accept "name.com" typed in full
    if (dot > 0 && DOMAIN_PRICES.hasOwnProperty(raw.slice(dot))) { tld = raw.slice(dot); raw = raw.slice(0, dot); tldSel.value = tld; }
    var err = validate(raw);
    setError(err);
    if (err) { input.focus(); return; }
    busy = true;
    sBtn.disabled = true; sBtn.classList.add("is-loading"); sLbl.textContent = "جارٍ البحث";
    out.setAttribute("aria-busy", "true");
    setTimeout(function(){
      busy = false;
      sBtn.disabled = false; sBtn.classList.remove("is-loading"); sLbl.textContent = "بحث";
      out.removeAttribute("aria-busy");
      lastSearch = {name: raw, tld: tld};
      drawResults(lastSearch);
    }, 900);
  });
  input.addEventListener("input", function(){ if (input.hasAttribute("aria-invalid")) setError(""); });
  out.addEventListener("click", function(e){
    var b = e.target.closest("[data-domain]");
    if (b && !b.disabled) openLead({type: "domain", domain: b.dataset.domain, name: b.dataset.name, tld: b.dataset.tld, opener: b});
  });

  // Typewriter placeholder while the field is empty and unfocused.
  (function(){
    if (reduced()) return;
    var words = ["alasas", "mybrand", "store-iq"], w = 0, c = 0, dir = 1, t = 0, stopped = false;
    var base = input.getAttribute("placeholder");
    function step(){
      if (stopped) return;
      var word = words[w];
      c += dir;
      input.setAttribute("placeholder", word.slice(0, c) || "​");
      var delay = dir > 0 ? 110 : 55;
      if (c >= word.length) { dir = -1; delay = 1500; }
      else if (c <= 0) { dir = 1; w = (w + 1) % words.length; delay = 400; }
      t = setTimeout(step, delay);
    }
    function stop(){ stopped = true; clearTimeout(t); input.setAttribute("placeholder", base); }
    function start(){ if (input.value || document.activeElement === input) return; stopped = false; c = 0; dir = 1; clearTimeout(t); t = setTimeout(step, 600); }
    input.addEventListener("focus", stop);
    input.addEventListener("blur", start);
    start();
  })();

  // Hide floating buttons while typing on small screens.
  document.addEventListener("focusin", function(e){ if (e.target.matches("input, select, textarea")) document.body.classList.add("typing"); });
  document.addEventListener("focusout", function(){ document.body.classList.remove("typing"); });

  // ===== Network latency bars =====
  (function(){
    var rows = $$(".latency .row");
    if (!rows.length || reduced()) return;
    var items = rows.map(function(r){
      var s = $(".track span", r), ms = $(".ms", r);
      return {s: s, ms: ms, w: s.style.width, v: parseInt(ms.textContent, 10)};
    });
    items.forEach(function(it){ it.s.style.width = "0"; it.ms.textContent = "0 ms"; });
    onVisible($(".latency"), function(){
      items.forEach(function(it, i){
        setTimeout(function(){
          it.s.style.width = it.w;
          tween(0, it.v, 1100, function(v){ it.ms.textContent = Math.round(v) + " ms"; });
        }, i * 100);
      });
    });
  })();

  // ===== FAQ accordion =====
  (function(){
    var items = $$(".faq details");
    function animate(d, open){
      var sum = $("summary", d);
      if (d._anim) d._anim.cancel();
      if (reduced() || !d.animate) { d.open = open; d.classList.remove("is-closing"); return; }
      var start = d.offsetHeight;
      if (open) d.open = true; else d.classList.add("is-closing");
      var end = open ? d.offsetHeight : sum.offsetHeight + 2; // +2 = top/bottom border
      d._anim = d.animate({height: [start + "px", end + "px"]}, {duration: 260, easing: "cubic-bezier(.2,.7,.2,1)"});
      d._anim.onfinish = function(){
        d._anim = null;
        if (!open) { d.open = false; d.classList.remove("is-closing"); }
      };
    }
    items.forEach(function(d){
      $("summary", d).addEventListener("click", function(e){
        e.preventDefault();
        var opening = !d.open || d.classList.contains("is-closing");
        if (opening) items.forEach(function(o){ if (o !== d && o.open && !o.classList.contains("is-closing")) animate(o, false); });
        animate(d, opening);
      });
    });
  })();

  // ===== Lead modal: plan order, domain request, contact message =====
  var modal = $("#leadModal"), lform = $("#leadForm"), lTitle = $("#leadTitle"), lSum = $("#leadSummary");
  var lSubmit = $("#lf-submit"), lGlobal = $("#lf-global"), lNotesLabel = $("#lf-notes-label");
  var lead = null, sending = false;
  var hasDialog = !!(modal && typeof modal.showModal === "function");
  var LEAD = {
    order: {title: "طلب خطة", submit: "إرسال الطلب", notes: "ملاحظات", toast: "تم استلام طلبك، سنتواصل معك قريباً"},
    domain: {title: "طلب تسجيل نطاق", submit: "إرسال الطلب", notes: "ملاحظات", toast: "تم استلام طلبك، سنتواصل معك قريباً"},
    contact: {title: "تواصل معنا", submit: "إرسال الرسالة", notes: "رسالتك", toast: "تم استلام رسالتك، سنتواصل معك قريباً"}
  };
  function field(name){ return lform.elements[name]; }
  function setFieldError(name, msg){
    var key = name === "message" ? "notes" : name;
    var el = field(key), err = document.getElementById("lf-" + key + "-err");
    if (err) err.textContent = msg || "";
    if (el) { if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
  }
  function clearErrors(){
    ["name", "phone", "email", "notes", "subject"].forEach(function(n){ setFieldError(n, ""); });
    lGlobal.textContent = "";
  }
  function summaryHtml(c){
    if (c.type === "order") {
      var p = c.plan, yearly = state.cyc === "y", m = toCur(monthlyUsd(p));
      var total = yearly ? Math.round(m * 12 * 100) / 100 : m;
      return '<b>' + esc(p.n) + '</b>' + (p.s ? '<span class="muted">' + esc(p.s) + '</span>' : '') +
        '<span>' + (yearly ? 'اشتراك سنوي' : 'اشتراك شهري') + ': <span class="ltr">' + fmtNum(m, m) + ' ' + state.cur + '</span> ' + esc(TXT.perMonth) +
        (yearly ? ' (<span class="ltr">' + fmtNum(total, total) + ' ' + state.cur + '</span> سنوياً)' : '') + '</span>';
    }
    if (c.type === "domain") {
      return '<b class="ltr">' + esc(c.domain) + '</b><span>السعر: <span class="ltr">' + fmtPrice(DOMAIN_PRICES[c.tld] || 0) + '</span> / سنة</span>' +
        '<span class="muted">يُؤكَّد توفر النطاق من فريقنا قبل التسجيل.</span>';
    }
    return "";
  }
  function openLead(c){
    if (!hasDialog) { // very old browsers: fall back to WhatsApp
      if (WHATSAPP_NUMBER) window.open("https://wa.me/" + WHATSAPP_NUMBER, "_blank", "noopener");
      return;
    }
    lead = c;
    var L = LEAD[c.type];
    lTitle.textContent = L.title;
    $(".lbl", lSubmit).textContent = L.submit;
    lNotesLabel.innerHTML = esc(L.notes) + (c.type === "contact" ? "" : " <span>(اختياري)</span>");
    lSum.innerHTML = summaryHtml(c);
    $$("[data-only]", lform).forEach(function(el){ el.hidden = el.dataset.only !== c.type; });
    field("notes").value = "";
    field("subject").value = "";
    clearErrors();
    modal.showModal();
    field("name").focus();
  }
  function closeLead(){
    if (!modal.open) return;
    modal.close();
  }
  if (hasDialog) {
    modal.addEventListener("close", function(){
      if (lead && lead.opener && document.contains(lead.opener)) lead.opener.focus();
    });
    modal.addEventListener("click", function(e){
      if (e.target === modal) closeLead(); // click on the backdrop
      if (e.target.closest("[data-close]")) closeLead();
    });
    // Focus trap (showModal already makes the page inert; this keeps Tab cycling inside the card)
    modal.addEventListener("keydown", function(e){
      if (e.key !== "Tab") return;
      var f = $$("input:not([tabindex='-1']), textarea, button, a[href]", modal).filter(function(el){
        return !el.disabled && el.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$("[data-contact]").forEach(function(a){
      a.addEventListener("click", function(e){ e.preventDefault(); openLead({type: "contact", opener: a}); });
    });
  }
  function validateLead(){
    var ok = true, v = function(n){ return (field(n).value || "").trim(); };
    clearErrors();
    var name = v("name"), phone = v("phone").replace(/[\s\-().]/g, ""), email = v("email"), notes = v("notes");
    if (name.length < 2 || name.length > 80) { setFieldError("name", "اكتب اسمك (من 2 إلى 80 حرفاً)."); ok = false; }
    var phoneOk = /^(?:0|\+964|00964)7\d{9}$/.test(phone);
    if (lead.type === "contact") {
      if (phone && !phoneOk) { setFieldError("phone", "رقم الهاتف غير صالح. اكتبه بالصيغة 07XXXXXXXXX."); ok = false; }
      if (!phone && !email) { setFieldError("phone", "اكتب رقم الهاتف أو البريد الإلكتروني لنتمكن من الرد."); ok = false; }
      if (notes.length < 5) { setFieldError("notes", "اكتب رسالتك (5 أحرف على الأقل)."); ok = false; }
    } else if (!phoneOk) { setFieldError("phone", "رقم الهاتف غير صالح. اكتبه بالصيغة 07XXXXXXXXX أو ‎+9647XXXXXXXXX‎."); ok = false; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError("email", "البريد الإلكتروني غير صالح."); ok = false; }
    if (!ok) { var bad = $("[aria-invalid=true]", lform); if (bad) bad.focus(); }
    return ok;
  }
  function payload(){
    var v = function(n){ return (field(n).value || "").trim(); };
    var base = {name: v("name"), phone: v("phone"), email: v("email"), website: field("website").value};
    if (lead.type === "order") {
      base.plan_id = lead.plan.id; base.cycle = state.cyc === "y" ? "yearly" : "monthly"; base.currency = state.cur; base.notes = v("notes");
    } else if (lead.type === "domain") {
      base.domain = lead.name; base.tld = lead.tld; base.currency = state.cur; base.notes = v("notes");
    } else {
      base.subject = v("subject"); base.message = v("notes");
    }
    return base;
  }
  function setSending(on){
    sending = on;
    lSubmit.disabled = on;
    lSubmit.classList.toggle("is-loading", on);
  }
  if (lform) lform.addEventListener("submit", function(e){
    e.preventDefault();
    if (sending || !lead || !validateLead()) return;
    setSending(true);
    var type = lead.type;
    fetch(API[type === "order" ? "order" : type], {
      method: "POST",
      headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify(payload()),
      credentials: "same-origin"
    }).then(function(r){
      return r.json().catch(function(){ return {ok: false, errors: {_: "تعذّر قراءة رد الخادم."}}; });
    }).then(function(res){
      setSending(false);
      if (res && res.ok) {
        closeLead();
        if (type === "contact") showToast(LEAD.contact.toast);
        else addToCart(LEAD[type].toast);
        return;
      }
      var errs = (res && res.errors) || {_: "تعذّر إرسال الطلب، حاول مجدداً."};
      Object.keys(errs).forEach(function(k){
        if (k === "_" || !field(k === "message" ? "notes" : k)) lGlobal.textContent = errs[k];
        else setFieldError(k, errs[k]);
      });
      var bad = $("[aria-invalid=true]", lform); if (bad) bad.focus();
    }).catch(function(){
      setSending(false);
      lGlobal.textContent = "تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.";
    });
  });

  // ===== Init =====
  measure();
  onScroll();
  requestAnimationFrame(moveIndicator);
  setupReveal();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ moveIndicator(); measure(); });
})();
