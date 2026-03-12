package com.pielarmonia.turnerosalatv

import android.net.Uri

object TurneroConfig {
    const val RECONNECT_DELAY_MS = 5000L

    private val baseUrl: String = BuildConfig.TURNERO_BASE_URL.trim().ifBlank {
        "https://pielarmonia.com"
    }
    private val surfacePath: String = BuildConfig.TURNERO_SURFACE_PATH.trim().ifBlank {
        "/sala-turnos.html"
    }
    private val baseUri: Uri = Uri.parse(baseUrl)
    private val surfaceUri: Uri = Uri.parse("${baseUrl.trimEnd('/')}$surfacePath")

    fun surfaceUrl(): String = surfaceUri.toString()
    fun userAgentSuffix(): String = "TurneroSalaTV/${BuildConfig.VERSION_NAME}"

    fun isAllowedUrl(candidate: String?): Boolean {
        if (candidate.isNullOrBlank()) {
            return false
        }

        val uri = runCatching { Uri.parse(candidate) }.getOrNull() ?: return false
        return uri.scheme == surfaceUri.scheme &&
            uri.host == surfaceUri.host &&
            (uri.port.takeIf { it >= 0 } ?: baseUri.port) == (surfaceUri.port.takeIf { it >= 0 } ?: baseUri.port) &&
            uri.path == surfaceUri.path
    }
}
