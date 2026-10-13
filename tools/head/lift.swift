import Vision
import CoreImage
import AppKit
let args = CommandLine.arguments
let input = CIImage(contentsOf: URL(fileURLWithPath: args[1]))!
let handler = VNImageRequestHandler(ciImage: input)
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
let result = request.results!.first!
let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
let out = CIImage(cvPixelBuffer: buffer)
let ctx = CIContext()
try ctx.writePNGRepresentation(of: out, to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
