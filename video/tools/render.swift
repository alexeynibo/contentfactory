// Склейка демо-видео ContentFactory: кадры сцен + наезды камеры + подписи + голос.
// Использование: render <scenes.json> <video-only.mp4> <final.mp4>
import Foundation
import AVFoundation
import CoreGraphics
import CoreText
import ImageIO

struct Key: Decodable { let t: Double; let pos: [Double]?; let click: Bool; let drag: Bool }
struct Cursor: Decodable { let start: [Double]; let fadeIn: Bool; let keys: [Key] }
struct StateAt: Decodable { let k: Int; let t: Double; let fade: Double }
struct Shot: Decodable { let img: String; let off: Double }
struct Scroll: Decodable { let state: Int; let region: [Double]; let from: Double; let to: Double; let t0: Double; let t1: Double; let shots: [Shot] }
struct Scene: Decodable {
    let id: String; let title: String; let audio: String
    let duration: Double; let from: [Double]; let to: [Double]; let cam: [Double]; let cont: Bool
    let images: [String]; let states: [StateAt]; let scroll: Scroll?; let cursor: Cursor?
}
struct Config: Decodable { let width: Int; let height: Int; let fps: Int; let scenes: [Scene] }

let args = CommandLine.arguments
let cfg = try JSONDecoder().decode(Config.self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let W = cfg.width, H = cfg.height, FPS = cfg.fps
let videoURL = URL(fileURLWithPath: args[2]), finalURL = URL(fileURLWithPath: args[3])
try? FileManager.default.removeItem(at: videoURL)
try? FileManager.default.removeItem(at: finalURL)

func loadImage(_ path: String) -> CGImage {
    let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
    return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}
// Держим в памяти только несколько последних снимков — у ползунка их десятки
var cache: [String: CGImage] = [:], cacheOrder: [String] = []
func image(_ path: String) -> CGImage {
    if let i = cache[path] { return i }
    let i = loadImage(path); cache[path] = i; cacheOrder.append(path)
    if cacheOrder.count > 6 { cache.removeValue(forKey: cacheOrder.removeFirst()) }
    return i
}
func clamp(_ v: Double) -> Double { min(1, max(0, v)) }
func ease(_ t: Double) -> Double { t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2 }

// ---------- Видео ----------
let writer = try AVAssetWriter(outputURL: videoURL, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 3_500_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let font = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 22, nil)
func drawTitle(_ ctx: CGContext, _ text: String, alpha: CGFloat) {
    guard alpha > 0 else { return }
    let attr = NSAttributedString(string: text, attributes: [
        kCTFontAttributeName as NSAttributedString.Key: font,
        kCTForegroundColorAttributeName as NSAttributedString.Key: CGColor(red: 1, green: 1, blue: 1, alpha: alpha)])
    let line = CTLineCreateWithAttributedString(attr)
    let tw = CTLineGetTypographicBounds(line, nil, nil, nil)
    let padX = 22.0, h = 48.0, w = tw + padX * 2
    let x = (Double(W) - w) / 2, y = 36.0
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -4), blur: 18, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.25 * alpha))
    ctx.setFillColor(CGColor(red: 34 / 255, green: 42 / 255, blue: 57 / 255, alpha: 0.88 * alpha))
    ctx.addPath(CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerWidth: h / 2, cornerHeight: h / 2, transform: nil))
    ctx.fillPath()
    ctx.restoreGState()
    ctx.textPosition = CGPoint(x: x + padX, y: y + 16)
    CTLineDraw(line, ctx)
}

// ---------- Курсор ----------
let azure = (r: 33.0 / 255, g: 143.0 / 255, b: 253.0 / 255)
func cursorPath() -> CGPath {
    // стрелка как в macOS, кончик в (0,0), ось y вниз
    let p = CGMutablePath()
    p.addLines(between: [CGPoint(x: 0, y: 0), CGPoint(x: 0, y: 16.5), CGPoint(x: 3.9, y: 12.8), CGPoint(x: 6.6, y: 19),
                         CGPoint(x: 9.3, y: 17.9), CGPoint(x: 6.7, y: 11.9), CGPoint(x: 12, y: 11.9)])
    p.closeSubpath(); return p
}
let arrow = cursorPath()
func drawCursor(_ ctx: CGContext, at p: CGPoint, size k: Double, pressed: Bool, alpha: Double) {
    guard alpha > 0 else { return }
    ctx.saveGState()
    ctx.setAlpha(CGFloat(alpha))
    ctx.translateBy(x: p.x, y: p.y)
    let z = k * (pressed ? 0.88 : 1)
    ctx.scaleBy(x: CGFloat(z), y: CGFloat(-z))
    ctx.setShadow(offset: CGSize(width: 0, height: -1.5), blur: 4, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.35))
    ctx.addPath(arrow); ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.setLineWidth(3.2); ctx.setStrokeColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.setLineJoin(.round)
    ctx.drawPath(using: .fillStroke)
    ctx.setShadow(offset: .zero, blur: 0, color: nil)
    ctx.addPath(arrow); ctx.setFillColor(CGColor(red: 0.07, green: 0.07, blue: 0.08, alpha: 1)); ctx.fillPath()
    ctx.restoreGState()
}
func drawRipple(_ ctx: CGContext, at p: CGPoint, size k: Double, age: Double) {
    let q = age / 0.45; guard q >= 0, q < 1 else { return }
    let e = 1 - pow(1 - q, 2), r = (8 + 26 * e) * k, a = 0.5 * (1 - q)
    let rect = CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)
    ctx.setFillColor(CGColor(red: azure.r, green: azure.g, blue: azure.b, alpha: a * 0.35)); ctx.fillEllipse(in: rect)
    ctx.setStrokeColor(CGColor(red: azure.r, green: azure.g, blue: azure.b, alpha: a)); ctx.setLineWidth(2 * k); ctx.strokeEllipse(in: rect)
}
// Положение курсора в момент t (координаты страницы): между точками — плавный переезд, при перетаскивании — равномерно
func cursorAt(_ c: Cursor, _ t: Double) -> [Double] {
    var p = c.start, prevT = 0.0, prevDrag = false
    for k in c.keys {
        let q = k.pos ?? p
        if t >= k.t { p = q; prevT = k.t; prevDrag = k.drag; continue }
        let dist = hypot(q[0] - p[0], q[1] - p[1])
        let linear = k.drag && prevDrag
        let ts = linear ? prevT : max(prevT, k.t - min(0.95, 0.4 + dist / 1500))
        if t <= ts || dist < 0.5 { return p }
        let u = (t - ts) / (k.t - ts), e = linear ? u : ease(u)
        return [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e]
    }
    return p
}
func pressedAt(_ c: Cursor, _ t: Double) -> Bool {
    let drags = c.keys.filter { $0.drag }
    if let a = drags.first, let b = drags.last, t >= a.t, t <= b.t + 0.1 { return true }
    return c.keys.contains { $0.click && t >= $0.t - 0.05 && t < $0.t + 0.16 }
}

var frameIndex: Int64 = 0
var prevLast: CGImage? = nil
let fadeFrames = 12
var starts: [Double] = []

for (k, sc) in cfg.scenes.enumerated() {
    starts.append(Double(frameIndex) / Double(FPS))
    let nextCont = k + 1 < cfg.scenes.count && cfg.scenes[k + 1].cont
    let scale = Double(image(sc.images[0]).width) / Double(W) // 2 — кадры сняты в двойном разрешении
    // Снимки прокрутки — только область, которая прокручивается
    var shots: [(CGImage, Double)] = []
    if let sr = sc.scroll {
        let r = sr.region
        for sh in sr.shots {
            let crop = loadImage(sh.img).cropping(to: CGRect(x: r[0] * scale, y: r[1] * scale, width: (r[2] - r[0]) * scale, height: (r[3] - r[1]) * scale))!
            shots.append((crop, sh.off))
        }
    }
    let n = max(2, Int((sc.duration * Double(FPS)).rounded()))
    var last: CGImage? = nil
    for i in 0..<n {
        let t = Double(i) / Double(FPS)
        let p = ease(clamp((t - sc.cam[0]) / max(0.01, sc.cam[1] - sc.cam[0])))
        let r = (0..<4).map { sc.from[$0] + (sc.to[$0] - sc.from[$0]) * p } // x, y, w, h в CSS-пикселях
        let s = Double(W) / r[2]
        // прямоугольник страницы (CSS) → прямоугольник кадра
        func place(_ x: Double, _ y: Double, _ w: Double, _ h: Double) -> CGRect {
            CGRect(x: (x - r[0]) * s, y: Double(H) - (y + h - r[1]) * s, width: w * s, height: h * s)
        }
        func point(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: (x - r[0]) * s, y: Double(H) - (y - r[1]) * s) }
        var pb: CVPixelBuffer? = nil
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
        CVPixelBufferLockBaseAddress(pb!, [])
        let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8,
                            bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
        ctx.interpolationQuality = .high
        ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        // Текущее состояние экрана и мягкая смена на следующее
        var cur = 0, prevState = 0, fadeA = 1.0
        for st in sc.states where t >= st.t {
            prevState = cur; cur = st.k
            fadeA = st.fade > 0 ? clamp((t - st.t) / st.fade) : 1
        }
        let full = place(0, 0, Double(W), Double(H))
        if fadeA < 1 { ctx.draw(image(sc.images[prevState]), in: full) }
        ctx.saveGState(); ctx.setAlpha(CGFloat(fadeA)); ctx.draw(image(sc.images[cur]), in: full); ctx.restoreGState()
        // Прокрутка: область склеивается из снимков, остальное (меню, чат) стоит на месте
        if let sr = sc.scroll, cur == sr.state, t >= sr.t0 {
            let off = sr.from + (sr.to - sr.from) * ease(clamp((t - sr.t0) / max(0.01, sr.t1 - sr.t0)))
            let g = sr.region, rw = g[2] - g[0], rh = g[3] - g[1]
            ctx.saveGState()
            ctx.clip(to: place(g[0], g[1], rw, rh))
            ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(place(g[0], g[1], rw, rh))
            for (img, o) in shots.sorted(by: { abs($0.1 - off) > abs($1.1 - off) }) {
                ctx.draw(img, in: place(g[0], g[1] + (o - off), rw, rh))
            }
            ctx.restoreGState()
        }
        // Наплыв из предыдущей сцены
        if k > 0, i < fadeFrames, let prev = prevLast {
            ctx.saveGState(); ctx.setAlpha(1 - CGFloat(i) / CGFloat(fadeFrames))
            ctx.draw(prev, in: CGRect(x: 0, y: 0, width: W, height: H)); ctx.restoreGState()
        }
        let left = Double(n - i) / Double(FPS)
        if i == n - 1 { last = ctx.makeImage() } // последний кадр без курсора и подписи — для наплыва
        // Курсор: появляется в начале новой сцены, исчезает перед сменой кадра
        if let c = sc.cursor {
            let q = cursorAt(c, t), pt = point(q[0], q[1])
            let size = 1.1 * min(s, 1.7)
            for key in c.keys where key.click { drawRipple(ctx, at: point(key.pos![0], key.pos![1]), size: size, age: t - key.t) }
            let aIn = c.fadeIn ? clamp((t - 0.2) / 0.35) : 1
            let aOut = nextCont ? 1 : clamp((left - 0.15) / 0.35)
            drawCursor(ctx, at: pt, size: size, pressed: pressedAt(c, t), alpha: min(aIn, aOut))
        }
        // Подпись появляется через 0,3 с и исчезает за 0,4 с до конца
        let a = min(1, max(0, (t - 0.3) / 0.35), max(0, left - 0.1) / 0.4)
        drawTitle(ctx, sc.title, alpha: CGFloat(a))
        CVPixelBufferUnlockBaseAddress(pb!, [])
        while !input.isReadyForMoreMediaData { usleep(2000) }
        adaptor.append(pb!, withPresentationTime: CMTime(value: frameIndex, timescale: CMTimeScale(FPS)))
        frameIndex += 1
    }
    prevLast = last
    print("сцена \(k + 1)/\(cfg.scenes.count) \(sc.id): \(n) кадров"); fflush(stdout)
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("видео без звука: \(Double(frameIndex) / Double(FPS)) с")

// ---------- Звук: голос каждой сцены с паузой 0,4 с от начала сцены ----------
let comp = AVMutableComposition()
let vAsset = AVURLAsset(url: videoURL)
let vTrack = vAsset.tracks(withMediaType: .video)[0]
let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try cv.insertTimeRange(CMTimeRange(start: .zero, duration: vAsset.duration), of: vTrack, at: .zero)
let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
for (k, sc) in cfg.scenes.enumerated() {
    let a = AVURLAsset(url: URL(fileURLWithPath: sc.audio))
    guard let t = a.tracks(withMediaType: .audio).first else { continue }
    let at = CMTime(seconds: starts[k] + 0.4, preferredTimescale: 600)
    try ca.insertTimeRange(CMTimeRange(start: .zero, duration: a.duration), of: t, at: at)
}
let exp = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough)!
exp.outputURL = finalURL
exp.outputFileType = .mp4
exp.exportAsynchronously { done.signal() }
done.wait()
print("экспорт: \(exp.status == .completed ? "готово" : "ошибка \(String(describing: exp.error))")")
