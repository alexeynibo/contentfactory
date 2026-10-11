/* =========================================================
   ContentFactory — поведение рабочей зоны (кликабельный прототип)

   1. Вкладки задач:   .task-tab[data-task] → показывает .task[data-task-id]
   2. Путь задачи:     .step[data-step] → показывает .step-panel[data-panel]
                       Текущий этап задачи — атрибут data-current у .task.
                       Пройденные этапы можно открыть (вернуться назад),
                       будущие — нельзя, пока не дошли.
   3. Точечный промпт: клик по .spot ставит метку и открывает поле ввода.
   4. Фильтры:         .filter[data-filter] прячет элементы [data-owner].
   5. Инициативность:  input[data-initiative] меняет подпись уровня.
   6. «Позже»:         [data-dismiss] убирает плитку-предложение.
   7. Выбор:           .choice / .variant / .skill переключают выделение.
   Подключение: <script src="js/workspace.js"></script> в конце body.
   ========================================================= */

(function () {
  // ---------- 1. Вкладки задач ----------
  document.querySelectorAll(".task-tabs").forEach(function (tabs) {
    tabs.addEventListener("click", function (event) {
      var tab = event.target.closest(".task-tab[data-task]");
      if (!tab) return;

      tabs.querySelectorAll(".task-tab").forEach(function (t) {
        t.classList.toggle("is-active", t === tab);
      });
      document.querySelectorAll(".task[data-task-id]").forEach(function (task) {
        task.hidden = task.getAttribute("data-task-id") !== tab.getAttribute("data-task");
      });
    });
  });

  // ---------- 2. Путь задачи ----------
  function showStep(task, stepId) {
    var current = task.getAttribute("data-current");

    task.querySelectorAll(".step[data-step]").forEach(function (step) {
      step.classList.toggle("is-viewing", step.getAttribute("data-step") === stepId);
    });
    task.querySelectorAll(".step-panel[data-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== stepId;
    });

    // Плашка «Вы смотрите пройденный этап»
    var note = task.querySelector(".step-note");
    if (note) {
      note.hidden = stepId === current;
      var name = task.querySelector('.step[data-step="' + stepId + '"] .step__label');
      var target = note.querySelector("[data-step-name]");
      if (name && target) target.textContent = name.textContent;
    }
  }

  document.querySelectorAll(".task").forEach(function (task) {
    task.addEventListener("click", function (event) {
      var step = event.target.closest(".step[data-step]");
      if (step) {
        var item = step.closest(".steps__item");
        if (item && (item.classList.contains("is-done") || item.classList.contains("is-current"))) {
          showStep(task, step.getAttribute("data-step"));
        }
        return;
      }

      // «Вернуться к текущему этапу» и любые ссылки на этап внутри задачи
      var go = event.target.closest("[data-go-step]");
      if (go) {
        var id = go.getAttribute("data-go-step") || task.getAttribute("data-current");
        showStep(task, id);
      }
    });

    showStep(task, task.getAttribute("data-current"));
  });

  // ---------- 3. Точечный промпт ----------
  document.querySelectorAll(".spot").forEach(function (spot) {
    var count = spot.querySelectorAll(".spot__marker").length;
    var pop = null;

    function closePop() {
      if (pop) pop.remove();
      pop = null;
    }

    spot.addEventListener("click", function (event) {
      if (event.target.closest(".spot__pop")) return;
      if (event.target.closest(".spot__marker")) return;
      closePop();

      var rect = spot.getBoundingClientRect();
      var x = ((event.clientX - rect.left) / rect.width) * 100;
      var y = ((event.clientY - rect.top) / rect.height) * 100;

      count += 1;
      var marker = document.createElement("span");
      marker.className = "spot__marker";
      marker.textContent = count;
      marker.style.left = x + "%";
      marker.style.top = y + "%";
      spot.appendChild(marker);

      pop = document.createElement("div");
      pop.className = "spot__pop";
      pop.style.left = x + "%";
      pop.style.top = y + "%";
      pop.innerHTML =
        '<input type="text" placeholder="Что изменить в этом месте?" aria-label="Правка для точки ' + count + '">' +
        '<div class="chips">' +
          '<button class="chip" type="button">Убрать</button>' +
          '<button class="chip" type="button">Светлее</button>' +
          '<button class="chip" type="button">Добавить пар</button>' +
        "</div>";
      spot.appendChild(pop);

      var input = pop.querySelector("input");
      input.focus();

      function submit(text) {
        if (!text) return;
        addEdit(spot, count, text);
        closePop();
      }

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") submit(input.value.trim());
        if (e.key === "Escape") {
          marker.remove();
          count -= 1;
          closePop();
        }
      });
      pop.addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (chip) submit(chip.textContent.trim());
      });
    });
  });

  // Правка уходит в список «Правки по точкам» со статусом «в работе»
  function addEdit(spot, number, text) {
    var list = document.querySelector(spot.getAttribute("data-edits"));
    if (!list) return;
    var row = document.createElement("div");
    row.className = "edit";
    row.innerHTML =
      '<span class="spot__marker">' + number + "</span>" +
      "<div><b></b><br><span class=\"pill pill--work\"><span class=\"spinner\"></span>Лев перерисовывает</span></div>";
    row.querySelector("b").textContent = text;
    list.appendChild(row);
    toast("Правка №" + number + " отправлена Льву. Можно отметить ещё точки — он сделает всё разом.");
  }

  // ---------- 4. Фильтры ----------
  document.querySelectorAll(".filters").forEach(function (group) {
    var scope = document.querySelector(group.getAttribute("data-scope")) || document;
    group.addEventListener("click", function (event) {
      var btn = event.target.closest(".filter");
      if (!btn) return;
      group.querySelectorAll(".filter").forEach(function (f) {
        f.classList.toggle("is-active", f === btn);
      });
      var value = btn.getAttribute("data-filter");
      scope.querySelectorAll("[data-owner]").forEach(function (item) {
        var owners = item.getAttribute("data-owner").split(" ");
        item.classList.toggle("is-filtered-out", value !== "all" && owners.indexOf(value) === -1);
      });
    });
  });

  // ---------- 5. Инициативность ----------
  var LEVELS = [
    { max: 20, name: "Только по просьбе", text: "Выполняет поставленные задачи и ничего не предлагает сам." },
    { max: 50, name: "Подсказывает", text: "Предлагает следующий шаг после каждой задачи: «текст готов — сделать картинку?»." },
    { max: 80, name: "Инициативный", text: "Сам замечает поводы и предлагает задачи на главной: праздники, паузы в публикациях, удачные посты." },
    { max: 100, name: "Проактивный", text: "Готовит черновики заранее, не дожидаясь просьбы, — вам остаётся одобрить или отклонить." }
  ];

  document.querySelectorAll("input[data-initiative]").forEach(function (range) {
    var box = range.closest(".initiative");
    function update() {
      var v = Number(range.value);
      var level = LEVELS.filter(function (l) { return v <= l.max; })[0];
      box.querySelector(".initiative__level").textContent = level.name;
      box.querySelector(".initiative__desc").textContent = level.text;
    }
    range.addEventListener("input", update);
    update();
  });

  // ---------- 6. «Позже» ----------
  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-dismiss]");
    if (!btn) return;
    var card = btn.closest(".proposal");
    if (!card) return;
    card.classList.add("is-dismissed");
    setTimeout(function () { card.remove(); }, 200);
    toast("Хорошо, напомню завтра утром.");
  });

  // ---------- 7. Выбор вариантов ----------
  document.addEventListener("click", function (event) {
    var choice = event.target.closest(".choice");
    if (choice) choice.classList.toggle("is-selected");

    var skill = event.target.closest(".skill:not(.skill--add)");
    if (skill) skill.classList.toggle("is-on");

    var variant = event.target.closest(".variant");
    if (variant) {
      variant.parentElement.querySelectorAll(".variant").forEach(function (v) {
        v.classList.toggle("is-selected", v === variant);
      });
    }
  });

  // ---------- 8. Вопросы «в один клик» (Память, недостающие данные) ----------
  document.addEventListener("click", function (event) {
    var chip = event.target.closest(".question .chip");
    if (!chip) return;
    var question = chip.closest(".question");
    var answer = chip.textContent.trim();
    question.querySelector(".chips").outerHTML =
      '<span class="pill pill--ok">Ответ: ' + answer.replace(/</g, "&lt;") + "</span>";
    toast("Запомнили. Помощники учтут это в следующих задачах.");
  });

  // ---------- Всплывающее сообщение ----------
  var toastEl = null;
  var toastTimer = null;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-shown"); }, 3200);
  }
  window.cfToast = toast;
})();
