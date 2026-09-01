package expo.modules.transeemlkit

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ConcurrentHashMap

/**
 * On-device translation, over Google ML Kit.
 *
 * Deliberately small. It exposes only what `OfflineTranslationEngine` needs and
 * nothing more: which languages exist, which models are downloaded, download
 * and delete, and translate. Any policy — routing, pair readiness, retries —
 * stays in TypeScript, where it is testable.
 *
 * ML Kit keys models by language rather than by pair, so a translation needs
 * both models present. That asymmetry is reflected in the API below and
 * resolved by the TypeScript layer.
 *
 * No credential is involved: ML Kit downloads models through Play services.
 * Nothing here logs the text being translated.
 */
class TranseeMlKitModule : Module() {

  /**
   * Translators are expensive to build and cheap to reuse, so one is kept per
   * source/target pair. `close()` releases the native resources; failing to do
   * so leaks them, which is why `closeAll` exists and OnDestroy calls it.
   */
  private val translators = ConcurrentHashMap<String, Translator>()

  private val modelManager: RemoteModelManager by lazy { RemoteModelManager.getInstance() }

  private fun key(source: String, target: String) = "$source|$target"

  private fun translatorFor(source: String, target: String): Translator =
    translators.getOrPut(key(source, target)) {
      val options = TranslatorOptions.Builder()
        .setSourceLanguage(source)
        .setTargetLanguage(target)
        .build()
      Translation.getClient(options)
    }

  override fun definition() = ModuleDefinition {
    Name("TranseeMlKit")

    /** Every language ML Kit can translate, as BCP-47 codes. */
    Function("getSupportedLanguages") {
      TranslateLanguage.getAllLanguages()
    }

    /**
     * Codes whose model is downloaded and ready to use offline.
     *
     * This is ML Kit's own answer, not a cache of ours: the user can clear app
     * data or Play services can evict a model, and only ML Kit knows.
     */
    AsyncFunction("getDownloadedLanguages") { promise: Promise ->
      modelManager.getDownloadedModels(TranslateRemoteModel::class.java)
        .addOnSuccessListener { models -> promise.resolve(models.map { it.language }) }
        .addOnFailureListener { error ->
          promise.reject(CodedException("model_query_failed", error.message, error))
        }
    }

    /**
     * Downloads one language model.
     *
     * ML Kit reports completion, not progress: there is no byte count and no
     * percentage available from the API. The TypeScript layer represents that
     * honestly rather than inventing a progress bar.
     */
    AsyncFunction("downloadModel") { language: String, requireWifi: Boolean, promise: Promise ->
      val model = TranslateRemoteModel.Builder(language).build()
      val conditions = DownloadConditions.Builder()
        .apply { if (requireWifi) requireWifi() }
        .build()

      modelManager.download(model, conditions)
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { error ->
          promise.reject(CodedException("model_download_failed", error.message, error))
        }
    }

    /** Deletes a downloaded model, reclaiming its space. */
    AsyncFunction("deleteModel") { language: String, promise: Promise ->
      val model = TranslateRemoteModel.Builder(language).build()
      modelManager.deleteDownloadedModel(model)
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { error ->
          promise.reject(CodedException("model_delete_failed", error.message, error))
        }
    }

    /**
     * Translates using models that are already on the device.
     *
     * It deliberately does **not** call `downloadModelIfNeeded`: that would fetch
     * a missing model mid-translation, which is a network call the user did not
     * ask for and the opposite of what offline mode promises. If a model is
     * absent the translation simply fails, and downloading stays an explicit
     * action through `downloadModel`. The TypeScript layer checks both models
     * first; this is the backstop that makes the guarantee hold even if some
     * future caller forgets.
     */
    AsyncFunction("translate") { source: String, target: String, text: String, promise: Promise ->
      translatorFor(source, target).translate(text)
        .addOnSuccessListener { translated -> promise.resolve(translated) }
        .addOnFailureListener { error ->
          // The message can echo the input, so only the code crosses over.
          promise.reject(CodedException("translate_failed", error.message, error))
        }
    }

    /** Releases one pair's translator. The model stays downloaded. */
    AsyncFunction("closeTranslator") { source: String, target: String, promise: Promise ->
      translators.remove(key(source, target))?.close()
      promise.resolve(null)
    }

    /** Releases every translator, so native resources are not leaked. */
    AsyncFunction("closeAll") { promise: Promise ->
      translators.values.forEach { it.close() }
      translators.clear()
      promise.resolve(null)
    }

    OnDestroy {
      translators.values.forEach { it.close() }
      translators.clear()
    }
  }
}
