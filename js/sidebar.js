/* =========================================================
   ContentFactory — главное меню (одно на все страницы)

   Меню рисуется из этого файла. Меняешь списки ниже —
   меню меняется на всех страницах сразу.

   Как подключить на странице:
     <body data-page="home">          ← id активного раздела
       <nav class="sidebar" aria-label="Главное меню"></nav>
       ...
       <script src="js/sidebar.js"></script>   ← в конце body

   Стили меню — css/styles.css, цвета и градиенты — css/tokens.css.
   ========================================================= */

(function () {
  // ===== Навигация: иконки сверху вниз =====
  // id — имя раздела (его пишем в data-page), icon — файл в assets/icons/
  var NAV = [
    { id: "home",      title: "Главная",     icon: "assets/icons/home.svg",      href: "home.html" },
    { id: "images",    title: "Изображения", icon: "assets/icons/images.svg",    href: "images.html" },
    { id: "text",      title: "Тексты",      icon: "assets/icons/text.svg",      href: "texts.html" },
    { id: "analytics", title: "Аналитика",   icon: "assets/icons/analytics.svg", href: "analytics.html" },
    { id: "memory",    title: "Память",      icon: "assets/icons/memory.svg",    href: "memory.html" }
  ];

  // ===== Помощники: кружки сверху вниз =====
  // Градиент фона задаётся в styles.css классом .assistant--{id}
  // Список ролей с описаниями — docs/assistants.md
  // badge (необязательно): число — красный бейдж с количеством уведомлений,
  //                        "progress" — бейдж «идёт работа» с крутящейся дугой
  // initial (вместо avatar) — временная заглушка-буква, пока нет картинки
  var ASSISTANTS = [
    { id: "marketer",  title: "Эльвира, маркетолог",           avatar: "assets/avatars/marketer.png",  href: "marketer.html" },
    { id: "designer",  title: "Лев, дизайнер",                 avatar: "assets/avatars/designer.png",  href: "designer.html",  badge: "progress" },
    { id: "financier", title: "Ольга, финансист",              avatar: "assets/avatars/financier.png", href: "financier.html", badge: 3 },
    { id: "assistant", title: "Тимур, личный помощник",        avatar: "assets/avatars/assistant.png", href: "assistant.html" },
    { id: "clients",   title: "Вера, клиентский менеджер",     avatar: "assets/avatars/clients.png",   href: "clients.html",   badge: 2 }
  ];

  // ===== Низ меню =====
  var SETTINGS = { id: "settings", title: "Настройки", icon: "assets/icons/settings.svg", href: "settings.html" };
  var ACCOUNT  = { id: "account",  title: "Аккаунт",   initial: "N",                      href: "account.html" };

  // ===== Кейс клиента (cases/<id>/): свои помощники и страницы в папке клиента =====
  // Данные — в cases/<id>/data.js (window.CF_CASE), см. js/case.js
  var CASE = window.CF_CASE;
  if (CASE) {
    var dir = "cases/" + CASE.id + "/";
    NAV.forEach(function (item) { item.href = dir + (item.id === "home" ? "index.html" : item.href); });
    var TITLES = { marketer: "Эльвира, маркетолог", designer: "Лев, дизайнер", financier: "Ольга, финансист",
      assistant: "Тимур, личный помощник", clients: "Вера, клиентский менеджер", hr: "Марина, рекрутер" };
    ASSISTANTS = CASE.team.map(function (t) {
      return { id: t.id, title: TITLES[t.id], avatar: "assets/avatars/" + t.id + ".png", href: dir + t.id + ".html", badge: t.badge };
    });
    SETTINGS.href = dir + SETTINGS.href;
    ACCOUNT.href = dir + ACCOUNT.href;
    ACCOUNT.initial = CASE.owner.initial;
  }

  // ---------------------------------------------------------
  // Ниже — техническая часть, для правки меню её трогать не нужно
  // ---------------------------------------------------------

  // Корень проекта считается от места, где лежит этот файл (js/ → ..),
  // поэтому картинки и ссылки работают со страницы в любой подпапке.
  var script = document.currentScript;
  var base = script && script.src ? new URL("..", script.src).href : location.href;

  function url(path) {
    if (path === "#") return "#";
    try {
      return new URL(path, base).href;
    } catch (e) {
      return path; // необычный адрес страницы — оставляем путь как есть
    }
  }

  var active = document.body.getAttribute("data-page");

  function activeAttrs(id) {
    return id === active ? ' is-active" aria-current="page' : "";
  }

  function navItem(item, extraClass) {
    return (
      '<a class="sidebar__item' + (extraClass || "") + activeAttrs(item.id) + '" href="' + url(item.href) + '" title="' + item.title + '">' +
        '<img src="' + url(item.icon) + '" width="40" height="40" alt="' + item.title + '">' +
      "</a>"
    );
  }

  // «3 уведомления», «5 уведомлений», «1 уведомление»
  function notifications(n) {
    var mod10 = n % 10, mod100 = n % 100;
    var word = mod10 === 1 && mod100 !== 11 ? "уведомление"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "уведомления"
      : "уведомлений";
    return n + " " + word;
  }

  function badge(item) {
    if (item.badge === "progress") {
      return { html: '<span class="badge badge--progress"></span>', label: "идёт работа" };
    }
    if (typeof item.badge === "number" && item.badge > 0) {
      var text = item.badge > 99 ? "99+" : String(item.badge);
      return { html: '<span class="badge badge--count">' + text + "</span>", label: notifications(item.badge) };
    }
    return { html: "", label: "" };
  }

  function assistantItem(item) {
    var b = badge(item);
    var title = item.title + (b.label ? " — " + b.label : "");
    return (
      '<a class="assistant assistant--' + item.id + activeAttrs(item.id) + '" href="' + url(item.href) + '" title="' + title + '">' +
        (item.avatar
          ? '<img src="' + url(item.avatar) + '" width="40" height="40" alt="' + title + '">'
          : '<span class="assistant__initials" aria-hidden="true">' + item.initial + "</span>") +
        b.html +
      "</a>"
    );
  }

  // Открыта страница помощника — остальные аватары в меню уменьшаются
  var isAssistantPage = ASSISTANTS.some(function (item) { return item.id === active; });

  var html =
    NAV.map(function (item) { return navItem(item); }).join("") +
    '<div class="sidebar__assistants">' + ASSISTANTS.map(assistantItem).join("") + "</div>" +
    navItem(SETTINGS, " sidebar__settings") +
    '<a class="sidebar__user' + activeAttrs(ACCOUNT.id) + '" href="' + url(ACCOUNT.href) + '" title="' + ACCOUNT.title + '">' + ACCOUNT.initial + "</a>";

  var nav = document.querySelector(".sidebar");
  if (nav) {
    nav.innerHTML = html;
    nav.classList.toggle("sidebar--assistant-page", isAssistantPage);
  }
})();
