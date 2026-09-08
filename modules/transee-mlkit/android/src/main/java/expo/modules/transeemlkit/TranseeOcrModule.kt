package expo.modules.transeemlkit

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Text recognition from a captured image, over Google ML Kit.
 *
 * Lives beside the translation module because it is the same SDK and the same
 * Gradle project; it is a separate Expo module class because it is a separate
 * capability, and a screen that scans has no business holding a translator.
 *
 * The Latin model is **bundled into the APK**, so recognition runs entirely on
 * the device with no download and no network. That is a real guarantee here,
 * unlike speech recognition, and unlike translation it needs no language pack.
 * The cost is that only Latin script is recognised: the Chinese, Devanagari,
 * Japanese and Korean models are separate artifacts and are not included.
 *
 * Nothing here logs the image or the recognised text.
 */
class TranseeOcrModule : Module() {

  /**
   * One recogniser, reused. Building it is the expensive part and it holds no
   * per-request state; `close` releases the native resources on teardown.
   */
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  override fun definition() = ModuleDefinition {
    Name("TranseeOcr")

    /**
     * Recognises text in the image at `uri`.
     *
     * Boxes are returned as fractions of the image rather than pixels, so an
     * overlay can be drawn at any display size without the caller needing to
     * know the capture resolution.
     */
    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(CodedException("ocr_unavailable", "No application context.", null))
        return@AsyncFunction
      }

      try {
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        val width = image.width.toFloat()
        val height = image.height.toFloat()

        recognizer.process(image)
          .addOnSuccessListener { result ->
            val blocks = result.textBlocks.map { block ->
              val frame = block.boundingBox
              mapOf(
                "text" to block.text,
                // A block without a frame is possible; zeroes are honest here
                // because the caller treats an empty box as "no position".
                "x" to (frame?.left?.toFloat()?.div(width) ?: 0f),
                "y" to (frame?.top?.toFloat()?.div(height) ?: 0f),
                "width" to (frame?.width()?.toFloat()?.div(width) ?: 0f),
                "height" to (frame?.height()?.toFloat()?.div(height) ?: 0f),
              )
            }

            promise.resolve(mapOf("text" to result.text, "blocks" to blocks))
          }
          .addOnFailureListener { error ->
            // The message can quote what was recognised, so only a code crosses.
            promise.reject(CodedException("ocr_failed", error.message, error))
          }
      } catch (error: Exception) {
        // Most often an unreadable or missing file.
        promise.reject(CodedException("ocr_image_unreadable", error.message, error))
      }
    }

    OnDestroy {
      recognizer.close()
    }
  }
}
