import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count >= 2 else {
  FileHandle.standardError.write(Data("Usage: swift ocr-image.swift <image-path>\n".utf8))
  exit(2)
}

let imagePath = CommandLine.arguments[1]
let imageUrl = URL(fileURLWithPath: imagePath)

guard let image = NSImage(contentsOf: imageUrl) else {
  FileHandle.standardError.write(Data("Unable to open image\n".utf8))
  exit(3)
}

var rect = CGRect(origin: .zero, size: image.size)
guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
  FileHandle.standardError.write(Data("Unable to create CGImage\n".utf8))
  exit(4)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

let lines = (request.results ?? [])
  .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
  .filter { !$0.isEmpty }

print(lines.joined(separator: "\n"))
