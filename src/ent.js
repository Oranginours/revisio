// Écran de connexion à l'ENT Skolengo (Ma classe en Auvergne-Rhône-Alpes…) pour récupérer les devoirs.
import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Platform } from 'react-native';
import { useApp, Card, Txt, Btn, Row, Input, Err, toast, ask, isWeb } from './ui';
import { S } from './store';
import { searchSchools, startLogin, finishLogin, logoutEnt, fetchEntHomework, REDIRECT } from './skolengo';

// La page de connexion s'affiche dans une WebView : il faut que l'APK installée contienne ce module.
let WebView = null;
try {
  const RN = require('react-native');
  const has = (RN.TurboModuleRegistry && RN.TurboModuleRegistry.get && RN.TurboModuleRegistry.get('RNCWebViewModule'))
    || (RN.NativeModules && RN.NativeModules.RNCWebViewModule)
    || (RN.UIManager && RN.UIManager.hasViewManagerConfig && RN.UIManager.hasViewManagerConfig('RNCWebView'));
  if (has) WebView = require('react-native-webview').WebView;
} catch (e) { WebView = null; } // APK trop ancienne

export function EntSettings() {
  const { C } = useApp();
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [, setT] = useState(0);
  const handled = useRef(false);
  const s = S.sko;

  if (isWeb) return <Card><Txt muted>📚 L'ENT (Skolengo) ne marche que dans l'appli Android : le navigateur bloque la connexion.</Txt></Card>;
  if (!WebView) return <Card><Txt bold>📚 ENT Skolengo</Txt><Txt muted style={{ marginTop: 4 }}>Pour te connecter à l'ENT, installe la nouvelle version de l'appli (nouvelle APK).</Txt></Card>;

  if (s) return (
    <Card>
      <Txt bold>📚 ENT connecté</Txt>
      <Txt muted style={{ marginTop: 2 }}>{s.name || 'Élève'}{s.className ? ` · ${s.className}` : ''} · {s.school.name}</Txt>
      <Txt muted style={{ fontSize: 12, marginTop: 4 }}>Les devoirs du cahier de textes arrivent dans l'onglet Devoirs (marqués « ENT »).{S.cache.hwEntAt ? ` Dernière mise à jour : ${new Date(S.cache.hwEntAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : ''}</Txt>
      <Row style={{ marginTop: 10 }}>
        <Btn small label={busy ? '…' : '🔄 Actualiser'} disabled={busy} onPress={async () => { setBusy(true); try { await fetchEntHomework(); toast(`📚 ${(S.cache.hwEnt || []).length} devoirs récupérés`); } catch (e) { toast(e.message, 'bad'); } setBusy(false); }} />
        <Btn small kind="ghost" label="Se déconnecter" onPress={() => ask("Se déconnecter de l'ENT ?", 'Les devoirs de l\'ENT ne seront plus récupérés.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Déconnecter', style: 'destructive', onPress: () => { logoutEnt(); setT((x) => x + 1); } }])} />
      </Row>
    </Card>
  );

  const search = async () => {
    if (q.trim().length < 3) return setErr('Tape au moins 3 lettres (nom du lycée ou ville).');
    setErr(''); setBusy(true);
    try { const r = await searchSchools(q.trim()); setList(r); if (!r.length) setErr('Aucun établissement trouvé. Essaie le nom de la ville.'); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const choose = async (school) => {
    setErr(''); setBusy(true);
    try { handled.current = false; setUrl(await startLogin(school)); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const onCallback = async (u) => {
    if (handled.current) return;
    handled.current = true;
    setUrl(null); setBusy(true);
    try {
      await finishLogin(u);
      await fetchEntHomework();
      toast(`📚 ENT connecté ! ${(S.cache.hwEnt || []).length} devoirs récupérés`);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Card>
      <Txt bold>📚 ENT Skolengo (Ma classe en Auvergne-Rhône-Alpes…)</Txt>
      <Txt muted style={{ fontSize: 13, marginTop: 4 }}>Pour récupérer les devoirs que les profs mettent dans le cahier de textes de l'ENT. Cherche ton lycée :</Txt>
      <Row style={{ flexWrap: 'nowrap', marginTop: 10 }}>
        <Input style={{ flex: 1 }} value={q} onChangeText={setQ} placeholder="ex. Hippolyte Carnot Roanne" onSubmitEditing={search} />
        <Btn small label="Chercher" disabled={busy} onPress={search} />
      </Row>
      {busy && <ActivityIndicator style={{ marginTop: 10 }} />}
      {(list || []).map((sc) => (
        <Pressable key={sc.id} onPress={() => choose(sc)} style={({ pressed }) => ({ paddingVertical: 11, borderTopWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: C.ink, fontWeight: '800' }}>{sc.name}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{sc.city}</Text>
        </Pressable>
      ))}
      <Err>{err}</Err>
      <Modal visible={!!url} animationType="slide" onRequestClose={() => setUrl(null)}>
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? 30 : 50 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#ddd' }}>
            <Text style={{ flex: 1, fontWeight: '800', fontSize: 16 }}>Connexion à l'ENT</Text>
            <Pressable onPress={() => setUrl(null)} hitSlop={10}><Text style={{ fontSize: 16, color: '#4F46E5', fontWeight: '800' }}>Fermer</Text></Pressable>
          </View>
          {url && (
            <WebView
              source={{ uri: url }}
              incognito
              userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
              originWhitelist={['*']}
              startInLoadingState
              onShouldStartLoadWithRequest={(req) => {
                if (req.url && req.url.startsWith(REDIRECT)) { onCallback(req.url); return false; }
                return true;
              }}
              onNavigationStateChange={(st) => { if (st.url && st.url.startsWith(REDIRECT)) onCallback(st.url); }}
            />
          )}
        </View>
      </Modal>
    </Card>
  );
}
