import subprocess, json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scenes import SCENES
V = os.environ.get("CF_VIDEO_BUILD", os.path.join(os.path.dirname(os.path.abspath(__file__)), "build"))
for sub in ("frames", "audio", "chrome-profile"): os.makedirs(os.path.join(V, sub), exist_ok=True)
CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=" + V + "/chrome-profile",
        "--window-size=1440,900", "--virtual-time-budget=6000"]
W, H, AR = 1440, 900, 1440 / 900

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
    aiff, m4a = f"{V}/audio/{sid}.aiff", f"{V}/audio/{sid}.m4a"
    subprocess.run(["say", "-v", "Milena", "-r", "172", "-o", aiff, text], check=True)
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac@44100", aiff, m4a], check=True)
    dur = float(re.search(r"estimated duration: ([\d.]+)", subprocess.run(["afinfo", m4a], capture_output=True, text=True).stdout).group(1))
    out.append({"id": sid, "title": title, "image": png, "audio": m4a, "speech": round(dur, 2),
                "duration": round(dur + 1.1, 2), "from": a, "to": b, "focusFound": bool(f)})
    print(f"{sid:11s} речь {dur:5.1f} c  фокус {'да' if f else 'НЕТ'}  {os.path.getsize(png)//1024} КБ", flush=True)
json.dump({"width": W, "height": H, "fps": 30, "scenes": out}, open(f"{V}/scenes.json", "w"), ensure_ascii=False, indent=1)
print("всего:", round(sum(s["duration"] for s in out), 1), "c")
