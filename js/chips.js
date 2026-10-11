/* =========================================================
   Ряды чипсов (.chips)
   1. Колесо мыши над рядом прокручивает его вбок.
   2. Нажатие на чипсу подставляет её текст в поле ввода чата.
   3. Ширина чипсов округляется до целых пикселей — иначе правый край
      пунктирной обводки попадает между пикселями и выглядит бледным.
   Подключение: <script src="js/chips.js"></script> в конце body.
   ========================================================= */

(function () {
  document.querySelectorAll(".chips").forEach(function (row) {
    // 1. Прокрутка колесом мыши
    row.addEventListener("wheel", function (event) {
      // Свайп вбок на трекпаде браузер обрабатывает сам
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      // Ряд целиком помещается — прокручивать нечего
      if (row.scrollWidth <= row.clientWidth) return;

      row.scrollLeft += event.deltaY;
      event.preventDefault(); // не прокручивать при этом чат
    }, { passive: false });

    // 2. Подстановка текста в поле ввода (и для чипсов под полем,
    //    и для вариантов ответа внутри сообщений)
    var chat = row.closest(".chat");
    var input = chat && chat.querySelector(".chat__input");

    row.addEventListener("click", function (event) {
      var chip = event.target.closest(".chip");
      if (!chip || !input) return;

      input.value = chip.textContent.trim();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      // курсор — в конец текста, чтобы можно было сразу дописать
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  // 3. Целая ширина чипсов (после загрузки шрифта — от него зависит ширина)
  function snapChipWidths() {
    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.style.width = "";
      var width = chip.getBoundingClientRect().width;
      // Чипса в скрытом чате имеет ширину 0 — её посчитаем, когда чат откроют
      if (width > 0) chip.style.width = Math.ceil(width) + "px";
    });
  }

  // Вызывается при переключении чатов задач (js/workspace.js)
  window.cfSnapChips = snapChipWidths;

  snapChipWidths();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(snapChipWidths);
  }
})();
