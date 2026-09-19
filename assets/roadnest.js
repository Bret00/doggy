(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Drawers (cart + mobile nav) ---------- */
  function setupDrawer(toggleAttr, closeAttr, drawerSelector, focusSelector) {
    var drawer = document.querySelector(drawerSelector);
    if (!drawer) return null;
    var openers = document.querySelectorAll("[" + toggleAttr + "]");
    function open() {
      drawer.hidden = false;
      document.body.style.overflow = "hidden";
      var target = focusSelector ? drawer.querySelector(focusSelector) : drawer;
      if (target) target.focus({ preventScroll: true });
    }
    function close() {
      drawer.hidden = true;
      document.body.style.overflow = "";
    }
    openers.forEach(function (btn) { btn.addEventListener("click", open); });
    drawer.addEventListener("click", function (e) {
      if (e.target.closest("[" + closeAttr + "]")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !drawer.hidden) close();
    });
    return { open: open, close: close, el: drawer };
  }

  var cartDrawer = setupDrawer("data-cart-toggle", "data-cart-close", "[data-cart-drawer]");
  setupDrawer("data-nav-toggle", "data-nav-close", "[data-nav-drawer]");

  /* ---------- Cart (Ajax) ---------- */
  var cartCountEls = document.querySelectorAll("[data-cart-count]");
  var cartAnnounce = document.querySelector("[data-cart-announce]");

  function updateCartCount(count) {
    cartCountEls.forEach(function (el) { el.textContent = count; });
  }

  function refreshCartUI() {
    fetch("/?sections=header")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var html = data.header;
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, "text/html");
        var newBody = doc.querySelector("[data-cart-body]");
        var liveBody = document.querySelector("[data-cart-body]");
        if (newBody && liveBody) liveBody.innerHTML = newBody.innerHTML;
        var newCount = doc.querySelector("[data-cart-count]");
        if (newCount) updateCartCount(newCount.textContent.trim());
      })
      .catch(function () {});
  }

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-product-form]");
    if (!form) return;
    e.preventDefault();
    var button = form.querySelector("[data-add-to-cart]");
    var label = form.querySelector("[data-add-label]");
    var originalLabel = label ? label.textContent : "";
    if (button) button.disabled = true;
    if (label) label.textContent = "Adding…";
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        id: form.querySelector("[data-variant-id]").value,
        quantity: form.querySelector("[data-qty-input]").value
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (item) {
        if (item.status) throw new Error(item.description || "Could not add to bag");
        fetch("/cart.js").then(function (r) { return r.json(); }).then(function (cart) {
          updateCartCount(cart.item_count);
          if (cartAnnounce) cartAnnounce.textContent = cart.item_count + (cart.item_count === 1 ? " item" : " items") + " in your bag.";
        });
        refreshCartUI();
        if (cartDrawer) cartDrawer.open();
      })
      .catch(function (err) {
        if (label) label.textContent = err.message || "Couldn't add to bag";
      })
      .finally(function () {
        if (button) button.disabled = false;
        if (label && originalLabel) setTimeout(function () { label.textContent = originalLabel; }, 1600);
      });
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-cart-qty-change]");
    if (!btn) return;
    var line = btn.getAttribute("data-line");
    var qty = btn.getAttribute("data-qty");
    fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ line: line, quantity: qty })
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) { updateCartCount(cart.item_count); refreshCartUI(); })
      .catch(function () {});
  });

  /* ---------- Quantity stepper (product form) ---------- */
  document.addEventListener("click", function (e) {
    var incr = e.target.closest("[data-qty-increase]");
    var decr = e.target.closest("[data-qty-decrease]");
    if (!incr && !decr) return;
    var scope = e.target.closest("form,section");
    if (!scope) return;
    var output = scope.querySelector("[data-qty-output]");
    var input = scope.querySelector("[data-qty-input]");
    if (!output || !input) return;
    var value = parseInt(input.value, 10) || 1;
    value = incr ? Math.min(10, value + 1) : Math.max(1, value - 1);
    input.value = value;
    output.textContent = value;
  });

  /* ---------- Variant selection ---------- */
  document.querySelectorAll("[data-product-section]").forEach(function (section) {
    var variantsScript = section.querySelector("[data-product-variants]");
    if (!variantsScript) return;
    var variants;
    try { variants = JSON.parse(variantsScript.textContent); } catch (err) { return; }
    var optionGroups = section.querySelectorAll("[data-option-index]");
    var idInput = section.querySelector("[data-variant-id]");
    var priceEl = section.querySelector("[data-price]");
    var comparePriceEl = section.querySelector("[data-compare-price]");
    var addButton = section.querySelector("[data-add-to-cart]");
    var addLabel = section.querySelector("[data-add-label]");

    function formatMoney(cents) {
      return (cents / 100).toLocaleString(undefined, { style: "currency", currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || "CAD" });
    }

    function currentSelection() {
      var selected = [];
      optionGroups.forEach(function (group) {
        var active = group.querySelector(".option-pill.active");
        selected[parseInt(group.getAttribute("data-option-index"), 10)] = active ? active.getAttribute("data-option-value") : null;
      });
      return selected;
    }

    function findVariant(selected) {
      return variants.find(function (v) {
        var opts = [v.option1, v.option2, v.option3];
        return selected.every(function (val, i) { return val == null || opts[i] === val; });
      });
    }

    function applyVariant(variant) {
      if (!variant) return;
      if (idInput) idInput.value = variant.id;
      if (priceEl) priceEl.textContent = formatMoney(variant.price);
      if (comparePriceEl) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          comparePriceEl.hidden = false;
          comparePriceEl.textContent = formatMoney(variant.compare_at_price);
        } else {
          comparePriceEl.hidden = true;
        }
      }
      if (addButton) addButton.disabled = !variant.available;
      if (addLabel) addLabel.textContent = variant.available ? "Add to bag" : "Sold out";
      if (variant.featured_image) {
        var thumbIndex = variant.featured_image.position - 1;
        var thumb = section.querySelector('[data-gallery-thumb="' + thumbIndex + '"]');
        if (thumb) thumb.click();
      }
    }

    section.addEventListener("click", function (e) {
      var pill = e.target.closest("[data-option-select]");
      if (!pill) return;
      var group = pill.closest("[data-option-index]");
      group.querySelectorAll(".option-pill").forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      var valueLabel = group.querySelector("[data-option-value]");
      if (valueLabel) valueLabel.textContent = pill.getAttribute("data-option-value");
      applyVariant(findVariant(currentSelection()));
    });
  });

  /* ---------- Product gallery ---------- */
  document.querySelectorAll(".product-gallery").forEach(function (gallery) {
    var images = Array.prototype.slice.call(gallery.querySelectorAll("[data-gallery-image]"));
    var thumbs = Array.prototype.slice.call(gallery.querySelectorAll("[data-gallery-thumb]"));
    var positionEl = gallery.querySelector("[data-gallery-position]");
    var index = 0;
    function show(i) {
      if (!images.length) return;
      index = (i + images.length) % images.length;
      images.forEach(function (img, n) {
        img.hidden = n !== index;
        // A slide can hold a video. Hiding it doesn't stop playback, so audio would keep
        // running from a slide nobody can see.
        if (n !== index) {
          var vid = img.matches("video") ? img : img.querySelector("video");
          if (vid && !vid.paused) vid.pause();
        }
      });
      thumbs.forEach(function (t, n) { t.classList.toggle("active", n === index); t.setAttribute("aria-pressed", n === index); });
      if (positionEl) {
        var total = images.length;
        positionEl.textContent = (index + 1 < 10 ? "0" : "") + (index + 1) + " / " + (total < 10 ? "0" : "") + total;
      }
    }
    gallery.querySelector("[data-gallery-prev]") && gallery.querySelector("[data-gallery-prev]").addEventListener("click", function () { show(index - 1); });
    gallery.querySelector("[data-gallery-next]") && gallery.querySelector("[data-gallery-next]").addEventListener("click", function () { show(index + 1); });
    thumbs.forEach(function (thumb, n) { thumb.addEventListener("click", function () { show(n); }); });
  });

  /* ---------- Collection sort ---------- */
  // The form still submits normally without this; changing the select just saves a click.
  document.querySelectorAll("[data-sort-form] select").forEach(function (select) {
    select.addEventListener("change", function () { select.form.submit(); });
  });

  /* ---------- Collection filter ---------- */
  document.querySelectorAll("[data-filter-grid]").forEach(function (grid) {
    var scope = grid.closest(".collection-page") || document;
    var wrap = scope.querySelector("[data-filter-wrap]");
    var input = scope.querySelector("[data-filter-input]");
    var countEl = scope.querySelector("[data-filter-count]");
    var emptyEl = scope.querySelector("[data-filter-empty]");
    if (!wrap || !input) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll("[data-filter-name]"));
    var total = cards.length;
    // Only reveal the box once we know it will work — markup ships hidden.
    wrap.hidden = false;

    function apply() {
      var term = input.value.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var hit = !term || card.getAttribute("data-filter-name").toLowerCase().indexOf(term) !== -1;
        card.hidden = !hit;
        if (hit) shown++;
      });
      if (countEl) {
        countEl.textContent = term
          ? shown + " of " + total + " product" + (total === 1 ? "" : "s")
          : total + " product" + (total === 1 ? "" : "s");
      }
      if (emptyEl) emptyEl.hidden = shown !== 0;
    }

    input.addEventListener("input", apply);
    // Escape clears rather than trapping people behind a filter they can't see.
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { input.value = ""; apply(); }
    });
  });

  /* ---------- Header search ---------- */
  (function () {
    var form = document.querySelector("[data-search-form]");
    var openBtn = document.querySelector("[data-search-open]");
    if (!form || !openBtn) return;
    var input = form.querySelector("[data-search-input]");
    var closeBtn = form.querySelector("[data-search-close]");

    function setOpen(open) {
      document.body.classList.toggle("search-open", open);
      openBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && input) input.focus();
    }
    openBtn.addEventListener("click", function () { setOpen(true); });
    closeBtn && closeBtn.addEventListener("click", function () { setOpen(false); });
    form.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    // Don't submit an empty query — /search?q= just renders an empty results page.
    form.addEventListener("submit", function (e) {
      if (input && !input.value.trim()) { e.preventDefault(); input.focus(); }
    });
  })();

  /* ---------- Scroll reveal ---------- */
  if (!reduced.matches && "IntersectionObserver" in window) {
    var revealEls = document.querySelectorAll("[data-reveal]");
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });

    var style = document.createElement("style");
    style.textContent = "[data-reveal]{opacity:0;transform:translateY(38px);transition:opacity .8s ease,transform .8s ease}[data-reveal].is-revealed{opacity:1;transform:translateY(0)}";
    document.head.appendChild(style);

    requestAnimationFrame(function () {
      var heroCopy = document.querySelector(".hero-copy");
      if (heroCopy) {
        var items = heroCopy.children;
        Array.prototype.forEach.call(items, function (el, i) {
          el.style.transition = "opacity .95s cubic-bezier(.16,1,.3,1) " + i * 0.1 + "s, transform .95s cubic-bezier(.16,1,.3,1) " + i * 0.1 + "s";
          el.style.opacity = "0";
          el.style.transform = "translateY(28px)";
          requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }); });
        });
      }
    });
  } else {
    document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("is-revealed"); });
  }

  /* ---------- Lifestyle parallax ---------- */
  var lifestylePhoto = document.querySelector(".lifestyle-photo");
  if (lifestylePhoto && !reduced.matches) {
    var lifestyleSection = lifestylePhoto.closest(".lifestyle");
    var ticking = false;
    function updateParallax() {
      ticking = false;
      var rect = lifestyleSection.getBoundingClientRect();
      var vh = window.innerHeight;
      var progress = 1 - (rect.bottom / (vh + rect.height));
      progress = Math.max(0, Math.min(1, progress));
      lifestylePhoto.style.transform = "translateY(" + (progress * 11 - 5.5) + "%)";
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { requestAnimationFrame(updateParallax); ticking = true; }
    }, { passive: true });
    updateParallax();
  }

  /* ---------- Design story: advances itself ---------- */
  // This section used to be 3.6 screens tall with a pinned panel, so scrolling past it
  // felt like the page had frozen while the chapters advanced. It is a normal-height
  // section now that cycles on a timer; scroll does nothing to it.
  var story = document.querySelector("[data-story]");
  if (story) {
    var chapters = Array.prototype.slice.call(story.querySelectorAll(".story-chapter"));
    var tabs = Array.prototype.slice.call(story.querySelectorAll("[data-story-tab]"));
    var counter = story.querySelector("[data-story-counter]");
    var progressBar = story.querySelector("[data-story-progress]");
    var caption = story.querySelector("[data-story-caption]");
    var captions = chapters.map(function (ch) { return ch.getAttribute("data-caption") || ""; });
    var count = chapters.length || 1;
    var HOLD = 5200; // ms per chapter
    var currentChapter = -1;
    var phaseStart = 0;
    var paused = false;
    var rafId = 0;

    function setChapter(i) {
      if (i === currentChapter) return;
      currentChapter = i;
      chapters.forEach(function (ch, n) {
        var active = n === i;
        ch.classList.toggle("active", active);
        ch.setAttribute("aria-hidden", active ? "false" : "true");
      });
      tabs.forEach(function (tab, n) {
        var active = n === i;
        tab.classList.toggle("active", active);
        if (active) tab.setAttribute("aria-current", "step"); else tab.removeAttribute("aria-current");
      });
      if (counter) counter.innerHTML = "0" + (i + 1) + " <span>/ 0" + count + "</span>";
      if (caption && captions[i]) caption.textContent = captions[i];
      // the 3D scene follows this, so it changes pose with the copy
      story.setAttribute("data-chapter", String(i));
      phaseStart = performance.now();
    }

    function tick(now) {
      rafId = requestAnimationFrame(tick);
      if (paused) { phaseStart = now - 0; return; }
      var elapsed = now - phaseStart;
      var t = Math.min(1, elapsed / HOLD);
      if (progressBar) progressBar.style.transform = "scaleX(" + t + ")";
      story.style.setProperty("--story-progress", String((currentChapter + t) / count));
      if (elapsed >= HOLD) setChapter((currentChapter + 1) % count);
    }

    // Only run while the section is on screen, so it is not burning frames off-screen
    // and visitors do not arrive mid-cycle.
    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        paused = !visible || hovering;
      }, { threshold: 0.12 }).observe(story);
    }

    var hovering = false;
    story.addEventListener("pointerenter", function () { hovering = true; paused = true; });
    story.addEventListener("pointerleave", function () { hovering = false; paused = !visible; });

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { setChapter(i); });
    });

    setChapter(0);
    if (reduced.matches) {
      // no auto-advance for reduced motion; the tabs still work
      if (progressBar) progressBar.style.transform = "scaleX(0)";
    } else {
      phaseStart = performance.now();
      rafId = requestAnimationFrame(tick);
    }
    void rafId;
  }
})();
