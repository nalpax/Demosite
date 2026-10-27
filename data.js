/*
 * Mellow Coffee — данные меню.
 * Учебный пример Vibentry: названия, описания и цены вымышленные.
 * Все суммы хранятся в копейках (целые числа): 24000 = 240 ₽.
 * Чтобы поменять меню, достаточно отредактировать этот файл.
 */
(function () {
  'use strict';

  // Наборы объёмов. price — надбавка к базовой цене товара.
  var SIZES = {
    cup: [
      { id: 's', label: '250 мл', price: 0 },
      { id: 'm', label: '350 мл', price: 4000 },
      { id: 'l', label: '450 мл', price: 8000 }
    ],
    small: [
      { id: 's', label: '180 мл', price: 0 },
      { id: 'm', label: '250 мл', price: 3000 }
    ],
    espresso: [
      { id: 'single', label: '30 мл', price: 0 },
      { id: 'double', label: '60 мл, доппио', price: 6000 }
    ],
    cold: [
      { id: 'm', label: '350 мл', price: 0 },
      { id: 'l', label: '450 мл', price: 5000 }
    ],
    teapot: [
      { id: 'm', label: '500 мл', price: 0 },
      { id: 'l', label: '800 мл', price: 8000 }
    ]
  };

  var MILKS = [
    { id: 'regular', label: 'Обычное', price: 0 },
    { id: 'lactose-free', label: 'Безлактозное', price: 4000 },
    { id: 'oat', label: 'Овсяное', price: 6000 },
    { id: 'almond', label: 'Миндальное', price: 7000 }
  ];

  var SYRUPS = [
    { id: 'none', label: 'Без сиропа', price: 0 },
    { id: 'vanilla', label: 'Ванильный', price: 4000 },
    { id: 'caramel', label: 'Карамельный', price: 4000 },
    { id: 'hazelnut', label: 'Лесной орех', price: 4000 }
  ];

  var EXTRA_SHOT = { label: 'Дополнительный шот эспрессо', price: 6000 };

  var CATEGORIES = [
    { id: 'coffee', label: 'Кофе' },
    { id: 'cold', label: 'Холодные напитки' },
    { id: 'tea', label: 'Чай и матча' },
    { id: 'desserts', label: 'Десерты' }
  ];

  /*
   * Поля товара:
   *  sizes      — ключ из SIZES или null (одна порция);
   *  milk       — можно ли выбрать молоко;
   *  extraShot  — можно ли добавить шот эспрессо;
   *  syrup      — можно ли выбрать сироп.
   */
  var PRODUCTS = [
    {
      id: 'espresso', category: 'coffee', name: 'Эспрессо', price: 15000,
      description: 'Плотный и короткий, с ореховой сладостью и густой пенкой.',
      image: 'assets/photos/espresso.jpg', sizes: 'espresso', milk: false, extraShot: false, syrup: false
    },
    {
      id: 'americano', category: 'coffee', name: 'Американо', price: 18000,
      description: 'Эспрессо с горячей водой. Мягкий вкус для долгой прогулки.',
      image: 'assets/photos/americano.jpg', sizes: 'cup', milk: true, extraShot: true, syrup: true
    },
    {
      id: 'cappuccino', category: 'coffee', name: 'Капучино', price: 22000,
      description: 'Эспрессо и молоко с плотной бархатной пеной.',
      image: 'assets/photos/cappuccino.jpg', sizes: 'cup', milk: true, extraShot: true, syrup: true
    },
    {
      id: 'latte', category: 'coffee', name: 'Латте', price: 24000,
      description: 'Больше молока, лёгкая пена и спокойный кофейный вкус.',
      image: 'assets/photos/latte.jpg', sizes: 'cup', milk: true, extraShot: true, syrup: true
    },
    {
      id: 'flat-white', category: 'coffee', name: 'Флэт уайт', price: 25000,
      description: 'Двойной эспрессо и тонкий слой шелковистого молока.',
      image: 'assets/photos/flat-white.jpg', sizes: 'small', milk: true, extraShot: true, syrup: false
    },
    {
      id: 'raf', category: 'coffee', name: 'Раф', price: 28000,
      description: 'Эспрессо, взбитый со сливками и ванильным сахаром.',
      image: 'assets/photos/raf.jpg', sizes: 'cup', milk: true, extraShot: true, syrup: true
    },
    {
      id: 'iced-latte', category: 'cold', name: 'Айс-латте', price: 26000,
      description: 'Холодное молоко, лёд и эспрессо сверху.',
      image: 'assets/photos/iced-latte.jpg', sizes: 'cold', milk: true, extraShot: true, syrup: true
    },
    {
      id: 'cold-brew', category: 'cold', name: 'Колд-брю', price: 24000,
      description: 'Кофе холодного заваривания: мягкий, с нотами какао.',
      image: 'assets/photos/cold-brew.jpg', sizes: 'cold', milk: false, extraShot: false, syrup: true
    },
    {
      id: 'espresso-tonic', category: 'cold', name: 'Эспрессо-тоник', price: 29000,
      description: 'Тоник, лёд, эспрессо и долька апельсина.',
      image: 'assets/photos/espresso-tonic.jpg', sizes: null, milk: false, extraShot: true, syrup: false
    },
    {
      id: 'matcha-latte', category: 'tea', name: 'Матча-латте', price: 29000,
      description: 'Японский зелёный чай матча, взбитый с тёплым молоком.',
      image: 'assets/photos/matcha-latte.jpg', sizes: 'cup', milk: true, extraShot: false, syrup: true
    },
    {
      id: 'iced-matcha', category: 'tea', name: 'Айс-матча', price: 31000,
      description: 'Матча на холодном молоке со льдом. Свежо и травянисто.',
      image: 'assets/photos/iced-matcha.jpg', sizes: 'cold', milk: true, extraShot: false, syrup: true
    },
    {
      id: 'tea', category: 'tea', name: 'Чай в чайнике', price: 22000,
      description: 'Чёрный или зелёный листовой чай. Сорт подскажут у стойки.',
      image: 'assets/photos/tea.jpg', sizes: 'teapot', milk: false, extraShot: false, syrup: false
    },
    {
      id: 'croissant', category: 'desserts', name: 'Круассан', price: 19000,
      description: 'Слоёный, на сливочном масле, с хрустящей корочкой.',
      image: 'assets/photos/croissant.jpg', sizes: null, milk: false, extraShot: false, syrup: false
    },
    {
      id: 'cheesecake', category: 'desserts', name: 'Чизкейк', price: 32000,
      description: 'Нежный сливочный чизкейк с ягодным соусом.',
      image: 'assets/photos/cheesecake.jpg', sizes: null, milk: false, extraShot: false, syrup: false
    },
    {
      id: 'cookie', category: 'desserts', name: 'Печенье с шоколадом', price: 14000,
      description: 'Мягкое внутри, с кусочками тёмного шоколада.',
      image: 'assets/photos/cookie.jpg', sizes: null, milk: false, extraShot: false, syrup: false
    }
  ];

  // Учебный график для выбора времени самовывоза.
  var SCHEDULE = {
    open: '08:00',
    close: '21:00',
    prepMinutes: 15,          // минимальное время на приготовление
    lastOrderBeforeClose: 15, // последний заказ — за 15 минут до закрытия
    stepMinutes: 15
  };

  // Подборка «С чего начать» на главной (id товаров).
  var FEATURED = ['cappuccino', 'flat-white', 'iced-latte', 'matcha-latte'];

  // Подбор напитка: вкус × температура → товар и короткое пояснение.
  var QUIZ = {
    taste: [
      { id: 'strong', label: 'Покрепче' },
      { id: 'milky', label: 'Мягкий, с молоком' },
      { id: 'sweet', label: 'Сладкий, десертный' },
      { id: 'nocoffee', label: 'Без кофе' }
    ],
    temp: [
      { id: 'hot', label: 'Горячий' },
      { id: 'cold', label: 'Холодный' }
    ],
    result: {
      'strong-hot': { id: 'espresso', why: 'Короткий и плотный. Если хочется ещё крепче, возьмите доппио.' },
      'strong-cold': { id: 'cold-brew', why: 'Холодное заваривание даёт мягкую горчинку и много кофеина.' },
      'milky-hot': { id: 'flat-white', why: 'Двойной эспрессо и тонкий слой молока: кофе чувствуется, но не резко.' },
      'milky-cold': { id: 'iced-latte', why: 'Холодное молоко, лёд и эспрессо сверху. Можно на овсяном.' },
      'sweet-hot': { id: 'raf', why: 'Сливки и ванильный сахар. Самый десертный из горячих.' },
      'sweet-cold': { id: 'iced-latte', why: 'Попросите карамельный или ореховый сироп: получится холодный десерт.' },
      'nocoffee-hot': { id: 'matcha-latte', why: 'Матча с тёплым молоком: бодрит мягче кофе.' },
      'nocoffee-cold': { id: 'iced-matcha', why: 'Травянистый и свежий, со льдом.' }
    }
  };

  window.MellowData = {
    featured: FEATURED,
    quiz: QUIZ,
    categories: CATEGORIES,
    products: PRODUCTS,
    sizes: SIZES,
    milks: MILKS,
    syrups: SYRUPS,
    extraShot: EXTRA_SHOT,
    schedule: SCHEDULE,
    maxQuantity: 20
  };
})();
