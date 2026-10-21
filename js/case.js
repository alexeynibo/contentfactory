/* =========================================================
   ContentFactory — движок кейсов клиентов

   Кофейня «Зерно» свёрстана вручную (страницы в корне проекта).
   Остальные клиенты лежат в cases/<id>/: у каждого файл данных data.js
   (window.CF_CASE) и короткие страницы-оболочки. Этот файл рисует
   страницу из данных той же разметкой, что у кофейни, — поэтому
   работают все стили (css/) и поведение (js/workspace.js, chips.js, chat.js).

   Оболочка страницы:
     <body data-page="marketer">          ← home, images, text, analytics,
                                            memory, settings, account, pricing
                                            или id помощника
       <div id="cf-app"></div>
       <script src="data.js"></script>
       <script src="../../js/case.js"></script>   ← до остальных скриптов
       <script src="../../js/sidebar.js"></script> …

   Режим чата (CF_CASE.chat):
     "task"   — одна задача = отдельный чат (вкладка переключает и чат, и работу);
     "shared" — один общий чат на все задачи помощника.
   ========================================================= */

(function () {
  var C = window.CF_CASE;
  if (!C) return;

  var ROOT = "../../"; // корень проекта относительно cases/<id>/
  window.CF_ROOT = ROOT;
  var page = document.body.getAttribute("data-page");

  // ---------- Помощники ----------
  var ROLES = {
    marketer: { name: "Эльвира", acc: "Эльвиру", role: "Маркетолог", she: true },
    designer: { name: "Лев", acc: "Льва", role: "Дизайнер", she: false },
    financier: { name: "Ольга", acc: "Ольгу", role: "Финансист", she: true },
    assistant: { name: "Тимур", acc: "Тимура", role: "Личный помощник", she: false },
    clients: { name: "Вера", acc: "Веру", role: "Клиентский менеджер", she: true },
    hr: { name: "Марина", acc: "Марину", role: "Рекрутер", she: true }
  };
  var TEAM = {};
  C.team.forEach(function (t) {
    var base = ROLES[t.id];
    TEAM[t.id] = Object.assign({ name: base.name, acc: base.acc, role: base.role, she: base.she }, t);
  });

  // ---------- Типографика ----------
  // Неразрывный пробел после коротких слов, перед тире и в числах — только в тексте, не в тегах
  function typoText(s) {
    var short = /(^|[\s(«„>])(в|и|к|с|о|у|а|я|на|не|по|за|из|до|от|об|во|со|ко|для|что|как|мы|вы|он|но|ни|без|при|про|их|её|его)\s/gi;
    for (var i = 0; i < 2; i++) s = s.replace(short, "$1$2 ");
    return s
      .replace(/\s—/g, " —")
      .replace(/(\d)\s(?=(₽|%|мин|минут|шт|ч\b|дн|кресл|номер|студи|товар|человек|клиент|пациент|гост))/g, "$1 ")
      .replace(/(\d)\s(\d{3})/g, "$1 $2");
  }
  function T(s) {
    if (s == null) return "";
    return String(s).split(/(<[^>]+>)/).map(function (part) {
      return part.charAt(0) === "<" ? part : typoText(part);
    }).join("");
  }
  function attr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // ---------- Мелкие детали ----------
  function av(id, size) {
    return '<span class="avatar' + (size ? " avatar--" + size : "") + " assistant--" + id + '"><img src="' + ROOT + "assets/avatars/" + id + '.png" alt=""></span>';
  }
  function pill(p) {
    if (!p) return "";
    return '<span class="pill pill--' + (p.kind || "ok") + '">' + (p.kind === "work" ? '<span class="spinner"></span>' : "") + T(p.text) + "</span>";
  }
  function btn(b, small) {
    if (!b) return "";
    var cls = "btn " + (b.primary ? "btn--primary" : "btn--secondary") + (small ? " btn--small" : "");
    if (b.href) return '<a class="' + cls + '" href="' + attr(b.href) + '">' + T(b.label) + "</a>";
    return '<button class="' + cls + '" type="button"' + (b.dismiss ? " data-dismiss" : "") + ">" + T(b.label) + "</button>";
  }
  function art(img, label, extra) {
    // Путь в --art-img браузер считает от css/workspace.css, где переменная используется, — поэтому «../assets»
    return '<span class="art' + (extra ? " " + extra : "") + '"' + (img ? ' style="--art-img:url(&quot;../assets/images/' + img + '&quot;)"' : "") + ">" +
      (label ? '<span class="art__label">' + T(label) + "</span>" : "") + "</span>";
  }
  function chip(label, href) {
    return href ? '<a class="chip" href="' + attr(href) + '">' + T(label) + "</a>" : '<button class="chip" type="button">' + T(label) + "</button>";
  }
  function progress(p, live) {
    return '<span class="progress' + (live ? " progress--live" : "") + '"><span class="progress__bar" style="width:' + p + '%"></span></span>';
  }
  function sectionTitle(title, hint) {
    return '<h2 class="section-title">' + T(title) + (hint ? ' <span class="section-title__hint">' + T(hint) + "</span>" : "") + "</h2>";
  }

  // ---------- Блоки рабочей зоны ----------
  var B = {
    section: function (b) { return sectionTitle(b.title, b.hint); },

    note: function (b) { return '<p class="card__text muted" style="margin-top:12px;font-size:13px">' + T(b.text) + "</p>"; },

    cards: function (b) {
      return '<div class="grid grid--' + (b.cols || 3) + '">' + b.items.map(function (c) {
        return '<div class="card' + (c.flat ? " card--flat" : "") + (c.selected ? " is-selected" : "") + '">' +
          (c.label ? '<span class="kpi__label">' + T(c.label) + "</span>" : "") +
          '<div class="card__head" style="justify-content:space-between;margin:' + (c.label ? "6px" : "0") + ' 0 0">' +
            (c.title ? '<h3 class="card__title">' + T(c.title) + "</h3>" : "") + pill(c.pill) + "</div>" +
          (c.meta ? '<p class="card__meta" style="margin-top:4px">' + T(c.meta) + "</p>" : "") +
          (c.text ? '<p class="card__text" style="margin-top:8px">' + T(c.text) + "</p>" : "") +
          (c.chips ? '<div class="post__tools">' + c.chips.map(function (x) { return chip(x); }).join("") + "</div>" : "") +
          (c.actions ? '<div class="card__actions">' + c.actions.map(function (a) { return btn(a, true); }).join("") + "</div>" : "") +
        "</div>";
      }).join("") + "</div>";
    },

    posts: function (b) {
      return '<div class="stack' + (b.cols ? " stack--cols" : "") + '">' + b.items.map(function (p) {
        return '<article class="post">' +
          '<div class="post__date">' + T(p.date) + (p.channel ? "<span>" + T(p.channel) + "</span>" : "") + "</div>" +
          "<div>" + (p.title ? '<h3 class="post__title">' + T(p.title) + "</h3>" : "") +
            '<p class="post__text"' + (b.editable === false ? "" : ' contenteditable="true"') + ">" + T(p.text) + "</p>" +
            '<div class="post__tools">' + (p.tools || b.tools || ["Переписать", "Короче"]).map(function (t) {
              return typeof t === "string" ? chip(t) : chip(t.label, t.href);
            }).join("") + "</div>" +
          "</div>" +
          '<div class="post__side">' + pill(p.status) + "</div>" +
        "</article>";
      }).join("") + "</div>";
    },

    kpis: function (b) {
      return '<div class="grid grid--' + (b.cols || 4) + '">' + b.items.map(function (k) {
        return '<div class="card"><span class="kpi__label">' + T(k.label) + '</span><span class="kpi__value">' + T(k.value) + "</span>" +
          (k.delta ? '<span class="kpi__delta' + (k.down ? " kpi__delta--down" : "") + '">' + T(k.delta) + "</span>" : "") +
          (k.tip ? '<p class="kpi__tip">' + T(k.tip) + "</p>" : "") + "</div>";
      }).join("") + "</div>";
    },

    rows: function (b) {
      return '<div class="rows' + (b.cols ? " rows--cols" : "") + '">' + b.items.map(rowHtml).join("") + "</div>";
    },

    insights: function (b) {
      return '<div class="stack">' + b.items.map(function (i) {
        var icon = i.icon || (i.kind === "warn" ? "!" : i.kind === "up" ? "↑" : "₽");
        return '<div class="insight"><span class="insight__icon' + (i.kind ? " insight__icon--" + i.kind : "") + '">' + icon + "</span>" +
          '<div class="insight__body"><p class="insight__text">' + T(i.text) + "</p>" +
          (i.actions || i.isNew ? '<div class="card__actions">' + (i.actions || []).map(function (a) { return btn(a, true); }).join("") +
            (i.isNew ? '<span class="pill pill--new">Новое</span>' : "") + "</div>" : "") +
          "</div></div>";
      }).join("") + "</div>";
    },

    next: function (b) {
      return '<div class="next-step">' + av(b.who, 48) +
        '<div class="next-step__body"><span class="next-step__label">' + T(b.label || "Что дальше") + '</span><p class="next-step__text">' + T(b.text) + "</p></div>" +
        '<div class="next-step__actions">' + (b.actions || []).map(function (a) { return btn(a); }).join("") + "</div></div>";
    },

    working: function (b) {
      return '<div class="working"><div class="working__head">' + av(b.who) + '<h2 class="working__title">' + T(b.title) + '</h2><span class="working__time">' + T(b.time) + "</span></div>" +
        '<div class="progress progress--live"><span class="progress__bar" style="width:' + b.progress + '%"></span></div>' +
        (b.tiles ? '<div class="grid grid--4" style="margin-top:20px">' + b.tiles.map(function (t) {
          return '<div class="tile">' + (t ? art(t.img, t.label) : '<span class="skeleton" style="aspect-ratio:1"></span>') + "</div>";
        }).join("") + "</div>" : "") +
        (b.meanwhile ? '<div class="meanwhile"><h3 class="meanwhile__title">Пока ждёте</h3><div class="meanwhile__list">' + b.meanwhile.map(function (m) {
          var tag = m.href ? 'a class="meanwhile__item" href="' + attr(m.href) + '"' : 'div class="meanwhile__item"';
          return "<" + tag + "><b>" + T(m.title) + "</b>" + T(m.text) + "</" + (m.href ? "a" : "div") + ">";
        }).join("") + "</div></div>" : "") + "</div>";
    },

    tiles: function (b) {
      return '<div class="grid grid--' + (b.cols || 4) + (b.fill ? " grid--tiles" : "") + '">' + b.items.map(function (t) {
        return '<div class="tile"' + (t.owner ? ' data-owner="' + t.owner + '"' : "") + ">" + art(t.img, t.label, t.wide ? "art--wide" : "") +
          (t.caption ? '<p class="tile__caption">' + T(t.caption) + "</p>" : "") +
          (t.meta ? '<span class="tile__meta">' + (t.who ? av(t.who, 24) : "") + T(t.meta) + "</span>" : "") +
          (t.actions ? '<div class="tile__actions">' + t.actions.map(function (a) { return chip(a.label, a.href); }).join("") + "</div>" : "") +
        "</div>";
      }).join("") + "</div>";
    },

    bars: function (b) {
      return '<div class="card">' + (b.title ? '<div class="card__head"><h2 class="card__title">' + T(b.title) + "</h2></div>" : "") +
        '<div class="bars">' + b.items.map(function (r) {
          return '<div class="bar__row"><span>' + T(r.label) + '</span><span class="bar__track"><span class="bar__fill' + (r.warn ? " bar__fill--warn" : "") +
            '" style="width:' + r.value + '%"></span></span><span class="bar__value">' + T(r.text) + "</span></div>";
        }).join("") + "</div></div>";
    },

    chart: function (b) {
      return '<div class="card"><div class="card__head"><h2 class="card__title">' + T(b.title) + '</h2></div><div class="chart">' +
        b.items.map(function (c) {
          return '<div class="chart__col"><span class="chart__bar' + (c.hot ? " chart__bar--hot" : "") + '" style="height:' + c.value + '%"></span>' + T(c.label) + "</div>";
        }).join("") + '</div><p class="kpi__tip">' + T(b.caption) + "</p></div>";
    },

    split: function (b) {
      return '<div class="grid grid--split" style="margin-top:16px;align-items:start">' + "<div>" + renderBlocks(b.left) + "</div><div>" + renderBlocks(b.right) + "</div></div>";
    },

    reviews: function (b) {
      return '<div class="stack">' + b.items.map(function (r) {
        return '<article class="review"><div>' +
          '<div class="review__author">' + T(r.author) + ' <span class="stars' + (r.stars < 4 ? " stars--low" : "") + '">' + "★★★★★".slice(0, r.stars) + "☆☆☆☆☆".slice(0, 5 - r.stars) + "</span>" +
            (r.flag ? '<span class="pill pill--wait">' + T(r.flag) + "</span>" : "") + "</div>" +
          '<p class="card__meta" style="margin:0 0 10px">' + T(r.source) + "</p>" +
          '<p class="review__text">' + T(r.text) + "</p></div>" +
          '<div class="review__reply"><span class="review__reply-label">' + av(b.who || "clients", 24) + "Черновик ответа</span>" +
            '<p class="review__text" contenteditable="true">' + T(r.reply) + "</p>" +
            '<div class="card__actions"><button class="btn btn--primary btn--small" type="button">Отправить</button>' +
              (r.tools || ["Мягче", "Короче"]).map(function (t) { return chip(t); }).join("") + "</div></div>" +
        "</article>";
      }).join("") + "</div>";
    },

    table: function (b) {
      return '<div class="card"><table class="table"><thead><tr>' + b.head.map(function (h, i) {
        return "<th" + (i && b.num !== false ? ' class="num"' : "") + ">" + T(h) + "</th>";
      }).join("") + "</tr></thead><tbody>" + b.rows.map(function (r) {
        return "<tr>" + r.map(function (cell, i) {
          var html = typeof cell === "object" && cell ? (cell.img ? '<span class="table__thumb">' + art(cell.img) + T(cell.text) + "</span>" : cell.action ? btn(cell.action, true) : pill(cell.pill)) : T(cell);
          return "<td" + (i ? ' class="num"' : "") + ">" + html + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
    },

    facts: function (b) {
      return '<div class="facts">' + b.items.map(function (f) {
        return '<div class="fact"><span class="fact__label">' + T(f.label) + '</span><p class="fact__value" contenteditable="true">' + T(f.value) + "</p>" +
          (f.source ? '<span class="fact__source">' + T(f.source) + "</span>" : "") + "</div>";
      }).join("") + "</div>";
    },

    questions: function (b) {
      return '<div class="grid grid--2">' + b.items.map(function (q) {
        return '<div class="question"><p class="question__text">' + av(q.who, 24) + T(q.text) + '</p><div class="chips">' +
          q.options.map(function (o) { return chip(o); }).join("") + "</div></div>";
      }).join("") + "</div>";
    },

    ask: function (b) {
      return '<div class="card"><h2 class="card__title">' + T(b.title) + '</h2><div class="stack" style="margin-top:16px">' + b.items.map(function (q) {
        return '<div class="question"><p class="question__text">' + T(q.text) + '</p><div class="chips">' + q.options.map(function (o) { return chip(o); }).join("") + "</div></div>";
      }).join("") + "</div></div>";
    },

    choices: function (b) {
      return '<div class="card"><h2 class="card__title">' + T(b.title) + '</h2><div class="choice-list" style="margin-top:14px">' + b.items.map(function (c) {
        return '<button class="choice' + (c[1] ? " is-selected" : "") + '" type="button">' + T(c[0]) + "</button>";
      }).join("") + "</div>" + (b.note ? '<p class="card__meta" style="margin-top:12px">' + T(b.note) + "</p>" : "") + "</div>";
    },

    candidates: function (b) {
      return '<div class="grid grid--' + (b.cols || 2) + '">' + b.items.map(function (c) {
        return '<div class="card candidate">' +
          '<div class="card__head" style="justify-content:space-between;margin:0"><div><h3 class="card__title">' + T(c.name) + '</h3><p class="card__meta" style="margin-top:4px">' + T(c.meta) + "</p></div>" +
            '<span class="candidate__match">' + c.match + "%</span></div>" +
          '<ul class="candidate__list">' + c.pros.map(function (p) { return "<li>" + T(p) + "</li>"; }).join("") +
            (c.cons || []).map(function (p) { return '<li class="is-con">' + T(p) + "</li>"; }).join("") + "</ul>" +
          '<div class="card__actions">' + (c.actions || [{ label: "Пригласить", primary: true }, { label: "Отказать мягко" }]).map(function (a) { return btn(a, true); }).join("") + "</div>" +
        "</div>";
      }).join("") + "</div>";
    },

    html: function (b) { return T(b.html); }
  };

  function renderBlocks(list) {
    return (list || []).map(function (b) {
      var fn = B[b.type];
      return fn ? fn(b) : "";
    }).join("");
  }

  function rowHtml(r) {
    var tag = r.href ? 'a class="row" href="' + attr(r.href) + '"' : 'div class="row' + (r.ext ? " file" : "") + '"';
    return "<" + tag + ">" + (r.who ? av(r.who) : r.ext ? '<span class="file__ext">' + r.ext + "</span>" : "") +
      '<div class="row__body"><p class="row__title">' + T(r.title) + '</p><p class="row__sub">' + T(r.sub) + "</p></div>" +
      (r.progress != null || r.status || r.action ? '<div class="row__side">' + (r.progress != null ? progress(r.progress, r.status && r.status.kind === "work") : "") +
        pill(r.status) + (r.action ? btn(r.action, true) : "") + "</div>" : "") +
      "</" + (r.href ? "a" : "div") + ">";
  }

  // ---------- Шапка страницы ----------
  function pageHead(title, subtitle, actions) {
    return '<header class="page-head"><div><h1 class="page-head__title">' + T(title) + "</h1>" +
      (subtitle ? '<p class="page-head__subtitle">' + T(subtitle) + "</p>" : "") + "</div>" +
      (actions && actions.length ? '<div class="page-head__actions">' + actions.join("") + "</div>" : "") + "</header>";
  }

  // ---------- Чат ----------
  function messageHtml(m) {
    if (m.divider) {
      return '<div class="chat__divider"><time class="chat__time">' + T(m.divider) + "</time>" +
        (m.summary ? '<p class="chat__summary">' + T(m.summary) + "</p>" : "") + "</div>";
    }
    if (m.from === "user") {
      return '<div class="message message--user"><div class="message__bubble"><p class="message__text">' + T(m.text) + '</p><time class="message__time">' + m.time + "</time></div></div>";
    }
    var a = TEAM[m.from] || TEAM[page];
    var id = m.from || page;
    return '<div class="message message--' + id + '"><div class="message__avatar assistant assistant--' + id + '"><img src="' + ROOT + "assets/avatars/" + id + '.png" width="40" height="40" alt=""></div>' +
      '<div class="message__body"><p class="message__author"><span class="message__name">' + T(a.name) + "</span> — " + T(a.role) + "</p>" +
      '<p class="message__text">' + T(m.text) + "</p>" +
      (m.chips ? '<div class="chips chips--wrap">' + m.chips.map(function (c) { return chip(c); }).join("") + "</div>" : "") +
      '<time class="message__time">' + m.time + "</time></div></div>";
  }

  function briefHtml(br) {
    if (!br) return "";
    return '<details class="brief"><summary class="brief__toggle">Кратко о задаче <span class="brief__count">' + br.decisions.length + " " + plural(br.decisions.length, "решение", "решения", "решений") + "</span></summary>" +
      '<div class="brief__body">' +
        '<div class="brief__row"><span class="brief__label">Цель</span><p class="brief__text">' + T(br.goal) + "</p></div>" +
        '<div class="brief__row"><span class="brief__label">Что решили</span><ul class="brief__decisions">' + br.decisions.map(function (d) {
          return "<li><time>" + d[0] + "</time>" + T(d[1]) + "</li>";
        }).join("") + "</ul></div>" +
        '<div class="brief__row"><span class="brief__label">Сейчас</span><p class="brief__text">' + T(br.now) + "</p></div>" +
      "</div></details>";
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  }

  function composer(label, chipsByThread) {
    return '<div class="chat__composer"><div class="chat__field">' +
      '<button class="chat__attach" type="button" title="Добавить файл" aria-label="Добавить файл"><img src="' + ROOT + 'assets/icons/plus.svg" width="40" height="40" alt=""></button>' +
      '<input class="chat__input" type="text" placeholder="Напишите сообщение…" aria-label="' + attr(label) + '">' +
      '<button class="chat__send" type="button" title="Отправить" aria-label="Отправить сообщение"><span class="chat__send-circle"><img src="' + ROOT + 'assets/icons/send.svg" width="40" height="40" alt=""></span></button>' +
      "</div>" + chipsByThread + "</div>";
  }

  function chatHtml(pg, a) {
    var label = "Сообщение: " + a.name;
    if (C.chat === "task") {
      // Одна задача — один чат: у каждой вкладки своя шапка, переписка и подсказки
      var first = pg.tasks[0].id;
      var heads = pg.tasks.map(function (t) {
        return '<header class="chat__head" data-thread="' + t.id + '"' + (t.id === first ? "" : " hidden") + '>' +
          '<span class="chat__task-label">Чат задачи</span><h2 class="chat__task-title">' + T(t.title) + "</h2>" +
          '<p class="chat__task-meta">' + (t.steps.length > 1 ? "Этап " + (t.current + 1) + " из\u00a0" + t.steps.length + " · " + T(t.steps[t.current]) : T(t.steps[0])) + "</p>" +
          briefHtml(t.brief) + "</header>";
      }).join("");
      var threads = pg.tasks.map(function (t) {
        return '<div class="chat__messages" data-thread="' + t.id + '"' + (t.id === first ? "" : " hidden") + ">" + t.chat.map(messageHtml).join("") + "</div>";
      }).join("");
      var chips = pg.tasks.map(function (t) {
        return '<div class="chips" aria-label="Подсказки" data-thread="' + t.id + '"' + (t.id === first ? "" : " hidden") + ">" + (t.hints || []).map(function (c) { return chip(c); }).join("") + "</div>";
      }).join("");
      return '<aside class="chat" aria-label="Чат: ' + attr(a.name) + '">' + heads + threads + composer(label, chips) + "</aside>";
    }
    // Общий чат: одна лента на все задачи, вкладки переключают только рабочую зону
    return '<aside class="chat" aria-label="Чат: ' + attr(a.name) + '"><div class="chat__messages">' + pg.chat.map(messageHtml).join("") + "</div>" +
      composer(label, '<div class="chips" aria-label="Подсказки">' + (pg.hints || []).map(function (c) { return chip(c); }).join("") + "</div>") + "</aside>";
  }

  // ---------- Задачи и этапы ----------
  function taskHtml(t, first) {
    var keys = t.steps.map(function (s, i) { return "s" + i; });
    var cur = keys[t.current];
    var steps = '<ol class="steps">' + t.steps.map(function (s, i) {
      var cls = i < t.current ? " is-done" : i === t.current ? " is-current" : "";
      return '<li class="steps__item' + cls + '"><button class="step" type="button"' + (i <= t.current ? ' data-step="' + keys[i] + '"' : "") +
        '><span class="step__dot">' + (i + 1) + '</span><span class="step__label">' + T(s) + "</span></button></li>";
    }).join("") + "</ol>";
    var note = '<div class="step-note" hidden><span>Вы смотрите пройденный этап «<span data-step-name>…</span>». Если что-то поменяете, ' +
      T(TEAM[page].name) + " обновит следующие этапы.</span>" +
      '<button class="btn btn--small btn--secondary" type="button" data-go-step="">Вернуться к текущему этапу</button></div>';
    var panels = t.steps.map(function (s, i) {
      if (i > t.current) return "";
      var blocks = (t.panels && t.panels[i]) || (i === t.current ? t.blocks : [{ type: "cards", cols: 1, items: [{ title: "Этап «" + s + "» пройден", text: "Результат сохранён — его можно открыть и поправить. Если что-то поменяете, следующие этапы обновятся.", pill: { kind: "ok", text: "Готово" } }] }]);
      return '<div class="step-panel" data-panel="' + keys[i] + '"' + (i === t.current ? "" : " hidden") + ">" + renderBlocks(blocks) + "</div>";
    }).join("");
    if (t.steps.length === 1) steps = note = ""; // задача из одного этапа («Мой день») — без полосы этапов
    return '<section class="task" data-task-id="' + t.id + '" data-current="' + cur + '"' + (first ? "" : " hidden") + ">" + steps + note + panels + "</section>";
  }

  function assistantPage(id) {
    var a = TEAM[id], pg = C.pages[id];
    var tabs = '<div class="task-tabs" role="tablist" aria-label="Задачи">' + pg.tasks.map(function (t, i) {
      return '<button class="task-tab' + (i ? "" : " is-active") + '" type="button" data-task="' + t.id + '">' +
        (t.working ? '<span class="spinner"></span>' : "") + T(t.title) + (t.steps.length > 1 ? ' <span class="task-tab__meta">' + (t.current + 1) + "/" + t.steps.length + "</span>" : "") +
        (t.dot ? '<span class="task-tab__dot" aria-label="Новое сообщение"></span>' : "") + "</button>";
    }).join("") + '<button class="task-tab task-tab--new" type="button">+ Новая задача</button></div>';
    var main = '<main class="main"><div class="workspace">' +
      pageHead(a.name + ", " + a.role.toLowerCase(), pg.subtitle, ['<a class="btn btn--secondary" href="settings.html">Настроить ' + T(a.acc || a.name) + "</a>"]) +
      tabs + pg.tasks.map(function (t, i) { return taskHtml(t, i === 0); }).join("") + "</div></main>";
    return '<div class="app app--chat"><nav class="sidebar" aria-label="Главное меню"></nav>' + chatHtml(pg, a) + main + "</div>";
  }

  // ---------- Главная ----------
  function homePage() {
    var h = C.home;
    var html = pageHead(h.greeting, h.subtitle) +
      sectionTitle("Помощники предлагают", "можно отложить — напомним завтра") +
      '<div class="grid grid--3">' + h.proposals.map(function (p) {
        var a = TEAM[p.who];
        return '<div class="proposal"><div class="proposal__who">' + av(p.who) + "<span><b>" + T(a.name) + "</b>" + T(a.role.toLowerCase()) + "</span></div>" +
          '<p class="proposal__text">' + T(p.text) + '</p><p class="proposal__why">' + T(p.why) + "</p>" +
          '<div class="proposal__actions">' + btn({ label: p.action, href: p.href || p.who + ".html", primary: true }, true) +
          '<button class="btn btn--secondary btn--small" type="button" data-dismiss>Позже</button></div></div>';
      }).join("") + "</div>" +
      sectionTitle("В работе", h.workHint) + '<div class="rows rows--cols">' + h.work.map(rowHtml).join("") + "</div>" +
      sectionTitle("С чего начать", h.startHint) + '<div class="grid grid--3">' + h.start.map(function (s) {
        return '<a class="scenario" href="' + (s.href || s.who + ".html") + '">' + av(s.who) + '<p class="scenario__title">' + T(s.title) + "</p>" +
          '<p class="scenario__text">' + T(s.text) + '</p><span class="scenario__time">' + T(s.time) + "</span></a>";
      }).join("") + "</div>";
    return simplePage(html);
  }

  function simplePage(inner) {
    return '<div class="app"><nav class="sidebar" aria-label="Главное меню"></nav><main class="main"><div class="workspace">' + inner + "</div></main></div>";
  }

  // ---------- Разделы: изображения, тексты, аналитика ----------
  function sectionPage(key) {
    var s = C.sections[key];
    return simplePage(pageHead(s.title, s.subtitle, (s.actions || []).map(function (a) { return btn(a); })) + renderBlocks(s.blocks));
  }

  // ---------- Память ----------
  function memoryPage() {
    var m = C.memory;
    var html = pageHead("Что помощники знают о вас", "Помощники запоминают факты из чатов, файлов и подключённых сервисов. Чем точнее здесь, тем лучше результаты — поправьте, если что-то не так.",
      ['<button class="btn btn--secondary" type="button">Загрузить файл</button>']) +
      sectionTitle("Помощники хотят уточнить", "ответ в один клик") + B.questions({ items: m.questions }) +
      m.groups.map(function (g) { return sectionTitle(g.title) + B.facts({ items: g.facts }); }).join("") +
      sectionTitle("Фирменный стиль") + '<div class="grid grid--2"><div class="card"><span class="fact__label">Цвета</span><div class="swatches" style="margin-top:8px">' +
        m.colors.map(function (c) { return '<span class="swatch" style="background:' + c[0] + '" title="' + attr(c[1]) + '"></span>'; }).join("") +
        '</div><p class="fact__source" style="margin-top:8px">' + T(m.colorsSource) + "</p></div>" +
        '<div class="card"><span class="fact__label">Как общаетесь с клиентами</span><p class="fact__value" contenteditable="true">' + T(m.tone) + '</p><span class="fact__source">' + T(m.toneSource) + "</span></div></div>" +
      '<div class="grid grid--2" style="margin-top:32px"><div>' + sectionTitle("Файлы") + '<div class="rows">' + m.files.map(rowHtml).join("") + "</div></div>" +
        "<div>" + sectionTitle("Подключения") + '<div class="rows">' + m.connections.map(function (c) {
          return '<div class="row"><div class="row__body"><p class="row__title">' + T(c.title) + '</p><p class="row__sub">' + T(c.sub) + "</p></div>" +
            (c.on ? '<span class="pill pill--ok">Подключено</span>' : '<button class="btn ' + (c.primary ? "btn--primary" : "btn--secondary") + ' btn--small" type="button">Подключить</button>') + "</div>";
        }).join("") + "</div></div></div>";
    return simplePage(html);
  }

  // ---------- Настройки помощников ----------
  var MANNERS = ["Дружелюбная", "Деловая", "С юмором", "Коротко и по делу", "Тёплая и заботливая"];
  function settingsPage() {
    var html = pageHead("Ваши помощники", "Настройте каждого под себя: имя, манеру общения, навыки и то, насколько он инициативен") +
      '<div class="stack stack--cols" style="gap:16px">' + C.team.map(function (t) {
        var a = TEAM[t.id], s = t.settings;
        return '<section class="persona">' + av(t.id, 64) + "<div>" +
          '<h2 class="persona__name">' + T(a.name) + '</h2><p class="persona__role">' + T(a.role) + " · " + T(s.about) + "</p>" +
          '<div class="grid grid--2"><label class="field"><span class="field__label">Имя</span><input class="field__input" type="text" value="' + attr(a.name) + '"></label>' +
          '<label class="field"><span class="field__label">Манера общения</span><select class="field__select">' + MANNERS.map(function (m) {
            return "<option" + (m === s.manner ? " selected" : "") + ">" + T(m) + "</option>";
          }).join("") + "</select></label></div>" +
          '<div class="field" style="margin-top:16px"><span class="field__label">Навыки</span><div class="skills">' + s.skills.map(function (k) {
            return '<button class="skill' + (k[1] ? " is-on" : "") + '" type="button">' + T(k[0]) + "</button>";
          }).join("") + '<button class="skill skill--add" type="button">+ Научить новому</button></div></div>' +
          '<div class="initiative"><div class="initiative__head"><span>Инициативность</span><span class="initiative__level"></span></div>' +
          '<input type="range" min="0" max="100" value="' + s.initiative + '" data-initiative aria-label="Инициативность: ' + attr(a.name) + '">' +
          '<div class="initiative__scale"><span>Только по просьбе</span><span>' + (a.she ? "Сама" : "Сам") + " предлагает идеи</span></div>" +
          '<p class="initiative__desc"></p></div></div></section>';
      }).join("") + "</div>";
    return simplePage(html);
  }

  // ---------- Аккаунт ----------
  var PLANS = {
    "Знакомство": { price: "0", helpers: "Тимур" },
    "Старт": { price: "990", helpers: "2 помощника" },
    "Команда": { price: "2 990", helpers: "5 помощников" },
    "Сеть": { price: "6 990", helpers: "все помощники и свои роли" }
  };
  function accountPage() {
    var o = C.owner, u = C.usage, plan = PLANS[C.plan];
    function bar(label, used, limit) {
      var p = Math.round(used / limit * 100);
      return '<div class="bar__row"><span>' + T(label) + '</span><span class="bar__track"><span class="bar__fill' + (p >= 80 ? " bar__fill--warn" : "") + '" style="width:' + p + '%"></span></span><span class="bar__value">' + used + " из " + limit + "</span></div>";
    }
    var html = pageHead("Аккаунт", "Ваши данные, компания и тариф", ['<button class="btn btn--secondary" type="button" data-logout>Выйти из профиля</button>']) +
      '<div class="account"><div class="stack" style="gap:16px">' +
        '<div class="card"><h2 class="card__title">Вы</h2><div class="grid grid--2" style="margin-top:16px">' +
          '<label class="field"><span class="field__label">Как к вам обращаться</span><input class="field__input" type="text" value="' + attr(o.name) + '"></label>' +
          '<label class="field"><span class="field__label">Почта</span><input class="field__input" type="email" value="' + attr(o.email) + '"></label></div></div>' +
        '<div class="card"><h2 class="card__title">Компания</h2><div class="grid grid--2" style="margin-top:16px">' +
          '<label class="field"><span class="field__label">Название</span><input class="field__input" type="text" value="' + attr(C.company) + '"></label>' +
          '<label class="field"><span class="field__label">Сфера</span><input class="field__input" type="text" value="' + attr(C.sphere) + '"></label></div>' +
          '<p class="card__text muted" style="margin-top:12px;font-size:13px">Подробности о компании помощники берут из раздела <a class="btn btn--ghost" href="memory.html">Память</a>.</p></div>' +
      '</div><div class="stack" style="gap:16px"><div class="card">' +
        '<div class="card__head" style="justify-content:space-between;margin:0"><div><h2 class="card__title">Тариф «' + C.plan + '»</h2>' +
          '<p class="card__meta" style="margin-top:4px">' + T(plan.helpers) + " · " + plan.price + " ₽ в месяц · следующее списание 12 ноября</p></div>" +
          '<a class="btn btn--secondary" href="pricing.html">Сменить тариф</a></div>' +
        '<div class="bars" style="margin-top:20px">' + bar("Тексты и посты", u.texts[0], u.texts[1]) + bar("Картинки", u.images[0], u.images[1]) +
          (u.video ? bar("Короткие видео", u.video[0], u.video[1]) : "") + "</div>" +
        '<p class="card__text muted" style="margin-top:14px;font-size:13px">Не считаются: правки по точкам, до трёх перерисовок одной картинки и черновики, которые помощники подготовили сами, пока вы их не одобрили.</p>' +
        (u.hint ? B.next(u.hint) : "") +
      "</div></div></div>";
    return simplePage(html);
  }

  // ---------- Тарифы ----------
  function pricingPage() {
    function plan(name, forText, priceM, priceY, noteM, noteY, list) {
      var cur = name === C.plan;
      return '<section class="plan' + (cur ? " plan--current" : "") + '">' + (cur ? '<span class="plan__badge">Ваш тариф</span>' : "") +
        '<h2 class="plan__name">' + name + '</h2><p class="plan__for">' + T(forText) + "</p>" +
        (priceM === "0" ? '<p class="plan__price"><b>0 ₽</b></p>' :
          '<p class="plan__price"><b data-price-month="' + priceM + '" data-price-year="' + priceY + '">' + priceM + "</b> ₽ <span>в месяц</span></p>") +
        '<p class="plan__note"' + (noteY ? ' data-note-month="' + attr(T(noteM)) + '" data-note-year="' + attr(T(noteY)) + '"' : "") + ">" + T(noteM) + "</p>" +
        (cur ? '<button class="btn btn--secondary plan__btn" type="button" disabled>Подключён</button>' : '<button class="btn btn--secondary plan__btn" type="button" data-plan="' + name + '">Перейти</button>') +
        '<ul class="plan__list">' + list.map(function (l) { return "<li>" + T(l) + "</li>"; }).join("") + "</ul></section>";
    }
    var nb = " ";
    var html = pageHead("Тарифы", "Вы платите за команду помощников, а не за нейросети. Лимиты — в понятных постах и картинках.") +
      '<div class="value"><div class="value__item"><span class="value__label">SMM-специалист</span><span class="value__price">от 15 000 ₽ в месяц</span></div>' +
      '<div class="value__item"><span class="value__label">Картинка у фрилансера</span><span class="value__price">500–1 500 ₽ за штуку</span></div>' +
      '<div class="value__item"><span class="value__label">Бухгалтер на аутсорсе</span><span class="value__price">от 3 000 ₽ в месяц</span></div>' +
      '<div class="value__item value__item--ours"><span class="value__label">Ваша команда в ContentFactory</span><span class="value__price">' + PLANS[C.plan].price + " ₽ в месяц</span></div></div>" +
      '<div class="plans">' +
        plan("Знакомство", "Посмотреть, как помощник сам предлагает, с чего начать", "0", "", "Бесплатно навсегда", "", ["Тимур — личный помощник", "15 текстов и 5 картинок в месяц", "Идеи и подсказки на главной", "Один бизнес"]) +
        plan("Старт", "Для тех, кому нужен в основном маркетинг", "990", "825", "Можно отменить в любой момент", "9" + nb + "900" + nb + "₽ за год", ["2 помощника на выбор", "60 текстов и 30 картинок в месяц", "Публикация в один канал", "Помощники подсказывают следующий шаг"]) +
        plan("Команда", "Маркетинг, картинки, деньги и клиенты — всё в одном месте", "2" + nb + "990", "2" + nb + "492", "Чаще всего выбирают", "29" + nb + "900" + nb + "₽ за год", ["Все 5 помощников", "200 текстов, 120 картинок и 5 коротких видео", "Публикация во ВКонтакте и Telegram", "Ответы на отзывы на картах и площадках", "Разбор выписки и налоги", "Помощники сами замечают поводы и готовят черновики", "До 3 сотрудников"]) +
        plan("Сеть", "Для нескольких точек и команды сотрудников", "6" + nb + "990", "5" + nb + "825", "Можно отменить в любой момент", "69" + nb + "900" + nb + "₽ за год", ["Всё, что есть в «Команде»", "600 текстов, 400 картинок и 30 видео", "До 5 точек и 10 сотрудников", "Свои роли помощников: рекрутер и другие", "Личный менеджер"]) +
      "</div>" +
      sectionTitle("Честные лимиты") + '<div class="grid grid--3">' +
        [["Правки не тратят лимит", "Правки по точкам и до трёх перерисовок входят в саму картинку."],
         ["Инициатива бесплатна", "Черновики, которые помощники подготовили сами, не считаются, пока вы их не одобрили."],
         ["Работа не обрывается", "Когда лимит подходит к концу, помощник предупредит заранее и предложит, как распределить остаток."]].map(function (x) {
          return '<div class="insight"><div class="insight__body"><b>' + T(x[0]) + '</b><p class="insight__text">' + T(x[1]) + "</p></div></div>";
        }).join("") + "</div>" +
      sectionTitle("Если нужно больше", "пакеты не сгорают 3 месяца") + '<div class="grid grid--3">' +
        [["+50 картинок", "290"], ["+100 текстов", "190"], ["+10 коротких видео", "490"]].map(function (x) {
          return '<div class="card pack"><div><b class="pack__name">' + x[0] + '</b><span class="pack__price">' + x[1] + ' ₽</span></div><button class="btn btn--secondary btn--small" type="button" data-pack="' + x[0].slice(1) + '">Докупить</button></div>';
        }).join("") + "</div>";
    return simplePage(html);
  }

  // ---------- Сборка ----------
  var root = document.getElementById("cf-app");
  var html =
    page === "home" ? homePage() :
    page === "memory" ? memoryPage() :
    page === "settings" ? settingsPage() :
    page === "account" ? accountPage() :
    page === "pricing" ? pricingPage() :
    page === "images" || page === "text" || page === "analytics" ? sectionPage(page) :
    TEAM[page] ? assistantPage(page) : "";
  root.outerHTML = html;
  document.title = (page === "home" ? "Главная" : TEAM[page] ? TEAM[page].name + ", " + TEAM[page].role.toLowerCase() :
    { images: "Изображения", text: "Тексты", analytics: "Аналитика", memory: "Память", settings: "Настройки помощников", account: "Аккаунт", pricing: "Тарифы" }[page]) +
    " — " + C.short;
})();
