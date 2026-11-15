package expo.modules.reveil

import android.content.Intent
import android.provider.AlarmClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Crée un vrai réveil dans l'appli Horloge du téléphone (Android).
// Les heures sont passées en Int : c'est ce qu'attend l'Horloge (Linking.sendIntent envoie des Double).
class ReveilModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Reveil")

    Function("setAlarm") { hour: Int, minutes: Int, message: String, skipUi: Boolean ->
      val activity = appContext.currentActivity ?: throw IllegalStateException("Appli pas au premier plan")
      val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
        putExtra(AlarmClock.EXTRA_HOUR, hour)
        putExtra(AlarmClock.EXTRA_MINUTES, minutes)
        putExtra(AlarmClock.EXTRA_MESSAGE, message)
        putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi)
        putExtra(AlarmClock.EXTRA_VIBRATE, true)
      }
      activity.startActivity(intent)
      true
    }

    Function("showAlarms") {
      val activity = appContext.currentActivity ?: throw IllegalStateException("Appli pas au premier plan")
      activity.startActivity(Intent(AlarmClock.ACTION_SHOW_ALARMS))
      true
    }
  }
}
