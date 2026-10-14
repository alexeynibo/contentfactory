// Склейка демо-видео ContentFactory: кадры сцен + наезды камеры + подписи + голос.
// Использование: render <scenes.json> <video-only.mp4> <final.mp4>
import Foundation
import AVFoundation
import CoreGraphics
import CoreText
import ImageIO

struct Scene: Decodable {
    let id: String; let title: String; let image: String; let audio: String
    let duration: Double; let from: [Double]; let to: [Double]
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

var frameIndex: Int64 = 0
var prevLast: CGImage? = nil
let fadeFrames = 12
var starts: [Double] = []

for (k, sc) in cfg.scenes.enumerated() {
    starts.append(Double(frameIndex) / Double(FPS))
    let img = loadImage(sc.image)
    let scale = Double(img.width) / Double(W) // 2 — кадры сняты в двойном разрешении
    let n = max(2, Int((sc.duration * Double(FPS)).rounded()))
    var last: CGImage? = nil
    for i in 0..<n {
        let p = ease(Double(i) / Double(n - 1))
        let r = (0..<4).map { sc.from[$0] + (sc.to[$0] - sc.from[$0]) * p } // x, y, w, h в CSS-пикселях
        let s = Double(W) / r[2]
        var pb: CVPixelBuffer? = nil
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
        CVPixelBufferLockBaseAddress(pb!, [])
        let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8,
                            bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
        ctx.interpolationQuality = .high
        ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        let iw = Double(img.width) / scale, ih = Double(img.height) / scale
        ctx.draw(img, in: CGRect(x: -r[0] * s, y: Double(H) - (ih - r[1]) * s, width: iw * s, height: ih * s))
        // Наплыв из предыдущей сцены
        if k > 0, i < fadeFrames, let prev = prevLast {
            ctx.saveGState(); ctx.setAlpha(1 - CGFloat(i) / CGFloat(fadeFrames))
            ctx.draw(prev, in: CGRect(x: 0, y: 0, width: W, height: H)); ctx.restoreGState()
        }
        // Подпись появляется через 0,3 с и исчезает за 0,4 с до конца
        let t = Double(i) / Double(FPS), left = Double(n - i) / Double(FPS)
        let a = min(1, max(0, (t - 0.3) / 0.35), max(0, left - 0.1) / 0.4)
        if i == n - 1 { last = ctx.makeImage() } // последний кадр без подписи — для наплыва
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
