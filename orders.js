/*
 * Mellow Coffee — хранение учебных заказов.
 * Сейчас заказ сохраняется только в localStorage этого браузера.
 * Чтобы подключить сервер, замените тело submit() на запрос к API
 * (например, fetch('/api/orders', { method: 'POST', body: JSON.stringify(order) }))
 * и верните из него Promise с ответом сервера в том же формате.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mellow.orders.v1';
  var DEMO_DELAY_MS = 600; // имитация сетевого запроса

  function readAll() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-20)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function makeNumber(list) {
    var next = list.length ? (list[list.length - 1].seq || 0) + 1 : 1;
    return { seq: next, number: 'MC-' + String(next).padStart(3, '0') };
  }

  /*
   * order: { customer: {name, phone, comment}, pickup: {mode, day, time, label},
   *          items: [{name, options, qty, unitPrice, lineTotal}], total }
   * Возвращает Promise<{ number, createdAt, ...order }>.
   */
  function submit(order) {
    return new Promise(function (resolve, reject) {
      window.setTimeout(function () {
        var list = readAll();
        var id = makeNumber(list);
        var saved = Object.assign({}, order, {
          seq: id.seq,
          number: id.number,
          createdAt: new Date().toISOString(),
          demo: true
        });
        list.push(saved);
        if (!writeAll(list)) {
          reject(new Error('Не удалось сохранить учебный заказ в браузере.'));
          return;
        }
        resolve(saved);
      }, DEMO_DELAY_MS);
    });
  }

  window.MellowOrders = {
    submit: submit,
    list: readAll
  };
})();
