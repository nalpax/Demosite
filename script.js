/*
 * Mellow Coffee — работа интерфейса.
 * Данные — data.js, расчёты и проверки — pricing.js, сохранение заказа — orders.js.
 */
(function () {
  'use strict';

  var D = window.MellowData;
  var P = window.MellowPricing;
  var Orders = window.MellowOrders;

  var CART_KEY = 'mellow.cart.v1';
  var DRAFT_KEY = 'mellow.checkout.v1';

  /* ---------- Утилиты ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function storageGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* хранилище недоступно */ }
  }

  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TRANSITION_MS = reducedMotion ? 0 : 230;

  function categoryLabel(id) {
    for (var i = 0; i < D.categories.length; i++) if (D.categories[i].id === id) return D.categories[i].label;
    return '';
  }

  /* ---------- Состояние ---------- */

  var state = {
    category: 'all',
    query: '',
    cart: loadCart(),
    draft: loadDraft(),
    submitting: false,
    modal: null // { product, config, qty }
  };

  function loadCart() {
    var raw = storageGet(CART_KEY, []);
    var map = {};
    var lines = [];
    if (!Array.isArray(raw)) return lines;
    raw.forEach(function (line) {
      if (!line || typeof line !== 'object') return;
      var product = P.getProduct(line.productId);
      if (!product) return;
      var config = P.normalizeConfig(product, line.config);
      var key = P.lineKey(product.id, config);
      var qty = P.clampQty(line.qty);
      if (map[key]) {
        map[key].qty = Math.min(map[key].qty + qty, D.maxQuantity);
      } else {
        map[key] = { key: key, productId: product.id, config: config, qty: qty };
        lines.push(map[key]);
      }
    });
    return lines;
  }

  function saveCart() {
    storageSet(CART_KEY, state.cart.map(function (l) {
      return { productId: l.productId, config: l.config, qty: l.qty };
    }));
  }

  function loadDraft() {
    var d = storageGet(DRAFT_KEY, null) || {};
    return {
      name: typeof d.name === 'string' ? d.name : '',
      phone: typeof d.phone === 'string' ? d.phone : '',
      comment: typeof d.comment === 'string' ? d.comment : '',
      mode: d.mode === 'time' ? 'time' : 'asap',
      day: d.day === 'tomorrow' ? 'tomorrow' : 'today',
      time: typeof d.time === 'string' ? d.time : ''
    };
  }

  function saveDraft() { storageSet(DRAFT_KEY, state.draft); }

  /* ---------- Оверлеи: открытие, фокус, блокировка прокрутки ---------- */

  var openStack = []; // [{ overlay, dialog, trigger }]

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(root) {
    return $all(FOCUSABLE, root).filter(function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
  }

  function lockScroll() {
    var sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sw > 0 ? sw + 'px' : '';
    document.body.classList.add('is-locked');
  }

  function unlockScroll() {
    document.body.classList.remove('is-locked');
    document.body.style.paddingRight = '';
  }

  function openOverlay(overlay, trigger, focusTarget) {
    var dialog = $('[role="dialog"]', overlay);
    if (openStack.some(function (o) { return o.overlay === overlay; })) {
      if (focusTarget) focusTarget.focus();
      return;
    }
    if (!openStack.length) lockScroll();
    openStack.push({ overlay: overlay, dialog: dialog, trigger: trigger || document.activeElement });
    if (overlay._hideTimer) { window.clearTimeout(overlay._hideTimer); overlay._hideTimer = null; }
    overlay.hidden = false;
    // принудительная перерисовка, чтобы сработал переход
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    (focusTarget || dialog).focus({ preventScroll: true });
  }

  function closeOverlay(overlay, opts) {
    var idx = -1;
    openStack.forEach(function (o, i) { if (o.overlay === overlay) idx = i; });
    if (idx === -1) return;
    var entry = openStack.splice(idx, 1)[0];
    overlay.classList.remove('is-open');
    overlay._hideTimer = window.setTimeout(function () {
      overlay.hidden = true;
      overlay._hideTimer = null;
    }, TRANSITION_MS);
    if (!openStack.length) unlockScroll();
    var restore = opts && opts.restoreFocus === false ? null : entry.trigger;
    if (restore && document.contains(restore) && typeof restore.focus === 'function') {
      restore.focus({ preventScroll: true });
    }
    if (overlay === modalOverlay) state.modal = null;
  }

  document.addEventListener('keydown', function (e) {
    if (!openStack.length) return;
    var top = openStack[openStack.length - 1];
    if (e.key === 'Escape') {
      e.preventDefault();
      closeOverlay(top.overlay);
      return;
    }
    if (e.key === 'Tab') {
      var items = focusables(top.dialog);
      if (!items.length) { e.preventDefault(); top.dialog.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      var active = document.activeElement;
      if (!top.dialog.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === top.dialog)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  // Если фокус как-то ушёл за пределы открытого окна — возвращаем его внутрь.
  document.addEventListener('focusin', function (e) {
    if (!openStack.length) return;
    var top = openStack[openStack.length - 1];
    if (!top.dialog.contains(e.target) && !$('#toastRegion').contains(e.target)) {
      top.dialog.focus({ preventScroll: true });
    }
  });

  $all('.overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeOverlay(overlay);
    });
  });

  // Высота видимой области (учитывает экранную клавиатуру на телефоне).
  function syncViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty('--vvh', vv.height + 'px');
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewport);
    syncViewport();
  }

  /* ---------- Уведомления ---------- */

  var toastRegion = $('#toastRegion');

  function toast(text, action) {
    var node = el('div', { class: 'toast' }, [el('p', { class: 'toast__text', text: text })]);
    if (action) {
      node.appendChild(el('button', {
        class: 'toast__btn', type: 'button', text: action.label,
        onclick: function () { removeToast(node); action.run(this); }
      }));
    }
    while (toastRegion.children.length >= 2) toastRegion.removeChild(toastRegion.firstChild);
    toastRegion.appendChild(node);
    node._timer = window.setTimeout(function () { removeToast(node); }, 3800);
  }

  function removeToast(node) {
    if (!node.parentNode) return;
    window.clearTimeout(node._timer);
    node.classList.add('is-leaving');
    window.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, TRANSITION_MS);
  }

  /* ---------- Меню ---------- */

  var chipsRoot = $('#categoryChips');
  var grid = $('#productGrid');
  var searchInput = $('#menuSearch');
  var searchClear = $('#searchClear');
  var emptyBox = $('#menuEmpty');
  var emptyText = $('#menuEmptyText');
  var menuStatus = $('#menuStatus');

  function renderChips() {
    var cats = [{ id: 'all', label: 'Все' }].concat(D.categories);
    chipsRoot.innerHTML = '';
    cats.forEach(function (cat) {
      var count = cat.id === 'all' ? D.products.length : D.products.filter(function (p) { return p.category === cat.id; }).length;
      chipsRoot.appendChild(el('button', {
        class: 'chip', type: 'button', 'data-cat': cat.id,
        'aria-pressed': String(state.category === cat.id),
        onclick: function () { state.category = cat.id; renderChips(); renderMenu(); }
      }, [cat.label, el('span', { class: 'chip__count', 'aria-hidden': 'true', text: String(count) })]));
    });
  }

  function filteredProducts() {
    var q = P.normalizeSearch(state.query);
    return D.products.filter(function (p) {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (!q) return true;
      return P.normalizeSearch(p.name).indexOf(q) !== -1;
    });
  }

  function productCard(p) {
    var range = P.hasPriceRange(p);
    var btn = el('button', {
      class: 'btn btn--primary card__btn', type: 'button', 'data-open': p.id,
      'aria-label': 'Выбрать: ' + p.name + (range ? ', от ' : ', ') + P.formatPrice(P.minPrice(p)).replace(' ', ' ')
    }, ['Выбрать']);
    var card = el('article', { class: 'card', 'data-id': p.id }, [
      el('div', { class: 'card__media' }, [
        el('img', { src: p.image, alt: '', width: '400', height: '320', loading: 'lazy', decoding: 'async' }),
        el('span', { class: 'card__cat', text: categoryLabel(p.category) })
      ]),
      el('div', { class: 'card__body' }, [
        el('h3', { class: 'card__title', text: p.name }),
        el('p', { class: 'card__desc', text: p.description }),
        el('div', { class: 'card__foot' }, [
          el('p', { class: 'card__price' }, [range ? el('small', { text: 'от ' }) : null, P.formatPrice(P.minPrice(p))]),
          btn
        ])
      ])
    ]);
    card.addEventListener('click', function (e) {
      if (e.target.closest('button') && e.target.closest('button') !== btn) return;
      openProduct(p.id, btn);
    });
    return card;
  }

  function renderMenu() {
    var list = filteredProducts();
    grid.innerHTML = '';
    list.forEach(function (p) { grid.appendChild(productCard(p)); });
    var empty = list.length === 0;
    emptyBox.hidden = !empty;
    grid.hidden = empty;
    searchClear.hidden = !state.query;
    if (empty) {
      var where = state.category === 'all' ? '' : ' в разделе «' + categoryLabel(state.category) + '»';
      emptyText.textContent = state.query
        ? 'По запросу «' + state.query.trim() + '»' + where + ' ничего нет. Проверьте написание или сбросьте поиск.'
        : 'В этом разделе пока ничего нет.';
    }
    menuStatus.textContent = empty ? 'Ничего не найдено' : 'Показано позиций: ' + list.length;
  }

  function resetSearch() {
    state.query = '';
    state.category = 'all';
    searchInput.value = '';
    renderChips();
    renderMenu();
    searchInput.focus();
  }

  searchInput.addEventListener('input', function () {
    state.query = searchInput.value;
    renderMenu();
  });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && searchInput.value) { e.preventDefault(); resetSearch(); }
  });
  searchClear.addEventListener('click', resetSearch);
  $('#searchReset').addEventListener('click', resetSearch);

  /* ---------- Окно выбора напитка ---------- */

  var modalOverlay = $('#productModal');
  var modalForm = $('#productForm');
  var modalOptions = $('#modalOptions');
  var modalQty = $('#modalQty');
  var modalTotal = $('#modalTotal');

  function optionGroup(title, name, type, items, selected) {
    var list = el('div', { class: 'opt-list' });
    items.forEach(function (item) {
      var id = 'opt-' + name + '-' + item.id;
      var input = el('input', {
        type: type, name: name, value: item.id, id: id,
        checked: type === 'radio' ? item.id === selected : !!selected
      });
      var box = el('span', { class: 'opt__box' }, [
        el('span', { text: item.label }),
        item.price > 0 ? el('span', { class: 'opt__price', text: P.formatSurcharge(item.price) }) : null
      ]);
      list.appendChild(el('label', { class: 'opt' + (type === 'checkbox' ? ' opt--check' : ''), for: id }, [input, box]));
    });
    return el('fieldset', { class: 'opt-group' }, [el('legend', { class: 'opt-group__legend', text: title }), list]);
  }

  function renderModalOptions() {
    var m = state.modal, p = m.product, cfg = m.config;
    modalOptions.innerHTML = '';
    var sizes = P.sizesOf(p);
    if (sizes.length > 1) modalOptions.appendChild(optionGroup('Объём', 'size', 'radio', sizes, cfg.size));
    if (p.milk) modalOptions.appendChild(optionGroup('Молоко', 'milk', 'radio', D.milks, cfg.milk));
    if (p.extraShot) {
      modalOptions.appendChild(optionGroup('Крепость', 'extraShot', 'checkbox',
        [{ id: 'yes', label: D.extraShot.label, price: D.extraShot.price }], cfg.extraShot));
    }
    if (p.syrup) modalOptions.appendChild(optionGroup('Сироп', 'syrup', 'radio', D.syrups, cfg.syrup));
    if (!modalOptions.children.length) {
      modalOptions.appendChild(el('p', {
        class: 'opt-note',
        text: p.category === 'desserts'
          ? 'Одна порция, без дополнительных опций. Выберите количество.'
          : 'Готовим в одном объёме. Выберите количество.'
      }));
    } else if (sizes.length === 1) {
      modalOptions.insertBefore(el('p', { class: 'opt-note', text: 'Объём: ' + sizes[0].label }), modalOptions.firstChild);
    }
  }

  function readModalConfig() {
    var m = state.modal;
    var f = modalForm;
    var get = function (name) { var c = f.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : null; };
    var shot = f.querySelector('input[name="extraShot"]');
    m.config = P.normalizeConfig(m.product, {
      size: get('size'), milk: get('milk'), syrup: get('syrup'), extraShot: !!(shot && shot.checked)
    });
  }

  function updateModalTotal() {
    var m = state.modal;
    modalQty.textContent = String(m.qty);
    modalTotal.textContent = P.formatPrice(P.unitPrice(m.product, m.config) * m.qty);
    $('[data-qty="-1"]', modalForm).disabled = m.qty <= 1;
    $('[data-qty="1"]', modalForm).disabled = m.qty >= D.maxQuantity;
  }

  function openProduct(id, trigger) {
    var p = P.getProduct(id);
    if (!p) return;
    state.modal = { product: p, config: P.defaultConfig(p), qty: 1 };
    $('#modalTitle').textContent = p.name;
    $('#modalDesc').textContent = p.description;
    var img = $('#modalImage');
    img.src = p.image;
    img.alt = p.name + ', иллюстрация';
    renderModalOptions();
    // картинка для узкого экрана — внутри прокручиваемой области
    var mm = $('.modal__mobile-media', modalForm);
    if (!mm) {
      mm = el('div', { class: 'modal__mobile-media' }, [el('img', { alt: '', width: '400', height: '320' })]);
      $('.modal__body', modalForm).insertBefore(mm, $('#modalTitle'));
    }
    $('img', mm).src = p.image;
    $('.modal__body', modalForm).scrollTop = 0;
    updateModalTotal();
    openOverlay(modalOverlay, trigger, $('.modal', modalOverlay));
  }

  modalForm.addEventListener('change', function () {
    if (!state.modal) return;
    readModalConfig();
    updateModalTotal();
  });

  modalForm.addEventListener('click', function (e) {
    var b = e.target.closest('[data-qty]');
    if (!b || !state.modal) return;
    state.modal.qty = P.clampQty(state.modal.qty + Number(b.getAttribute('data-qty')));
    updateModalTotal();
  });

  modalForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!state.modal) return;
    readModalConfig();
    var m = state.modal;
    var added = addToCart(m.product, m.config, m.qty);
    closeOverlay(modalOverlay);
    var text = added.capped
      ? m.product.name + ': в корзине максимум ' + D.maxQuantity + ' шт. одной позиции'
      : m.product.name + (m.qty > 1 ? ' × ' + m.qty : '') + ' в корзине';
    toast(text, { label: 'Открыть корзину', run: function () { openCart(cartOpenBtn); } });
  });

  /* ---------- Корзина ---------- */

  var cartOverlay = $('#cartDrawer');
  var cartOpenBtn = $('#cartOpen');
  var cartCount = $('#cartCount');
  var cartList = $('#cartList');

  function addToCart(product, config, qty) {
    var key = P.lineKey(product.id, config);
    var line = null;
    state.cart.forEach(function (l) { if (l.key === key) line = l; });
    var capped = false;
    if (line) {
      var next = line.qty + qty;
      capped = next > D.maxQuantity;
      line.qty = Math.min(next, D.maxQuantity);
    } else {
      state.cart.push({ key: key, productId: product.id, config: config, qty: qty });
    }
    saveCart();
    renderCart(true);
    return { capped: capped };
  }

  function setQty(key, qty) {
    state.cart.forEach(function (l) { if (l.key === key) l.qty = P.clampQty(qty); });
    saveCart();
    renderCart();
  }

  function removeLine(key) {
    var line = null;
    state.cart = state.cart.filter(function (l) { if (l.key === key) line = l; return l.key !== key; });
    saveCart();
    renderCart();
    if (line) {
      var p = P.getProduct(line.productId);
      toast((p ? p.name : 'Позиция') + ' удалён из корзины');
    }
  }

  function updateCount(bump) {
    var totals = P.cartTotals(state.cart);
    cartCount.textContent = String(totals.count);
    $('#cartCountText').textContent = 'Товаров в корзине: ' + totals.count;
    cartOpenBtn.setAttribute('aria-label', 'Корзина, товаров: ' + totals.count);
    if (bump && !reducedMotion) {
      cartCount.classList.remove('is-bump');
      void cartCount.offsetWidth;
      cartCount.classList.add('is-bump');
    }
    return totals;
  }

  function cartItem(line) {
    var p = P.getProduct(line.productId);
    var unit = P.unitPrice(p, line.config);
    var opts = P.describeConfig(p, line.config);
    return el('li', { class: 'cart-item', 'data-key': line.key }, [
      el('img', { class: 'cart-item__img', src: p.image, alt: '', width: '72', height: '72' }),
      el('div', { class: 'cart-item__top' }, [
        el('h3', { class: 'cart-item__name', text: p.name }),
        el('span', { class: 'cart-item__sum', text: P.formatPrice(unit * line.qty) })
      ]),
      el('div', {}, [
        opts.length ? el('ul', { class: 'cart-item__opts' }, opts.map(function (o) { return el('li', { text: o }); })) : null,
        el('p', { class: 'cart-item__unit', text: P.formatPrice(unit) + ' за шт.' })
      ]),
      el('div', { class: 'cart-item__ctrl' }, [
        el('div', { class: 'qty qty--sm', role: 'group', 'aria-label': 'Количество: ' + p.name }, [
          el('button', { class: 'qty__btn', type: 'button', 'data-act': 'dec', 'aria-label': 'Уменьшить количество', disabled: line.qty <= 1 }, ['−']),
          el('span', { class: 'qty__value', text: String(line.qty) }),
          el('button', { class: 'qty__btn', type: 'button', 'data-act': 'inc', 'aria-label': 'Увеличить количество', disabled: line.qty >= D.maxQuantity }, ['+'])
        ]),
        el('button', { class: 'link-btn', type: 'button', 'data-act': 'remove', 'aria-label': 'Удалить: ' + p.name }, ['Удалить'])
      ])
    ]);
  }

  function renderCart(bump) {
    var totals = updateCount(bump);
    cartList.innerHTML = '';
    state.cart.forEach(function (line) { cartList.appendChild(cartItem(line)); });
    var empty = state.cart.length === 0;
    $('#cartEmpty').hidden = !empty;
    $('#cartFoot').hidden = empty;
    cartList.hidden = empty;
    $('#cartSum').textContent = P.formatPrice(totals.sum);
    renderSummary($('#summaryList'), $('#summarySum'), state.cart);
  }

  cartList.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var item = btn.closest('.cart-item');
    var key = item.getAttribute('data-key');
    var act = btn.getAttribute('data-act');
    var line = null;
    state.cart.forEach(function (l) { if (l.key === key) line = l; });
    if (!line) return;
    if (act === 'remove') {
      var idx = state.cart.indexOf(line);
      removeLine(key);
      // фокус на соседнюю позицию или на кнопку перехода к меню
      var items = $all('.cart-item', cartList);
      var next = items[Math.min(idx, items.length - 1)];
      (next ? $('[data-act="remove"]', next) : $('#goToMenu')).focus();
      return;
    }
    setQty(key, line.qty + (act === 'inc' ? 1 : -1));
    var again = $('.cart-item[data-key="' + CSS.escape(key) + '"] [data-act="' + act + '"]', cartList);
    if (again && !again.disabled) again.focus();
    else if (again) $('.cart-item[data-key="' + CSS.escape(key) + '"] [data-act="' + (act === 'inc' ? 'dec' : 'inc') + '"]', cartList).focus();
  });

  function renderSummary(listNode, sumNode, lines) {
    listNode.innerHTML = '';
    var sum = 0;
    lines.forEach(function (line) {
      var p = P.getProduct(line.productId);
      if (!p) return;
      var total = P.unitPrice(p, line.config) * line.qty;
      sum += total;
      var opts = P.describeConfig(p, line.config).join(', ');
      listNode.appendChild(el('li', { class: 'summary__item' }, [
        el('span', {}, [p.name + ' × ' + line.qty, opts ? el('small', { text: opts }) : null]),
        el('strong', { text: P.formatPrice(total) })
      ]));
    });
    sumNode.textContent = P.formatPrice(sum);
  }

  /* ---------- Виды панели: корзина / оформление / готово ---------- */

  var views = { cart: $('#viewCart'), checkout: $('#viewCheckout'), done: $('#viewDone') };
  var drawerTitle = $('#drawerTitle');
  var drawerBack = $('#drawerBack');
  var currentView = 'cart';

  function showView(name, focusTarget) {
    currentView = name;
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    drawerTitle.textContent = name === 'cart' ? 'Корзина' : name === 'checkout' ? 'Оформление самовывоза' : 'Учебный заказ';
    drawerBack.hidden = name !== 'checkout';
    var scroller = $('.drawer__scroll', views[name]);
    if (scroller) scroller.scrollTop = 0;
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function openCart(trigger) {
    $all('.toast', toastRegion).forEach(removeToast);
    if (currentView === 'done') showView('cart');
    renderCart();
    openOverlay(cartOverlay, trigger, $('.drawer', cartOverlay));
  }

  cartOpenBtn.addEventListener('click', function () { openCart(cartOpenBtn); });

  function goToMenu() {
    closeOverlay(cartOverlay, { restoreFocus: false });
    var menu = $('#menu');
    menu.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(function () { searchInput.focus({ preventScroll: true }); }, reducedMotion ? 0 : 350);
  }

  $('#goToMenu').addEventListener('click', goToMenu);
  $('#doneClose').addEventListener('click', function () { showView('cart'); goToMenu(); });

  $('#toCheckout').addEventListener('click', function () {
    if (!state.cart.length) return;
    fillCheckout();
    showView('checkout', $('#fName'));
  });
  drawerBack.addEventListener('click', function () {
    collectDraft();
    showView('cart', $('#toCheckout'));
  });

  /* ---------- Оформление ---------- */

  var form = views.checkout;
  var fName = $('#fName'), fPhone = $('#fPhone'), fComment = $('#fComment');
  var fDay = $('#fDay'), fTime = $('#fTime');
  var modeAsap = $('#modeAsap'), modeTime = $('#modeTime');
  var timePick = $('#timePick');
  var confirmBtn = $('#confirmBtn');
  var touched = false;

  var bounds = P.scheduleBounds();
  $('#heroHours').textContent = D.schedule.open + '–' + D.schedule.close;
  $('#schedFrom').textContent = P.fromMinutes(bounds.open);
  $('#schedTo').textContent = P.fromMinutes(bounds.last);
  fTime.min = P.fromMinutes(bounds.open);
  fTime.max = P.fromMinutes(bounds.last);

  function syncPickupUI() {
    var now = new Date();
    var asapOk = P.isAsapAvailable(now);
    modeAsap.disabled = !asapOk;
    var hint = $('#asapHint');
    if (!asapOk) {
      hint.textContent = 'Сейчас по учебному графику заказы не принимаются, поэтому «Как можно скорее» недоступно. Выберите время.';
      if (state.draft.mode === 'asap') state.draft.mode = 'time';
    } else {
      hint.textContent = 'Приготовим примерно за ' + D.schedule.prepMinutes + ' минут.';
    }
    var todayOpt = fDay.querySelector('option[value="today"]');
    var todayEarliest = P.earliestSlot('today', now);
    todayOpt.disabled = todayEarliest === null;
    todayOpt.textContent = todayEarliest === null ? 'Сегодня (уже нет времени)' : 'Сегодня';
    if (todayEarliest === null && state.draft.day === 'today') state.draft.day = 'tomorrow';

    modeAsap.checked = state.draft.mode === 'asap';
    modeTime.checked = state.draft.mode === 'time';
    timePick.hidden = state.draft.mode !== 'time';
    fDay.value = state.draft.day;
    if (state.draft.mode === 'time' && !state.draft.time) {
      var earliest = P.earliestSlot(state.draft.day, now);
      state.draft.time = P.fromMinutes(earliest === null ? bounds.open : earliest);
    }
    fTime.value = state.draft.time;
  }

  function fillCheckout() {
    fName.value = state.draft.name;
    fPhone.value = state.draft.phone;
    fComment.value = state.draft.comment;
    syncPickupUI();
    clearErrors();
    touched = false;
    $('#formErr').textContent = '';
    renderSummary($('#summaryList'), $('#summarySum'), state.cart);
  }

  function collectDraft() {
    state.draft.name = fName.value;
    state.draft.phone = fPhone.value;
    state.draft.comment = fComment.value;
    var mode = form.querySelector('input[name="mode"]:checked');
    state.draft.mode = mode ? mode.value : state.draft.mode;
    state.draft.day = fDay.value;
    state.draft.time = fTime.value;
    saveDraft();
  }

  function setError(input, errNode, msg) {
    errNode.textContent = msg;
    if (input) {
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors() {
    setError(fName, $('#fNameErr'), '');
    setError(fPhone, $('#fPhoneErr'), '');
    setError(fTime, $('#fTimeErr'), '');
  }

  function validateForm() {
    var now = new Date();
    var errors = [];
    var nameErr = P.validateName(fName.value);
    var phoneErr = P.validatePhone(fPhone.value);
    var timeErr = P.validatePickup({ mode: state.draft.mode, day: state.draft.day, time: state.draft.time }, now);
    setError(fName, $('#fNameErr'), nameErr);
    setError(fPhone, $('#fPhoneErr'), phoneErr);
    setError(state.draft.mode === 'time' ? fTime : null, $('#fTimeErr'), timeErr);
    if (!timeErr) fTime.removeAttribute('aria-invalid');
    if (nameErr) errors.push(fName);
    if (phoneErr) errors.push(fPhone);
    if (timeErr) errors.push(state.draft.mode === 'time' ? fTime : (modeTime));
    return errors;
  }

  form.addEventListener('input', function (e) {
    collectDraft();
    if (touched) validateForm();
    if (e.target === fPhone) {
      // мягкая подсказка по количеству цифр
      var n = P.phoneDigits(fPhone.value).length;
      $('#fPhoneHint').textContent = n ? 'Цифр в номере: ' + n + ' из 11.' : '11 цифр, номер нужен только для связи по заказу.';
    }
  });

  form.addEventListener('change', function (e) {
    if (e.target.name === 'mode' || e.target === fDay) {
      collectDraft();
      if (e.target === fDay) state.draft.time = '';
      syncPickupUI();
      collectDraft();
      if (touched) validateForm();
    }
  });

  // До первой попытки отправки ошибки не показываются на blur: иначе текст ошибки
  // сдвигает форму прямо под пальцем, и нажатие попадает не туда.
  fName.addEventListener('blur', function () { if (touched) setError(fName, $('#fNameErr'), P.validateName(fName.value)); });
  fPhone.addEventListener('blur', function () { if (touched) setError(fPhone, $('#fPhoneErr'), P.validatePhone(fPhone.value)); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (state.submitting) return; // защита от повторного нажатия
    collectDraft();
    touched = true;
    var formErr = $('#formErr');
    formErr.textContent = '';
    if (!state.cart.length) {
      formErr.textContent = 'Корзина пуста. Добавьте напиток из меню.';
      return;
    }
    // время проверяется на момент нажатия: оно могло устареть, пока форма была открыта
    var errors = validateForm();
    if (errors.length) {
      errors[0].focus();
      errors[0].scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      return;
    }

    state.submitting = true;
    confirmBtn.disabled = true;
    confirmBtn.setAttribute('aria-busy', 'true');
    confirmBtn.classList.add('is-loading');
    $('.btn__label', confirmBtn).textContent = 'Сохраняем учебный заказ';

    var totals = P.cartTotals(state.cart);
    var order = {
      customer: { name: fName.value.trim(), phone: fPhone.value.trim(), comment: fComment.value.trim() },
      pickup: {
        mode: state.draft.mode,
        day: state.draft.mode === 'time' ? state.draft.day : null,
        time: state.draft.mode === 'time' ? state.draft.time : null,
        label: P.describePickup(state.draft)
      },
      items: state.cart.map(function (l) {
        var p = P.getProduct(l.productId);
        var unit = P.unitPrice(p, l.config);
        return {
          productId: p.id, name: p.name, config: l.config,
          options: P.describeConfig(p, l.config), qty: l.qty, unitPrice: unit, lineTotal: unit * l.qty
        };
      }),
      total: totals.sum
    };

    Orders.submit(order).then(function (saved) {
      showDone(saved);
      state.cart = [];
      saveCart();
      state.draft.comment = '';
      saveDraft();
      renderCart();
    }).catch(function (err) {
      formErr.textContent = (err && err.message) || 'Не удалось сохранить учебный заказ. Попробуйте ещё раз.';
    }).then(function () {
      state.submitting = false;
      confirmBtn.disabled = false;
      confirmBtn.removeAttribute('aria-busy');
      confirmBtn.classList.remove('is-loading');
      $('.btn__label', confirmBtn).textContent = 'Подтвердить учебный заказ';
    });
  });

  function showDone(order) {
    $('#doneNumber').textContent = 'Номер ' + order.number;
    $('#doneTime').textContent = 'Самовывоз: ' + order.pickup.label.toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); });
    var list = $('#doneList');
    list.innerHTML = '';
    order.items.forEach(function (it) {
      list.appendChild(el('li', { class: 'summary__item' }, [
        el('span', {}, [it.name + ' × ' + it.qty, it.options.length ? el('small', { text: it.options.join(', ') }) : null]),
        el('strong', { text: P.formatPrice(it.lineTotal) })
      ]));
    });
    $('#doneSum').textContent = P.formatPrice(order.total);
    showView('done', $('#doneClose'));
  }

  // На телефоне держим активное поле в зоне видимости при открытой клавиатуре.
  cartOverlay.addEventListener('focusin', function (e) {
    if (!e.target.matches('input, select, textarea')) return;
    if (window.innerWidth > 720) return;
    window.setTimeout(function () {
      e.target.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 300);
  });

  /* ---------- Контакты (учебные кнопки) ---------- */

  var contactMessage = $('#contactMessage');
  $all('.js-demo-contact').forEach(function (btn) {
    btn.addEventListener('click', function () {
      contactMessage.hidden = false;
      contactMessage.textContent = '';
      // повторная установка текста, чтобы экранный диктор озвучил сообщение снова
      window.setTimeout(function () {
        contactMessage.textContent = 'Учебный пример: здесь подключается контакт заказчика';
      }, 30);
    });
  });

  /* ---------- Старт ---------- */

  renderChips();
  renderMenu();
  renderCart();

  // Обновлять доступность «Как можно скорее», если форма открыта долго.
  window.setInterval(function () {
    if (!cartOverlay.hidden && currentView === 'checkout') {
      collectDraft();
      syncPickupUI();
    }
  }, 60000);
})();
