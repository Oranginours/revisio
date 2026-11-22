// Rappels sur le téléphone (Android) : programmés localement, ils marchent même appli fermée.
// Si l'APK installée est trop ancienne (sans le module de notifications), tout est simplement ignoré.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as D from './data';

let N = null;
if (Platform.OS !== 'web') {
  try {
    N = require('expo-notifications');
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  } catch (e) { N = null; }
}
const CH = 'corvees';
export const notifSupported = () => !!N;
export async function notifPrefs() {
  try { return { on: true, hour: 18, ...(JSON.parse((await AsyncStorage.getItem('corveo_notif')) || '{}')) }; } catch (e) { return { on: true, hour: 18 }; }
}
export async function setNotifPrefs(p) { await AsyncStorage.setItem('corveo_notif', JSON.stringify(p)); }

async function permission() {
  if (!N) return false;
  try {
    if (Platform.OS === 'android') await N.setNotificationChannelAsync(CH, { name: 'Tâches de la maison', importance: N.AndroidImportance.HIGH });
    const cur = await N.getPermissionsAsync();
    if (cur.status === 'granted') return true;
    return (await N.requestPermissionsAsync()).status === 'granted';
  } catch (e) { return false; }
}

let last = '';
// Reprogramme les rappels de la semaine pour « actor » (moi, ou le profil sans téléphone choisi)
export async function scheduleFor(week, actor) {
  if (!N || !week || !actor) return;
  const items = D.itemsOf(week, actor.id).filter((it) => D.statusOf(week, it.k) !== 'done');
  const sig = actor.id + '|' + items.map((i) => i.k).join(',');
  if (sig === last) return;
  last = sig;
  try {
    const prefs = await notifPrefs();
    const all = await N.getAllScheduledNotificationsAsync();
    for (const n of all) if (n.content && n.content.data && n.content.data.corveo) await N.cancelScheduledNotificationAsync(n.identifier);
    if (!prefs.on || !items.length) return;
    if (!(await permission())) return;
    const now = new Date();
    const mon = D.mondayOf(now);
    const at = (dayNum, h, m = 0) => { const d = new Date(mon); d.setDate(d.getDate() + dayNum - 1); d.setHours(h, m, 0, 0); return d; };
    const plan = [];
    // le matin : les tâches à faire ce jour-là
    for (let d = 1; d <= 7; d++) {
      const todays = items.filter((it) => it.d === d);
      if (todays.length) plan.push({ date: at(d, 7, 30), title: `📅 Aujourd'hui : ${todays[0].e} ${todays[0].n}`, body: todays.length > 1 ? `+ ${todays.length - 1} autre${todays.length > 2 ? 's' : ''} tâche${todays.length > 2 ? 's' : ''} prévue${todays.length > 2 ? 's' : ''} aujourd'hui.` : 'Prévue pour aujourd\'hui.' });
    }
    // le soir : un rappel mercredi, vendredi, et dimanche (dernier jour)
    const n = items.length;
    [[3, `🧹 Il te reste ${n} tâche${n > 1 ? 's' : ''} cette semaine`, 'Une ou deux ce soir et la barre avance !'],
      [5, `🧹 Encore ${n} tâche${n > 1 ? 's' : ''} à faire`, 'Le week-end arrive : avance-toi.'],
      [7, `⏰ Dernier jour ! ${n} tâche${n > 1 ? 's' : ''} pas faite${n > 1 ? 's' : ''}`, 'Sinon, tâches en plus la semaine prochaine…']].forEach(([d, title, body]) => plan.push({ date: at(d, d === 7 ? 11 : prefs.hour, 0), title, body }));
    for (const p of plan) {
      if (p.date.getTime() < now.getTime() + 60000) continue;
      await N.scheduleNotificationAsync({ content: { title: p.title, body: p.body, data: { corveo: true }, sound: 'default' }, trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CH } });
    }
  } catch (e) { last = ''; }
}
export async function testNotif() {
  if (!N) return false;
  if (!(await permission())) return false;
  await N.scheduleNotificationAsync({ content: { title: '🧹 Corvéo', body: 'Les rappels marchent !', data: { corveo: true } }, trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CH } });
  return true;
}
export const resetNotifSig = () => { last = ''; };
