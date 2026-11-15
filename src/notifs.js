// Notifications locales : programmées sur le téléphone, elles marchent sans internet.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { today, addDays, diffDays, isArchived } from './logic';
import { wakeCfg, wakePlan } from './alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

const CHANNEL = 'rappels';

export async function askPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rappels de révision', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.status === 'granted') return true;
  const r = await Notifications.requestPermissionsAsync();
  return r.status === 'granted';
}

// Reprogramme les rappels des 7 prochains jours (appelé à l'ouverture, en quittant l'appli, après une session...).
export async function reschedule(S) {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) { if (n.content && n.content.data && n.content.data.daily) await Notifications.cancelScheduledNotificationAsync(n.identifier); }
    const set = S.settings || {};
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;
    await scheduleWake(S);
    if (!set.notifOn) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Rappels de révision', importance: Notifications.AndroidImportance.HIGH });
    }
    const [h, m] = (set.notifTime || '18:00').split(':').map((x) => parseInt(x, 10));
    const t = today();
    const chs = Object.values(S.chs || {}).filter((c) => !isArchived(c));
    const matName = (c) => ((S.profil.matieres || []).find((x) => x.id === c.matiereId) || {}).nom || '';
    for (let d = 0; d < 7; d++) {
      const day = addDays(t, d);
      if (d === 0 && S.profil.lastDay === t) continue; // session déjà faite aujourd'hui
      const date = new Date(day + 'T12:00:00');
      date.setHours(isNaN(h) ? 18 : h, isNaN(m) ? 0 : m, 0, 0);
      if (date.getTime() <= Date.now() + 60000) continue;
      const soon = chs.filter((c) => c.ds && diffDays(day, c.ds) >= 0 && diffDays(day, c.ds) <= 3)
        .sort((a, b) => (a.ds < b.ds ? -1 : 1));
      let title = '📚 C\'est l\'heure de réviser';
      let body = (S.profil.streak || 0) > 0 && d === 0
        ? `Ta session du jour t'attend. Garde ta série de ${S.profil.streak} jour${S.profil.streak > 1 ? 's' : ''} 🔥`
        : 'Ta session du jour t\'attend : 10 minutes suffisent 🔥';
      if (soon.length) {
        const c = soon[0]; const n = diffDays(day, c.ds);
        title = n === 0 ? `🚨 DS aujourd'hui : ${matName(c)}` : n === 1 ? `⏰ DS demain : ${matName(c)}` : `📅 DS dans ${n} jours : ${matName(c)}`;
        body = `Révise « ${c.titre} ». Ta session met l'accent dessus.`;
      }
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { daily: true } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
      });
    }
  } catch (e) {
    // Les rappels ne doivent jamais bloquer l'appli.
  }
}

export async function testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: { title: '📚 Test réussi', body: 'Les rappels de révision fonctionnent.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}

// Minuteur de travail (méthode Pomodoro) : prévient à la fin, même si l'appli est fermée.
export async function scheduleTimer(seconds, title, body) {
  try {
    if (!(await askPermission())) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: CHANNEL },
    });
  } catch (e) { return null; }
}
export async function cancelTimer(id) {
  try { if (id) await Notifications.cancelScheduledNotificationAsync(id); } catch (e) {}
}

// Réveil et départ calés sur le premier cours (7 prochains jours)
const WAKE = 'reveil';
async function scheduleWake(S) {
  const c = wakeCfg();
  if (!c.on || !S.pronote || (!c.notif && !c.depart)) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(WAKE, {
      name: 'Réveil', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 600, 400, 600, 400, 600], enableVibrate: true,
    });
  }
  const now = Date.now();
  for (let d = 0; d < 7; d++) {
    const p = wakePlan(addDays(today(), d));
    if (!p) continue;
    const where = p.lesson.room ? ` en ${p.lesson.room}` : '';
    if (c.notif && p.wake.getTime() > now + 60000) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `⏰ Debout ! Il est ${p.label.wake}`, body: `${p.lesson.subject} à ${p.label.start}${where}. Départ à ${p.label.depart}.`, data: { daily: true, wake: true }, sound: 'default', priority: 'max' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.wake, channelId: WAKE },
      });
    }
    if (c.depart && p.depart.getTime() > now + 60000) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "🚌 C'est l'heure de partir !", body: `${p.lesson.subject} à ${p.label.start}${where}.`, data: { daily: true, wake: true }, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.depart, channelId: WAKE },
      });
    }
  }
}
