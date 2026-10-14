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
# CF_TTS=say (по умолчанию) — встроенный голос macOS Milena
TTS = os.environ.get("CF_TTS", "say")
VOICE = os.environ.get("CF_VOICE", "alena")
CREDS = os.environ.get("CF_CREDENTIALS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../credentials.md"))

def yandex_key():
    for line in open(CREDS, encoding="utf-8"):
        if "API key: AQVN" in line:
            return line.split("API key:", 1)[1].strip()
    raise SystemExit("Нет ключа Yandex SpeechKit в credentials.md")

def speak(text, base, m4a):
    if TTS == "yandex":
        r = subprocess.run(["curl", "-s", "--max-time", "90", "-o", base + ".mp3", "-w", "%{http_code}",
                            "-X", "POST", "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize",
                            "-H", "Authorization: Api-Key " + yandex_key(),
                            "--data-urlencode", "text=" + text, "-d", "lang=ru-RU", "-d", "voice=" + VOICE,
                            "-d", "format=mp3"], capture_output=True, text=True)
        if r.stdout != "200":
            raise SystemExit(f"SpeechKit ответил {r.stdout}: " + open(base + ".mp3", errors="ignore").read()[:200])
        src = base + ".mp3"
    else:
        src = base + ".aiff"
        subprocess.run(["say", "-v", "Milena", "-r", "172", "-o", src, text], check=True)
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

out = []
for sid, title, move, focus, text in SCENES:
    url = "http://localhost:8080/_video/director.html?s=" + sid
    png = f"{V}/frames/{sid}.png"
    subprocess.run([CH, *BASE, "--force-device-scale-factor=2", "--screenshot=" + png, url], capture_output=True)
    dom = subprocess.run([CH, *BASE, "--dump-dom", url], capture_output=True, text=True).stdout
    m = re.search(r'<pre id="out">([^<]*)', dom)
    info = json.loads(m.group(1)) if m and m.group(1) != "pending" else {}
    f = focus or info.get("focus")
    full = [0, 0, W, H]
    target = fit(f) if f else [72, 45, 1296, 810]
    if move == "in":   a, b = full, target
    elif move == "out": a, b = target, full
    else:              a, b = full, [36, 22.5, 1368, 855]
    m4a = f"{V}/audio/{sid}.m4a"
    if not (REUSE_AUDIO and os.path.exists(m4a)):
        speak(text, f"{V}/audio/{sid}", m4a)
    dur = float(re.search(r"estimated duration: ([\d.]+)", subprocess.run(["afinfo", m4a], capture_output=True, text=True).stdout).group(1))
    out.append({"id": sid, "title": title, "image": png, "audio": m4a, "speech": round(dur, 2),
                "duration": round(dur + 1.1, 2), "from": a, "to": b, "focusFound": bool(f)})
    print(f"{sid:11s} речь {dur:5.1f} c  фокус {'да' if f else 'НЕТ'}  {os.path.getsize(png)//1024} КБ", flush=True)
json.dump({"width": W, "height": H, "fps": 30, "scenes": out}, open(f"{V}/scenes.json", "w"), ensure_ascii=False, indent=1)
print("всего:", round(sum(s["duration"] for s in out), 1), "c")
