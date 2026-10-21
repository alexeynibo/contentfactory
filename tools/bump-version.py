"""Ставит новый номер версии в ссылки на стили и скрипты (…css?v=…, …js?v=…).

Зачем: GitHub Pages разрешает браузерам хранить файлы до 10 минут, и после
публикации страница может открыться со старыми стилями. Новый номер — новый
адрес файла, браузер сразу берёт свежий. Запускать перед каждой публикацией:
    python3 tools/bump-version.py
"""
import os, re, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
version = time.strftime("%Y%m%d%H%M")
# css/…css, js/…js и data.js кейсов — с прежним ?v= или без него
pattern = re.compile(r'((?:href|src)="(?:\.\./\.\./)?(?:css/[\w.-]+\.css|js/[\w.-]+\.js|data\.js))(?:\?v=\d+)?"')

changed = 0
for folder, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in (".git", "video", "docs", "tools")]
    for name in files:
        if not (name.endswith(".html") or name == "build.py"):
            continue
        path = os.path.join(folder, name)
        text = open(path, encoding="utf-8").read()
        new = pattern.sub(lambda m: m.group(1) + "?v=" + version + '"', text)
        if new != text:
            open(path, "w", encoding="utf-8").write(new)
            changed += 1
print("версия", version, "· файлов обновлено:", changed)
