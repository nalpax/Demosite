/*
 * Mellow Coffee — расчёты и проверки без работы с интерфейсом.
 * Деньги считаются в копейках, только целыми числами.
 */
(function () {
  'use strict';

  var D = window.MellowData;

  function getProduct(id) {
    for (var i = 0; i < D.products.length; i++) {
      if (D.products[i].id === id) return D.products[i];
    }
    return null;
  }

  function sizesOf(product) {
    return product.sizes ? D.sizes[product.sizes] : [];
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function defaultConfig(product) {
    var sizes = sizesOf(product);
    return {
      size: sizes.length ? sizes[0].id : null,
      milk: product.milk ? D.milks[0].id : null,
      extraShot: false,
      syrup: product.syrup ? D.syrups[0].id : null
    };
  }

  // Приводит конфигурацию к допустимой для товара: лишние опции убираются,
  // неизвестные значения заменяются значениями по умолчанию.
  function normalizeConfig(product, cfg) {
    var def = defaultConfig(product);
    cfg = cfg || {};
    var sizes = sizesOf(product);
    return {
      size: sizes.length && findById(sizes, cfg.size) ? cfg.size : def.size,
      milk: product.milk && findById(D.milks, cfg.milk) ? cfg.milk : def.milk,
      extraShot: product.extraShot ? cfg.extraShot === true : false,
      syrup: product.syrup && findById(D.syrups, cfg.syrup) ? cfg.syrup : def.syrup
    };
  }

  function unitPrice(product, cfg) {
    var total = product.price;
    var size = cfg.size ? findById(sizesOf(product), cfg.size) : null;
    var milk = cfg.milk ? findById(D.milks, cfg.milk) : null;
    var syrup = cfg.syrup ? findById(D.syrups, cfg.syrup) : null;
    if (size) total += size.price;
    if (milk) total += milk.price;
    if (syrup) total += syrup.price;
    if (cfg.extraShot) total += D.extraShot.price;
    return total;
  }

  function minPrice(product) {
    return product.price + (sizesOf(product).length ? sizesOf(product)[0].price : 0);
  }

  function hasPriceRange(product) {
    return sizesOf(product).length > 1;
  }

  function lineKey(productId, cfg) {
    return [productId, cfg.size || '-', cfg.milk || '-', cfg.extraShot ? 'shot' : '-', cfg.syrup || '-'].join('|');
  }

  // Читаемый список выбранных опций: ["350 мл", "Овсяное молоко", ...]
  function describeConfig(product, cfg) {
    var out = [];
    var size = cfg.size ? findById(sizesOf(product), cfg.size) : null;
    if (size) out.push(size.label);
    if (cfg.milk) {
      var milk = findById(D.milks, cfg.milk);
      if (milk) out.push(milk.id === 'regular' ? 'Обычное молоко' : milk.label + ' молоко');
    }
    if (cfg.extraShot) out.push('Доп. шот эспрессо');
    if (cfg.syrup && cfg.syrup !== 'none') {
      var syrup = findById(D.syrups, cfg.syrup);
      if (syrup) out.push('Сироп: ' + syrup.label.toLowerCase());
    }
    return out;
  }

  // 24000 → "240 ₽", 24050 → "240,50 ₽". Пробел перед ₽ неразрывный.
  function formatPrice(kopecks) {
    var negative = kopecks < 0;
    var abs = Math.abs(kopecks);
    var rub = Math.floor(abs / 100);
    var kop = abs % 100;
    var rubStr = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var str = rubStr + (kop ? ',' + (kop < 10 ? '0' : '') + kop : '');
    return (negative ? '−' : '') + str + ' ₽';
  }

  function formatSurcharge(kopecks) {
    return kopecks > 0 ? '+' + formatPrice(kopecks) : '';
  }

  function clampQty(n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < 1) return 1;
    return Math.min(n, D.maxQuantity);
  }

  function cartTotals(lines) {
    var count = 0, sum = 0;
    lines.forEach(function (line) {
      var product = getProduct(line.productId);
      if (!product) return;
      count += line.qty;
      sum += unitPrice(product, line.config) * line.qty;
    });
    return { count: count, sum: sum };
  }

  /* ---------- Проверки формы ---------- */

  function normalizeSearch(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[\s-]+/g, ' ').trim();
  }

  function phoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function validateName(value) {
    var v = String(value || '').trim();
    if (!v) return 'Укажите имя: так бариста назовёт заказ.';
    if (v.length < 2) return 'Имя слишком короткое: нужно хотя бы 2 буквы.';
    if (v.length > 40) return 'Имя слишком длинное: не больше 40 символов.';
    if (!/^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё' .-]*$/.test(v)) return 'Используйте буквы, пробел или дефис.';
    return '';
  }

  function validatePhone(value) {
    var digits = phoneDigits(value);
    if (!digits) return 'Укажите телефон.';
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return '';
    if (digits.length === 10 && digits[0] === '9') return '';
    return 'Нужен номер из 11 цифр, например +7 900 000-00-00. Сейчас цифр: ' + digits.length + '.';
  }

  /* ---------- Учебный график ---------- */

  function toMinutes(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m) return NaN;
    var h = +m[1], min = +m[2];
    if (h > 23 || min > 59) return NaN;
    return h * 60 + min;
  }

  function fromMinutes(total) {
    var h = Math.floor(total / 60), m = total % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function scheduleBounds() {
    var s = D.schedule;
    return {
      open: toMinutes(s.open),
      last: toMinutes(s.close) - s.lastOrderBeforeClose
    };
  }

  function nowMinutes(now) {
    return now.getHours() * 60 + now.getMinutes();
  }

  // Можно ли оформить «Как можно скорее» прямо сейчас.
  function isAsapAvailable(now) {
    var b = scheduleBounds();
    var t = nowMinutes(now) + D.schedule.prepMinutes;
    return t >= b.open && t <= b.last;
  }

  // Самое раннее время выбранного дня (в минутах) или null, если день недоступен.
  function earliestSlot(day, now) {
    var b = scheduleBounds();
    var step = D.schedule.stepMinutes;
    if (day === 'tomorrow') return b.open;
    var t = Math.max(b.open, nowMinutes(now) + D.schedule.prepMinutes);
    t = Math.ceil(t / step) * step;
    return t <= b.last ? t : null;
  }

  // Возвращает текст ошибки или ''.
  function validatePickup(pickup, now) {
    var b = scheduleBounds();
    var range = fromMinutes(b.open) + ' до ' + fromMinutes(b.last);
    if (pickup.mode === 'asap') {
      if (isAsapAvailable(now)) return '';
      return 'Сейчас кофейня не принимает заказы по учебному графику. Выберите время на завтра.';
    }
    if (pickup.mode !== 'time') return 'Выберите время получения.';
    if (pickup.day !== 'today' && pickup.day !== 'tomorrow') return 'Выберите день.';
    var t = toMinutes(pickup.time);
    if (isNaN(t)) return 'Укажите время в формате ЧЧ:ММ.';
    if (t < b.open || t > b.last) return 'Это время недоступно. Заказы принимаются с ' + range + ' (учебный график).';
    if (pickup.day === 'today') {
      var earliest = earliestSlot('today', now);
      if (earliest === null) return 'На сегодня свободного времени уже нет. Выберите завтра.';
      if (t < nowMinutes(now) + D.schedule.prepMinutes) {
        return 'Нужно минимум ' + D.schedule.prepMinutes + ' минут на приготовление. Самое раннее время сегодня: ' + fromMinutes(earliest) + '.';
      }
    }
    return '';
  }

  function describePickup(pickup) {
    if (pickup.mode === 'asap') return 'Как можно скорее';
    return (pickup.day === 'tomorrow' ? 'Завтра' : 'Сегодня') + ', ' + pickup.time;
  }

  window.MellowPricing = {
    getProduct: getProduct,
    sizesOf: sizesOf,
    defaultConfig: defaultConfig,
    normalizeConfig: normalizeConfig,
    unitPrice: unitPrice,
    minPrice: minPrice,
    hasPriceRange: hasPriceRange,
    lineKey: lineKey,
    describeConfig: describeConfig,
    formatPrice: formatPrice,
    formatSurcharge: formatSurcharge,
    clampQty: clampQty,
    cartTotals: cartTotals,
    normalizeSearch: normalizeSearch,
    phoneDigits: phoneDigits,
    validateName: validateName,
    validatePhone: validatePhone,
    validatePickup: validatePickup,
    describePickup: describePickup,
    isAsapAvailable: isAsapAvailable,
    earliestSlot: earliestSlot,
    scheduleBounds: scheduleBounds,
    toMinutes: toMinutes,
    fromMinutes: fromMinutes
  };
})();
