import AVFoundation
import ImageIO
import UniformTypeIdentifiers
let a = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
print("длительность:", String(format: "%.1f", a.duration.seconds), "с")
for t in a.tracks { print("дорожка:", t.mediaType.rawValue, String(format: "%.1f с", t.timeRange.duration.seconds), t.naturalSize) }
let g = AVAssetImageGenerator(asset: a); g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
for s in CommandLine.arguments.dropFirst(2) {
  let img = try g.copyCGImage(at: CMTime(seconds: Double(s)!, preferredTimescale: 600), actualTime: nil)
  let url = URL(fileURLWithPath: CommandLine.arguments[1] + "-" + s + ".png")
  let d = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(d, img, nil); CGImageDestinationFinalize(d)
}
print("размер файла:", (try! FileManager.default.attributesOfItem(atPath: CommandLine.arguments[1])[.size] as! Int) / 1_000_000, "МБ")
