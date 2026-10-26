// Turns macos/icon-source.png (square artwork) into macos/AppIcon.png: the
// macOS app icon shape, an 824 px rounded square centred on a 1024 px
// transparent canvas (Apple's icon grid).
//   swift macos/make-icon.swift
import AppKit

let size = 1024.0, inset = 100.0, radius = 185.0
let source = NSImage(contentsOfFile: "macos/icon-source.png")!

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current?.imageInterpolation = .high
let tile = NSRect(x: inset, y: inset, width: size - 2 * inset, height: size - 2 * inset)
NSBezierPath(roundedRect: tile, xRadius: radius, yRadius: radius).addClip()
source.draw(in: tile)
NSGraphicsContext.restoreGraphicsState()

try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "macos/AppIcon.png"))
print("macos/AppIcon.png")
