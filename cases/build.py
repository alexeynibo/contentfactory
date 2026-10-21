"""Создаёт страницы-оболочки кейсов клиентов: cases/<id>/*.html.

Содержимое страниц — в cases/<id>/data.js, рисует его js/case.js.
Запуск из папки проекта:  python3 cases/build.py
Новый помощник у клиента — добавьте его id в TEAM ниже и перезапустите.
"""
import os

# id кейса → помощники (их страницы)
TEAM = {
    "pulse": ["marketer", "designer", "clients", "financier", "hr"],
    "smile": ["clients", "marketer", "financier", "assistant"],
    "bereg": ["clients", "marketer", "designer", "financier"],
    "travy": ["designer", "marketer", "clients", "financier"],
}
# раздел → файл (как у кофейни)
COMMON = {"home": "index", "images": "images", "text": "texts", "analytics": "analytics",
          "memory": "memory", "settings": "settings", "account": "account", "pricing": "pricing"}

SHELL = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ContentFactory</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap">
  <link rel="stylesheet" href="../../css/tokens.css?v=202610212003">
  <link rel="stylesheet" href="../../css/styles.css?v=202610212003">
  <link rel="stylesheet" href="../../css/workspace.css?v=202610212003">
</head>
<!-- Страница-оболочка: содержимое — в data.js, рисует ../../js/case.js. Создана cases/build.py -->
<body data-page="{page}">
  <div id="cf-app"></div>

  <script src="data.js?v=202610212003"></script>
  <script src="../../js/case.js?v=202610212003"></script>
  <script src="../../js/sidebar.js?v=202610212003"></script>
  <script src="../../js/chips.js?v=202610212003"></script>
  <script src="../../js/workspace.js?v=202610212003"></script>
  <script src="../../js/chat.js?v=202610212003"></script>
</body>
</html>
"""

here = os.path.dirname(os.path.abspath(__file__))
for case, team in TEAM.items():
    folder = os.path.join(here, case)
    os.makedirs(folder, exist_ok=True)
    pages = dict(COMMON, **{t: t for t in team})
    for page, name in pages.items():
        with open(os.path.join(folder, name + ".html"), "w", encoding="utf-8") as f:
            f.write(SHELL.format(page=page))
    print(case, len(pages), "страниц")
