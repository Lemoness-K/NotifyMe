package app.notifyme.client

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class ProtectedState(context: Context) {
    private val preferences = context.getSharedPreferences("notify-device", Context.MODE_PRIVATE)

    private fun key(): SecretKey = synchronized(lock) {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey) ?: KeyGenerator.getInstance("AES", "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build())
            generateKey()
        }
    }

    fun read(name: String): JSONObject {
        val value = preferences.getString(name, null) ?: return JSONObject()
        val data = Base64.decode(value, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, data.copyOfRange(0, 12)))
        cipher.updateAAD(name.toByteArray())
        return JSONObject(cipher.doFinal(data.copyOfRange(12, data.size)).toString(Charsets.UTF_8))
    }

    fun write(name: String, value: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        cipher.updateAAD(name.toByteArray())
        val data = cipher.iv + cipher.doFinal(value.toString().toByteArray())
        check(preferences.edit().putString(name, Base64.encodeToString(data, Base64.NO_WRAP)).commit())
    }

    private companion object {
        const val alias = "notify-device-state-v1"
        val lock = Any()
    }
}
