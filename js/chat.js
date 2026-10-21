/* =========================================================
   ContentFactory — живой чат и действия в рабочей зоне (прототип)

   1. Отправка:   Enter или кнопка-стрелка — сообщение уходит в открытый чат,
                  помощник «печатает» и отвечает по ключевым словам своей роли.
   2. Варианты ответа внутри сообщений (.chat__messages .chip) отправляются сразу.
   3. Кнопки рабочей зоны без своего действия («Переписать», «Нарисовать
      картинки», «Сравнить поставщиков»…) превращаются в задачу помощнику:
      уходят в чат с названием карточки. На страницах без чата — всплывающее сообщение.
   4. Особые действия: «Отправить» под отзывом, «Подключить», «Загрузить…»
      (выбор файла), «+ Научить новому» (поле ввода), «Не сейчас», «+ Новая задача».
   Ответы — заготовки: это прототип, нейросети за ними нет.
   Подключение: <script src="js/chat.js"></script> после js/workspace.js.
   ========================================================= */

(function () {
  var page = document.body.getAttribute("data-page");
  var toast = window.cfToast || function () {};

  // ---------- Типографика вставляемых текстов ----------
  // неразрывный пробел после коротких слов, перед тире и между числом и единицей
  function typo(text) {
    var short = /(^|[\s(«„])(в|и|к|с|о|у|а|я|на|не|по|за|из|до|от|об|во|со|ко|для|что|как|мы|вы|он|но|ни|без|при|про)\s/gi;
    for (var i = 0; i < 2; i++) text = text.replace(short, "$1$2 ");
    return text
      .replace(/\s—/g, " —")
      .replace(/(\d)\s(?=(₽|%|мин|минут|шт|ч\b|дн))/g, "$1 ")
      .replace(/(\d)\s(\d{3})/g, "$1 $2");
  }
  function esc(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function now() {
    var d = new Date();
    return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ---------- Ответы помощников ----------
  // k — ключевые слова (регулярное выражение), a — ответ, c — варианты ответа,
  // t — тема для строчки-пересказа над новым фрагментом переписки
  var REPLIES = {
    marketer: [
      { k: /коротк/, t: "Тексты покороче.", a: "Сократила тексты примерно на треть — суть и приглашение зайти остались. Если где-то стало суховато, верну прежний вариант." },
      { k: /переписа/, t: "Новый вариант поста.", a: "Переписала: сделала теплее и добавила конкретики про «Зерно». Прежний вариант сохранила — его можно вернуть в один клик.", c: ["Так лучше", "Верни как было"] },
      { k: /картинк|льв|лев/, t: "Картинки к постам.", a: "Передаю Льву — он нарисует картинки в стиле кофейни. Пока он рисует, можно одобрить остальные тексты.", c: ["Одобрить все тексты", "Что ещё осталось?"] },
      { k: /веранд/, t: "Веранда в постах.", a: "Добавила веранду в два поста: пледы, вечерний свет и раф с собой. Сделать отдельный пост к открытию 14 ноября?", c: ["Да, сделай", "Пока не надо"] },
      { k: /весел|тон|серьёзн/, t: "Тон постов.", a: "Сделала тон легче: меньше официальности, пара шуток про осень. Если перебор — скажите «серьёзнее»." },
      { k: /призыв|зайти/, t: "Призыв в постах.", a: "Добавила в конец каждого поста приглашение: «Заходите — первый раф для вас со скидкой 20%». Скидку можно поменять." },
      { k: /допиш|оставш|оста/, t: "Оставшиеся посты.", a: "Дописываю оставшиеся 4 поста — это пара минут. Пока можно посмотреть готовые справа." },
      { k: /одобр|лучше|нравится/, t: "Одобрение текстов.", a: "Отлично, отметила как одобренные. Как только наберётся три, Лев начнёт рисовать к ним картинки." },
      { k: /идею|перв|втор|смеша|тёпл|плед|назов/, t: "Выбор идеи.", a: "Хороший выбор! К вечеру подготовлю три поста для серии, а картинки попрошу у Льва." },
      { k: /гост.*выбер|выберут/, t: "Что выберут гости.", a: "Судя по прошлым постам, гости активнее всего откликаются на уют и скидки. Ставлю на «Самое тёплое место во дворе»." },
      { k: /праздник|хэллоуин|тыкв/, t: "Пост к празднику.", a: "Ближайший повод — Хэллоуин 31 октября. Предлагаю тыквенную неделю: пост, сторис и скидка на тыквенный раф. Начнём?", c: ["Давай", "Другой повод"] },
      { k: /конкурент/, t: "Анализ конкурентов.", a: "Посмотрю три соседние кофейни: что публикуют, как часто и что лучше заходит гостям. Выводы принесу завтра утром." },
      { k: /слоган/, t: "Слоган.", a: "Три варианта: «Зерно — тепло в каждой чашке», «Кофе, ради которого стоит выйти из дома», «Ваш утренний повод». Какой ближе?", c: ["Первый", "Второй", "Третий"] },
      { k: /аудитор/, t: "Портрет аудитории.", a: "Ваши гости — в основном жители района 25–40 лет: заходят утром по пути на работу и в выходные с друзьями. Опишу подробнее справа." },
      { k: /акци|вторник|тих/, t: "Акция на тихий день.", a: "Вторник у вас самый тихий. Предлагаю «Вторник с другом»: второй кофе за полцены. Подготовить пост?", c: ["Да", "Другая идея"] },
      { k: /комментар/, t: "Ответ на комментарий.", a: "Пришлите комментарий или скажите, под каким постом, — предложу ответ в вашем тоне." },
      { k: /не знаю|решите|предлож|сама/, t: "Предложение Эльвиры.", a: "Тогда начнём с простого: три поста в неделю — про меню, команду и атмосферу. Не понравится — поменяем." }
    ],
    designer: [
      { k: /светл/, t: "Светлее.", a: "Сделаю светлее и добавлю утреннего света. Обновлю варианты через пару минут — прежние останутся в истории." },
      { k: /сторис/, t: "Формат для сторис.", a: "Подготовлю формат 9:16: переложу композицию, чтобы напиток не обрезался." },
      { k: /логотип/, t: "Логотип на картинке.", a: "Добавлю логотип «Зерна» в правый нижний угол — аккуратно, чтобы не спорил с картинкой." },
      { k: /вариант|ещё/, t: "Новые варианты.", a: "Нарисую ещё три варианта в том же стиле. Если какой-то понравится частично — отметьте место прямо на картинке." },
      { k: /ракурс/, t: "Другой ракурс.", a: "Попробую вид сверху и чуть сбоку — так лучше видно пенку и узор." },
      { k: /люд/, t: "Люди на картинках.", a: "Понял. Учту в этой задаче и запомню для следующих." },
      { k: /тёпл|уют|минимал/, t: "Стиль картинок.", a: "Принял стиль. Нарисую варианты — это 3–4 минуты, значок на аватаре подскажет, когда будет готово." },
      { k: /прошл/, t: "Как в прошлый раз.", a: "Возьму стиль сентябрьских картинок: тёплый свет, крупный план, осенние цвета." },
      { k: /нарисова/, t: "Рисуем картинки.", a: "Начинаю рисовать. Обычно это 3–4 минуты — пока можно ответить на мой вопрос справа." },
      { k: /нравится|дальше/, t: "Обложка готова.", a: "Фиксирую обложку. Дальше подготовлю форматы: для меню, сторис и поста." },
      { k: /баннер|веранд|меню/, t: "Новая картинка.", a: "Нарисую в стиле кофейни: тёплый свет, осенние цвета. Какой размер нужен — для печати или для соцсетей?", c: ["Для печати", "Для соцсетей"] }
    ],
    financier: [
      { k: /поставщ/, t: "Сравнение поставщиков.", a: "Нашла трёх поставщиков молока рядом с вами: цены на 9–14% ниже текущего. Сравнение пришлю сюда через пару минут." },
      { k: /план|перв.*очеред/, t: "План экономии.", a: "Составила план на ноябрь: три шага, которые сэкономят около 18 000 ₽ в месяц. Первый — сменить поставщика молока.", c: ["Покажи все шаги", "Начнём с первого"] },
      { k: /проще|объясни/, t: "Простыми словами.", a: "Если совсем просто: в сентябре вы заработали на 12% больше, но молоко и аренда съели почти всю разницу." },
      { k: /какие|показ/, t: "Что подорожало.", a: "Это молоко, сиропы и одноразовые стаканы — вместе они выросли на 11 400 ₽ за месяц." },
      { k: /усн|патент|налог/, t: "Налоги.", a: "Посчитаю налог за 3 квартал. Заплатить нужно до 28 октября — напомню за три дня." },
      { k: /сэконом/, t: "Где сэкономить.", a: "Больше всего можно сэкономить на молоке и стаканах — около 9 000 ₽ в месяц без потери качества." },
      { k: /выписк|загруз/, t: "Выписка.", a: "Загрузите выписку из банка в Excel или 1С — я сама разберу, что куда ушло." },
      { k: /заработ/, t: "Сколько заработали.", a: "За сентябрь чистыми около 186 000 ₽ — на 9% больше, чем в августе." },
      { k: /прогноз/, t: "Прогноз на ноябрь.", a: "Если ничего не менять, в ноябре выйдет около 175 000 ₽: тише из-за холодов, но веранда может это перекрыть." },
      { k: /возьми|найди/, t: "Данные для расчёта.", a: "Хорошо, беру данные из выписки. Результат будет справа через минуту." }
    ],
    clients: [
      { k: /мягче|теплее/, t: "Тон ответа.", a: "Сделала ответ мягче: начала с извинения и пригласила зайти снова. Посмотрите справа." },
      { k: /компенсац/, t: "Компенсация.", a: "Добавила в ответ: «В следующий раз кофе за наш счёт — просто покажите этот ответ бариста». Так можно?" },
      { k: /без компенсац/, t: "Без компенсации.", a: "Убрала компенсацию, оставила извинение и объяснение." },
      { k: /как есть|отправ|на все/, t: "Ответы отправлены.", a: "Отправила. Яндекс Карты и 2ГИС обновят ответы в течение часа." },
      { k: /хвал/, t: "Что хвалят гости.", a: "Чаще всего хвалят сырники, бариста Аню и веранду. Сырники — уже трижды за неделю." },
      { k: /жалу/, t: "На что жалуются.", a: "Главная жалоба — ожидание в субботу утром. Предложу Тимуру поставить второго бариста на это время." },
      { k: /акци|постоянн/, t: "Акция для постоянных.", a: "Предлагаю «Сырники в подарок к каждому пятому визиту». Подготовить текст для гостей?", c: ["Да", "Другая идея"] },
      { k: /2гис/, t: "Подключение 2ГИС.", a: "Чтобы подключить 2ГИС, нужно один раз войти в кабинет компании. Дам ссылку и подскажу по шагам." },
      { k: /короче/, t: "Короче.", a: "Сократила ответ до трёх предложений — главное сохранила." },
      { k: /отзыв/, t: "Свежие отзывы.", a: "Собрала свежие отзывы с Яндекс Карт и 2ГИС — два ждут ответа, черновики уже справа." },
      { k: /опрос/, t: "Опрос гостей.", a: "Предлагаю короткий опрос из трёх вопросов: что заказываете чаще, чего не хватает в меню и удобно ли время работы. Разместить QR-код у кассы?", c: ["Да", "Добавь вопрос"] }
    ],
    assistant: [
      { k: /сегодня|весь день|день/, t: "План на сегодня.", a: "Сегодня три дела: ответить на жалобу в 2ГИС, одобрить два поста и выбрать идею для веранды. Начнём с жалобы — это 2 минуты.", c: ["Начнём с жалобы", "Перенеси на завтра"] },
      { k: /завтра|перенес/, t: "Перенос дел.", a: "Перенёс всё на завтра, кроме жалобы — на неё лучше ответить сегодня, пока гость ждёт." },
      { k: /выходн|воскрес|давай/, t: "Свободное воскресенье.", a: "Разложил дела: посты на выходные будут готовы в пятницу, отзывы Вера проверит в субботу. Воскресенье свободно." },
      { k: /проект/, t: "Новый проект.", a: "Опишите в двух словах, что хотите сделать, — я сам позову нужных помощников и соберу план." },
      { k: /кто чем|занят/, t: "Кто чем занят.", a: "Эльвира дописывает посты, Лев рисует креативы для веранды, Ольга ждёт выписку за октябрь, у Веры два отзыва на ответ." },
      { k: /жалоб/, t: "Жалоба в 2ГИС.", a: "Открываю жалобу у Веры — она уже подготовила черновик ответа." },
      { k: /напомни/, t: "Напоминание.", a: "Хорошо, напомню завтра в 10:00." }
    ]
  };

  var FALLBACK = {
    marketer: ["Поняла, беру в работу. Как будет готово — покажу справа и напишу здесь.", "Хорошо! Уточню одну деталь: это для ВКонтакте, Telegram или для обоих?"],
    designer: ["Понял, беру в работу. Как будет готово — значок на аватаре подскажет.", "Принял. Если покажете пример, который нравится, попаду точнее."],
    financier: ["Поняла, считаю. Результат покажу справа и коротко напишу здесь.", "Хорошо. Если нужно, возьму данные из последней выписки сама."],
    clients: ["Поняла, займусь. Черновик ответа покажу справа — отправим, когда одобрите.", "Хорошо, учту это в ответах гостям."],
    assistant: ["Понял, добавлю в план и напомню вовремя.", "Хорошо. Если для этого нужен кто-то из помощников, я сам его позову."]
  };
  FALLBACK.hr = ["Поняла, займусь. Кандидатов покажу справа — с оценкой, насколько подходят.", "Хорошо. Если есть требования, которые я не учла, — напишите, поправлю отбор."];
  var FALLBACK_CHIPS = { marketer: [null, ["Для обоих", "Только ВКонтакте", "Только Telegram"]] };
  var fallbackIndex = 0;

  // Кейс клиента (cases/<id>/data.js): свои ответы помощников вместо ответов кофейни
  var CASE = window.CF_CASE;
  var ROOT = window.CF_ROOT || "";
  if (CASE) {
    REPLIES = {};
    Object.keys(CASE.replies || {}).forEach(function (id) {
      REPLIES[id] = CASE.replies[id].map(function (r) { return { k: new RegExp(r.k, "i"), a: r.a, c: r.c, t: r.t }; });
    });
    FALLBACK_CHIPS = {};
  }

  // Короткие «да» и «нет» в ответ на предложение помощника
  var YES = /^(давай|да\b|да,|начн|первый|второй|третий|так лучше|так и сделай|ок\b|хорошо)/;
  var NO = /^(нет|не надо|пока не|другой|другая|верни)/;
  var CONFIRM = {
    marketer: "Отлично, начинаю! Черновик появится справа через пару минут — я напишу, когда будет готово.",
    designer: "Принял, начинаю рисовать. Значок на аватаре подскажет, когда будет готово.",
    financier: "Хорошо, считаю. Результат будет справа через минуту.",
    clients: "Готово, делаю. Черновик покажу справа — отправим, когда одобрите.",
    assistant: "Договорились, добавил в план и напомню вовремя.",
    hr: "Договорились, займусь. Напишу, как только будут результаты."
  };
  var DECLINE = {
    marketer: "Хорошо, оставим как есть. Если передумаете — я рядом.",
    designer: "Понял, оставляю как было.",
    financier: "Хорошо, не трогаю.",
    clients: "Хорошо, оставлю как есть.",
    assistant: "Хорошо, не буду.",
    hr: "Хорошо, оставлю как есть."
  };

  function pickReply(text) {
    var rules = REPLIES[page] || [];
    var low = text.toLowerCase().replace(/ё/g, "е");
    if (YES.test(low) && low.length < 30) return { a: CONFIRM[page] || "Принято!", t: "Договорились." };
    if (NO.test(low) && low.length < 30) return { a: DECLINE[page] || "Хорошо.", t: "Решили не менять." };
    for (var i = 0; i < rules.length; i++) {
      var re = new RegExp(rules[i].k.source.replace(/ё/g, "е"), "i");
      if (re.test(low)) return rules[i];
    }
    var list = FALLBACK[page] || ["Принято, беру в работу."];
    var n = fallbackIndex++ % list.length;
    return { a: list[n], c: (FALLBACK_CHIPS[page] || [])[n], t: "Продолжаем разговор." };
  }

  // ---------- Упоминания других помощников ----------
  // Имя (в любом падеже) становится ссылкой с маленькой аватаркой. По ссылке —
  // страница упомянутого помощника, где он сразу берёт задачу в чате.
  var TEAM = {
    marketer: { name: "Эльвира", of: "Эльвиры", page: "marketer.html", she: true },
    designer: { name: "Лев", of: "Льва", page: "designer.html", she: false },
    financier: { name: "Ольга", of: "Ольги", page: "financier.html", she: true },
    assistant: { name: "Тимур", of: "Тимура", page: "assistant.html", she: false },
    clients: { name: "Вера", of: "Веры", page: "clients.html", she: true },
    hr: { name: "Марина", of: "Марины", page: "hr.html", she: true }
  };
  // В кейсе клиента ссылками становятся только его помощники
  if (CASE) {
    var inCase = CASE.team.map(function (t) { return t.id; });
    Object.keys(TEAM).forEach(function (id) { if (inCase.indexOf(id) < 0) delete TEAM[id]; });
  }
  var NAME_RE = /(^|[^А-Яа-яЁё])(Эльвир(?:а|ы|е|у|ой)|Л(?:ев|ьва|ьву|ьвом|ьве)|Ольг(?:а|и|е|у|ой)|Тимур(?:а|у|ом|е)?|Вер(?:а|ы|е|у|ой)|Марин(?:а|ы|е|у|ой))(?![А-Яа-яЁё])/g;

  function whoIs(form) {
    if (/^Эльвир/.test(form)) return "marketer";
    if (/^Л(ев|ьв)/.test(form)) return "designer";
    if (/^Ольг/.test(form)) return "financier";
    if (/^Тимур/.test(form)) return "assistant";
    if (/^Марин/.test(form)) return "hr";
    return "clients";
  }

  // Предложение, в котором упомянут помощник, — его и передаём
  function sentenceWith(text, form) {
    var parts = text.split(/(?<=[.!?…])\s+/);
    var found = parts.filter(function (s) { return s.indexOf(form) > -1; })[0] || text;
    found = found.trim();
    return found.length > 160 ? found.slice(0, 160).replace(/\s+\S*$/, "") + "…" : found;
  }

  function linkMentions(scope) {
    (scope || document).querySelectorAll(".chat .message:not(.message--user) .message__text").forEach(function (p) {
      var full = p.textContent;
      var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.parentElement.closest(".mention")) nodes.push(walker.currentNode);
      }
      nodes.forEach(function (node) {
        var text = node.textContent;
        NAME_RE.lastIndex = 0;
        if (!NAME_RE.test(text)) return;
        NAME_RE.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        while ((m = NAME_RE.exec(text))) {
          var form = m[2], id = whoIs(form);
          var start = m.index + m[1].length;
          if (id === page || !TEAM[id]) continue; // себя и чужих помощников ссылкой не делаем
          frag.appendChild(document.createTextNode(text.slice(last, start)));
          var a = document.createElement("a");
          a.className = "mention mention--" + id;
          a.href = TEAM[id].page + "?from=" + page + "&say=" + encodeURIComponent(sentenceWith(full, form));
          a.title = "Перейти в чат: " + TEAM[id].name;
          a.innerHTML = '<span class="mention__avatar assistant--' + id + '"><img src="' + ROOT + 'assets/avatars/' + id + '.png" alt=""></span>';
          a.appendChild(document.createTextNode(form));
          frag.appendChild(a);
          last = start + form.length;
        }
        if (!last) return;
        frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      });
    });
  }

  // ---------- 1. Чат ----------
  var chat = document.querySelector(".chat");
  var input = chat && chat.querySelector(".chat__input");

  function thread() {
    return chat.querySelector(".chat__messages:not([hidden])");
  }

  // Кто отвечает: аватар и подпись берём из сообщений помощника на этой странице
  function persona() {
    var msg = chat.querySelector(".message:not(.message--user)");
    if (!msg) return null;
    return {
      cls: msg.className,
      avatar: msg.querySelector(".message__avatar").outerHTML,
      author: msg.querySelector(".message__author").innerHTML
    };
  }

  function scrollDown(box) {
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }

  // Первая реплика в этом разговоре — строчка «время + пересказ», как в макете
  var started = {};
  function divider(box, topic) {
    var key = box.getAttribute("data-thread") || "main";
    if (started[key]) return;
    started[key] = true;
    var d = document.createElement("div");
    d.className = "chat__divider is-new";
    d.innerHTML = '<time class="chat__time">Сегодня в ' + now() + '</time><p class="chat__summary"></p>';
    d.querySelector(".chat__summary").textContent = typo(topic || "Продолжаем разговор.");
    box.appendChild(d);
  }

  function addUser(box, text) {
    var m = document.createElement("div");
    m.className = "message message--user is-new";
    m.innerHTML = '<div class="message__bubble"><p class="message__text"></p><time class="message__time">' + now() + "</time></div>";
    m.querySelector(".message__text").textContent = text;
    box.appendChild(m);
  }

  function addAssistant(box, reply) {
    var p = persona();
    if (!p) return;
    var m = document.createElement("div");
    m.className = p.cls + " is-new";
    m.innerHTML = p.avatar +
      '<div class="message__body"><p class="message__author">' + p.author + '</p>' +
      '<p class="message__text"></p>' +
      (reply.c ? '<div class="chips chips--wrap">' + reply.c.map(function (c) {
        return '<button class="chip" type="button">' + esc(typo(c)) + "</button>";
      }).join("") + "</div>" : "") +
      '<time class="message__time">' + now() + "</time></div>";
    m.querySelector(".message__text").textContent = typo(reply.a);
    box.appendChild(m);
    linkMentions(box);
    if (window.cfSnapChips) window.cfSnapChips();
    return m;
  }

  // «Печатает…» — три точки на месте будущего ответа
  function typing(box) {
    var p = persona();
    if (!p) return null;
    var m = document.createElement("div");
    m.className = p.cls + " is-new";
    m.innerHTML = p.avatar + '<div class="message__body"><p class="message__author">' + p.author +
      '</p><span class="typing" aria-label="Печатает"><i></i><i></i><i></i></span></div>';
    box.appendChild(m);
    return m;
  }

  var busy = false;
  function send(text, opts) {
    text = (text || "").trim();
    if (!chat || !text) return;
    var box = thread();
    if (!box) return;
    var reply = (opts && opts.reply) || pickReply(text);
    divider(box, reply.t);
    addUser(box, text);
    scrollDown(box);
    var dots = typing(box);
    scrollDown(box);
    busy = true;
    setTimeout(function () {
      if (dots) dots.remove();
      addAssistant(box, reply);
      scrollDown(box);
      busy = false;
    }, 900 + Math.min(1200, reply.a.length * 9));
  }
  window.cfSend = send;

  if (chat && input) {
    var sendBtn = chat.querySelector(".chat__send");
    function submit() {
      if (!input.value.trim()) return;
      var text = input.value;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      send(text);
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); }
    });
    if (sendBtn) sendBtn.addEventListener("click", submit);

    // «+» слева от поля — прикрепить файл
    var attach = chat.querySelector(".chat__attach");
    if (attach) attach.addEventListener("click", function () {
      pickFile(function (file) {
        send("Файл: " + file.name, { reply: { t: "Новый файл.", a: "Получила файл «" + file.name + "». Что с ним сделать?", c: ["Разбери и запомни", "Сделай по нему пост", "Просто сохрани"] } });
      });
    });
  }

  linkMentions();

  // Пришли по ссылке-упоминанию из чата другого помощника: он передал задачу,
  // этот помощник сразу отвечает в чате и предлагает начать
  var params = new URLSearchParams(location.search);
  var from = TEAM[params.get("from")], said = params.get("say");
  if (chat && from && said && thread()) {
    history.replaceState(null, "", location.pathname + location.hash);
    var box0 = thread();
    divider(box0, "Задача от " + from.of + ".");
    scrollDown(box0);
    var dots0 = typing(box0);
    scrollDown(box0);
    setTimeout(function () {
      if (dots0) dots0.remove();
      addAssistant(box0, {
        a: from.name + (from.she ? " передала" : " передал") + " мне: «" + said.replace(/[.!?…]+$/, "") + "». Берусь?",
        c: ["Да, начинай", "Расскажи подробнее", "Пока не надо"]
      });
      scrollDown(box0);
    }, 1100);
  }

  // ---------- 2. Варианты ответа внутри сообщений — отправляются сразу ----------
  document.addEventListener("click", function (event) {
    var chip = event.target.closest(".chat__messages .chip");
    if (!chip || !chat) return;
    event.stopPropagation();
    var row = chip.closest(".chips");
    row.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("is-chosen", c === chip); });
    send(chip.textContent);
  }, true);

  // ---------- Выбор файла ----------
  function pickFile(done) {
    var f = document.createElement("input");
    f.type = "file";
    f.hidden = true;
    document.body.appendChild(f);
    f.addEventListener("change", function () {
      if (f.files[0]) done(f.files[0]);
      f.remove();
    });
    f.click();
  }

  // ---------- 3–4. Действия в рабочей зоне ----------
  // Название карточки, к которой относится кнопка, — чтобы помощник понял, о чём речь
  function context(el) {
    var box = el.closest(".post, .review, .tile, .proposal, .next-step, .insight, .card, .variant, .scenario");
    if (!box) return "";
    var title = box.querySelector(".post__title, .review__author, .tile__caption, .card__title, .scenario__title, h2, h3");
    return title ? title.textContent.trim().replace(/\s+/g, " ") : "";
  }

  var SKIP = ".task-tab:not(.task-tab--new), [data-go-step], [data-dismiss], [data-open-task], [onclick], .filter, .choice, .variant, .skill:not(.skill--add), .question .chip, .spot *, .chat *, [data-fill], [data-logout], [data-plan], [data-billing], [data-pack], [data-pause]";

  document.addEventListener("click", function (event) {
    var el = event.target.closest("main button");
    if (!el || el.closest("a") || el.matches(SKIP)) return;
    var label = el.textContent.trim().replace(/\s+/g, " ");

    // «+ Новая задача» без своего чата — помощник спрашивает, с чего начать
    if (el.classList.contains("task-tab--new") && !el.hasAttribute("data-task")) {
      var box = chat && thread();
      if (!box) return;
      divider(box, "Новая задача.");
      var m = addAssistant(box, { a: "Какую задачу начнём? Опишите своими словами или выберите вариант — заведу для неё отдельную вкладку.", c: ((CASE && CASE.pages[page] && CASE.pages[page].newTask) || NEW_TASK[page] || []) });
      scrollDown(box);
      input && input.focus();
      return;
    }

    // Загрузка файла
    if (/^Загрузи/.test(label)) {
      pickFile(function (file) {
        if (page === "images") addUploadedTile(file);
        toast(typo("Файл «" + file.name + "» загружен. Помощники учтут его в следующих задачах."));
      });
      return;
    }

    // Ответ на отзыв опубликован
    if (label === "Отправить" && el.closest(".review")) {
      var done = document.createElement("span");
      done.className = "pill pill--ok";
      done.textContent = "Ответ опубликован";
      el.replaceWith(done);
      toast(typo("Ответ опубликован. Гость увидит его в течение часа."));
      return;
    }

    // Подключение сервисов (Память)
    if (label === "Подключить") {
      var ok = document.createElement("span");
      ok.className = "pill pill--ok";
      ok.textContent = "Подключено";
      el.replaceWith(ok);
      toast(typo("Подключено. Помощники начнут брать данные отсюда."));
      return;
    }

    // «Не сейчас» — убрать подсказку
    if (/^Не\s?сейчас/.test(label)) {
      var card = el.closest(".next-step, .proposal, .card");
      if (card) { card.classList.add("is-dismissed"); setTimeout(function () { card.remove(); }, 200); }
      toast("Хорошо, вернусь к этому позже.");
      return;
    }

    // Период в аналитике
    if (/^За\s?\d+ дней/.test(label)) {
      var next = label.indexOf("30") > -1 ? "За 7 дней" : "За 30 дней";
      el.textContent = typo(next);
      toast(typo("Показываю данные " + next.toLowerCase() + "."));
      return;
    }

    // «+ Научить новому» — поле ввода прямо в ряду навыков
    if (el.classList.contains("skill--add")) {
      var field = document.createElement("input");
      field.className = "skill skill--input";
      field.placeholder = "Чему научить?";
      el.before(field);
      field.focus();
      field.addEventListener("keydown", function (e) {
        if (e.key === "Escape") field.remove();
        if (e.key !== "Enter" || !field.value.trim()) return;
        var skill = document.createElement("button");
        skill.type = "button";
        skill.className = "skill is-on";
        skill.textContent = typo(field.value.trim());
        field.replaceWith(skill);
        toast(typo("Навык «" + skill.textContent + "» добавлен. Помощник начнёт учиться на ваших примерах."));
      });
      field.addEventListener("blur", function () { if (!field.value.trim()) field.remove(); });
      return;
    }

    // Остальное — задача помощнику в чат
    if (chat && thread()) {
      var ctx = context(el);
      var text = ctx && label.length < 30 && ctx !== label ? label + " — «" + ctx + "»" : label;
      send(text);
      return;
    }
    toast(typo("Передал помощнику — ответ появится в его чате."));
  });

  var NEW_TASK = {
    designer: ["Обложка для сторис", "Баннер на веранду", "Меню к Новому году"],
    financier: ["Сколько я заработал?", "Налоги за квартал", "Где сэкономить?"],
    clients: ["Ответить на отзывы", "Акция для постоянных", "Опрос гостей"],
    assistant: ["Собери новый проект", "Освободи выходной", "Кто чем занят?"]
  };

  // Загруженная картинка появляется в галерее «Изображения»
  function addUploadedTile(file) {
    var grid = document.getElementById("gallery");
    if (!grid || !/^image\//.test(file.type)) return;
    var tile = document.createElement("div");
    tile.className = "tile is-new";
    tile.setAttribute("data-owner", "you unused");
    tile.innerHTML =
      '<span class="art art--upload"><span class="art__label">Ваша картинка</span></span>' +
      '<p class="tile__caption"></p>' +
      '<span class="tile__meta">Вы · только что</span>' +
      '<div class="tile__actions"><a class="chip" href="marketer.html">Сделать пост</a></div>';
    tile.querySelector(".art").style.setProperty("--art-img", 'url("' + URL.createObjectURL(file) + '")');
    tile.querySelector(".tile__caption").textContent = file.name;
    grid.prepend(tile);
  }
})();
