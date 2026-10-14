import subprocess, json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scenes import SCENES
V = os.environ.get("CF_VIDEO_BUILD", os.path.join(os.path.dirname(os.path.abspath(__file__)), "build"))
import shutil
# Чистый профиль Chrome при каждой съёмке — иначе он берёт старые стили и картинки из кэша
shutil.rmtree(os.path.join(V, "chrome-profile"), ignore_errors=True)
for sub in ("frames", "audio", "chrome-profile"): os.makedirs(os.path.join(V, sub), exist_ok=True)
# CF_REUSE_AUDIO=1 — не озвучивать заново сцены, у которых звук уже есть
REUSE_AUDIO = os.environ.get("CF_REUSE_AUDIO") == "1"
CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=" + V + "/chrome-profile",
        "--window-size=1440,900", "--virtual-time-budget=12000"]
W, H, AR = 1440, 900, 1440 / 900

# ---------- Голос ----------
# CF_TTS=yandex — Yandex SpeechKit (голос CF_VOICE, по умолчанию alena), ключ — из credentials.md
# CF_TTS=elevenlabs — ElevenLabs (голос CF_VOICE_ID, по умолчанию клон Andrey), ключ — из credentials.md;
#   выразительность: CF_EL_STYLE (0–1), стабильность: CF_EL_STABILITY (0–1)
# CF_TTS=say (по умолчанию) — встроенный голос macOS Milena
TTS = os.environ.get("CF_TTS", "say")
VOICE = os.environ.get("CF_VOICE", "alena")
CREDS = os.environ.get("CF_CREDENTIALS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../credentials.md"))

def creds_key(prefix):
    for line in open(CREDS, encoding="utf-8"):
        if "API key: " + prefix in line:
            return line.split("API key:", 1)[1].strip()
    raise SystemExit("Нет ключа " + prefix + "… в credentials.md")

def yandex_key():
    for line in open(CREDS, encoding="utf-8"):
        if "API key: AQVN" in line:
            return line.split("API key:", 1)[1].strip()
    raise SystemExit("Нет ключа Yandex SpeechKit в credentials.md")

def plain(text):
    # без пауз-тегов и знаков ударения — для голосов, которые их не понимают
    return re.sub(r"<break[^>]*/>", " ", text).replace("\u0301", "")

def speak(text, base, m4a):
    if TTS == "elevenlabs":
        body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
                           "voice_settings": {"stability": float(os.environ.get("CF_EL_STABILITY", "0.4")),
                                              "similarity_boost": 0.8,
                                              "style": float(os.environ.get("CF_EL_STYLE", "0.5")),
                                              "use_speaker_boost": True}}, ensure_ascii=False)
        open(base + ".json", "w", encoding="utf-8").write(body)
        voice_id = os.environ.get("CF_VOICE_ID", "3ObM5uISRchrn1Qj7KVQ")
        r = subprocess.run(["curl", "-s", "--max-time", "120", "-o", base + ".mp3", "-w", "%{http_code}", "-X", "POST",
                            "https://api.elevenlabs.io/v1/text-to-speech/" + voice_id + "?output_format=mp3_44100_128",
                            "-H", "xi-api-key: " + creds_key("sk_"), "-H", "Content-Type: application/json",
                            "--data-binary", "@" + base + ".json"], capture_output=True, text=True)
        if r.stdout != "200":
            raise SystemExit(f"ElevenLabs ответил {r.stdout}: " + open(base + ".mp3", errors="ignore").read()[:200])
        src = base + ".mp3"
    elif TTS == "yandex":
        r = subprocess.run(["curl", "-s", "--max-time", "90", "-o", base + ".mp3", "-w", "%{http_code}",
                            "-X", "POST", "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize",
                            "-H", "Authorization: Api-Key " + yandex_key(),
                            "--data-urlencode", "text=" + plain(text), "-d", "lang=ru-RU", "-d", "voice=" + VOICE,
                            "-d", "format=mp3"], capture_output=True, text=True)
        if r.stdout != "200":
            raise SystemExit(f"SpeechKit ответил {r.stdout}: " + open(base + ".mp3", errors="ignore").read()[:200])
        src = base + ".mp3"
    else:
        src = base + ".aiff"
        subprocess.run(["say", "-v", "Milena", "-r", "172", "-o", src, plain(text)], check=True)
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac@44100", src, m4a], check=True)

def fit(rect):
    # прямоугольник с полями 28px, пропорции 16:10, внутри кадра, не меньше 560px
    x0, y0, x1, y1 = rect
    x0, y0, x1, y1 = x0 - 28, y0 - 28, x1 + 28, y1 + 28
    w, h = max(x1 - x0, 560), max(y1 - y0, 350)
    if w / h > AR: h = w / AR
    else: w = h * AR
    w, h = min(w, W), min(h, H)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    x = min(max(cx - w / 2, 0), W - w); y = min(max(cy - h / 2, 0), H - h)
    return [round(x, 1), round(y, 1), round(w, 1), round(h, 1)]

URL = "http://localhost:8080/_video/director.html"

def chrome(args, text=False):
    # фоновый Chrome изредка зависает — ограничиваем время и пробуем ещё раз
    for attempt in range(3):
        try:
            return subprocess.run([CH, *BASE, *args], capture_output=True, text=text, timeout=60).stdout
        except subprocess.TimeoutExpired:
            subprocess.run(["pkill", "-f", V + "/chrome-profile"])
            print("  Chrome завис, повтор", flush=True)
    raise SystemExit("Chrome не отвечает: " + " ".join(args))

def q(sid, k, off):
    return f"?s={sid}&state={k}" + (f"&off={off}" if off is not None else "")

def shot(sid, k=0, off=None):
    # снимок экрана сцены в состоянии k (и с прокруткой off)
    png = f"{V}/frames/{sid}-{k}" + (f"-o{off}" if off is not None else "") + ".png"
    chrome(["--force-device-scale-factor=2", "--screenshot=" + png, URL + q(sid, k, off)])
    return png

def dump(sid, k=0, off=None):
    # что сообщила режиссёрская страница: фокус, цели курсора, прокрутка
    dom = chrome(["--dump-dom", URL + q(sid, k, off)], text=True)
    m = re.search(r'<pre id="out">([^<]*)', dom)
    return json.loads(m.group(1).replace("&amp;", "&")) if m and m.group(1) != "pending" else {}

def shift(p, d=(160, 110)):
    # откуда курсор «въезжает» в сцену
    return [min(max(p[0] + d[0], 20), W - 20), min(max(p[1] + d[1], 20), H - 20)]

# CF_ONLY=mktBack,mktNext — снять только эти сцены (для проверки)
ONLY = [x for x in os.environ.get("CF_ONLY", "").split(",") if x]
out = []
prev = None
for sid, title, move, focus, text in SCENES:
    if ONLY and sid not in ONLY: continue
    # ---------- Голос ----------
    m4a, txt = f"{V}/audio/{sid}.m4a", f"{V}/audio/{sid}.txt"
    same = os.path.exists(m4a) and os.path.exists(txt) and open(txt, encoding="utf-8").read() == TTS + "|" + text
    if not (REUSE_AUDIO and same):
        speak(text, f"{V}/audio/{sid}", m4a)
        open(txt, "w", encoding="utf-8").write(TTS + "|" + text)
    dur = float(re.search(r"estimated duration: ([\d.]+)", subprocess.run(["afinfo", m4a], capture_output=True, text=True).stdout).group(1))
    D = round(dur + 1.1, 2)

    # ---------- Состояния экрана ----------
    infos = [dump(sid, 0)]
    n = infos[0].get("states", 1)
    infos += [dump(sid, k) for k in range(1, n)]
    images = [shot(sid, k) for k in range(n)]
    page = infos[0].get("page")

    # ---------- Прокрутка: снимки с шагом меньше высоты области ----------
    scroll, info_to = None, None
    sc = infos[0].get("scroll")
    if sc:
        ss = sc["state"]; sc = infos[ss]["scroll"]
        a0, b0 = sc["cur"], sc["to"]
        x0, y0, x1, y1 = sc["region"]
        step = (y1 - y0) - 80
        cnt = max(1, -(-abs(b0 - a0) // step))
        offs = [round(a0 + (b0 - a0) * j / cnt) for j in range(cnt + 1)]
        shots = [{"img": images[ss] if j == 0 else shot(sid, ss, o), "off": o} for j, o in enumerate(offs)]
        info_to = dump(sid, ss, b0)
        scroll = {"state": ss, "region": sc["region"], "from": a0, "to": b0,
                  "t0": round(sc["at0"] * D, 2), "t1": round(sc["at1"] * D, 2), "shots": shots}

    # ---------- Камера ----------
    last = info_to if (scroll and scroll["state"] == n - 1) else infos[-1]
    fs = infos[0].get("focusState")
    f = focus or (infos[fs] if fs is not None else last).get("focus")
    full = [0, 0, W, H]
    target = fit(f) if f else [72, 45, 1296, 810]
    if move == "in":   a, b = full, target
    elif move == "out": a, b = target, full
    else:              a, b = full, [36, 22.5, 1368, 855]
    cont = bool(prev and prev["page"] == page)  # та же страница — без смены кадра
    if cont: a = prev["to"]
    cam = [0, D]
    if scroll: cam = [scroll["t0"], min(D, scroll["t1"] + 0.25 * D)]

    # ---------- Курсор и смена состояний ----------
    tl = infos[0].get("timeline", [])
    state, keys, states = 0, [], [{"k": 0, "t": 0, "fade": 0}]
    for i, it in enumerate(tl):
        t = round(it["at"] * D, 2)
        if it["state"] is not None:
            state = it["state"]
            # при перетаскивании ползунок сдвигается на полпути курсора к следующей точке
            ts = (t + keys[-1]["t"]) / 2 if it["drag"] and keys else t + (0.08 if it["click"] else 0)
            states.append({"k": state, "t": round(ts, 2), "fade": 0 if it["drag"] else 0.15})
        pos = None
        if it["hasTarget"]:
            src = infos[state]
            if scroll and state == scroll["state"] and it["at"] >= sc["at1"]: src = info_to
            pos = src.get("targets", {}).get(str(i))
        keys.append({"t": t, "pos": pos, "click": it["click"], "drag": it["drag"]})
    first = next((k["pos"] for k in keys if k["pos"]), None)
    start = prev["cursorEnd"] if cont and prev.get("cursorEnd") else (shift(first) if first else None)
    p = start
    for k in keys:
        if k["pos"] is None: k["pos"] = p
        p = k["pos"]
    cursor = {"start": start, "fadeIn": not (cont and prev.get("cursorEnd")), "keys": keys} if start else None

    rec = {"id": sid, "title": title, "page": page, "audio": m4a, "speech": round(dur, 2), "duration": D,
           "from": a, "to": b, "cam": cam, "cont": cont, "images": images, "states": states,
           "scroll": scroll, "cursor": cursor, "cursorEnd": p if start else None, "focusFound": bool(f)}
    out.append(rec); prev = rec
    print(f"{sid:14s} речь {dur:5.1f} c  состояний {n:2d}  прокрутка {len(scroll['shots']) if scroll else '-'}"
          f"  курсор {len(keys)}  {'продолжение' if cont else 'новый кадр'}  фокус {'да' if f else 'НЕТ'}", flush=True)
json.dump({"width": W, "height": H, "fps": 30, "scenes": out}, open(f"{V}/scenes.json", "w"), ensure_ascii=False, indent=1)
print("всего:", round(sum(s["duration"] for s in out), 1), "c")
