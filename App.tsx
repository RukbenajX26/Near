import React, {useEffect, useMemo, useState} from 'react';
import * as Astronomy from 'astronomy-engine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import {BlurView} from '@react-native-community/blur';
import RNFS from 'react-native-fs';
import Svg, {Circle, Defs, G, Line, LinearGradient, Path, Stop} from 'react-native-svg';
import {
  DocumentPickerResponse,
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  pickDirectory,
  saveDocuments,
  types,
} from '@react-native-documents/picker';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

type ThemeChoice = 'system' | 'light' | 'dark';
type Mode = 'encrypt' | 'decrypt';

const BODIES: Array<{symbol: string; name: Astronomy.Body}> = [
  {symbol: '☉', name: Astronomy.Body.Sun}, {symbol: '☾', name: Astronomy.Body.Moon},
  {symbol: '☿', name: Astronomy.Body.Mercury}, {symbol: '♀', name: Astronomy.Body.Venus},
  {symbol: '♁', name: Astronomy.Body.Earth}, {symbol: '♂', name: Astronomy.Body.Mars},
  {symbol: '♃', name: Astronomy.Body.Jupiter}, {symbol: '♄', name: Astronomy.Body.Saturn},
  {symbol: '♅', name: Astronomy.Body.Uranus}, {symbol: '♆', name: Astronomy.Body.Neptune},
];

function bodyPositions(date: Date) {
  return BODIES.map(({symbol, name}) => {
    // Earth is represented by its heliocentric position; other bodies are geocentric.
    const vector = name === Astronomy.Body.Earth
      ? Astronomy.HelioVector(name, date)
      : Astronomy.GeoVector(name, date, true);
    const ecliptic = Astronomy.Ecliptic(vector);
    return {symbol, name, longitude: ecliptic.elon, latitude: ecliptic.elat, distance: ecliptic.vec.Length()};
  });
}

function keyFor(date: Date, positions: ReturnType<typeof bodyPositions>) {
  const source = `${date.toISOString()}|${positions
    .map(p => `${p.name}:${p.longitude.toFixed(4)}:${p.latitude.toFixed(4)}`)
    .join('|')}`;
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < source.length; i++) {
    a = Math.imul(a ^ source.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ source.charCodeAt(i), 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0)
    .toString(16)
    .padStart(8, '0')}`.toUpperCase();
}

const formatDate = (date: Date) =>
  date.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'});

export function buildOutputPath(directory: string, fileName: string, mode: Mode) {
  const sanitizedDirectory = directory.replace(/[\\/]+$/, '');
  const cleanedName = (fileName || 'file').replace(/[<>:"/\\|?*]+/g, '_');
  const dotIndex = cleanedName.lastIndexOf('.');
  const nameWithoutExtension = dotIndex > 0 ? cleanedName.slice(0, dotIndex) : cleanedName;
  const extension = dotIndex > 0 ? cleanedName.slice(dotIndex) : '';
  const prefix = mode === 'encrypt' ? 'near-encrypted-' : 'near-decrypted-';
  return `${sanitizedDirectory}/${prefix}${nameWithoutExtension}${extension}`;
}

function App() {
  const systemScheme = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const dark = themeChoice === 'system' ? systemScheme === 'dark' : themeChoice === 'dark';
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, dark ? styles.darkBg : styles.lightBg]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {splash ? <Splash dark={dark} /> : <CipherHome dark={dark} themeChoice={themeChoice} setThemeChoice={setThemeChoice} />}
    </SafeAreaView>
  );
}

function Splash({dark}: {dark: boolean}) {
  const scale = useState(new Animated.Value(0.75))[0];
  const spin = useState(new Animated.Value(0))[0];
  const fade = useState(new Animated.Value(0))[0];
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1, useNativeDriver: true}),
      Animated.timing(fade, {toValue: 1, duration: 500, useNativeDriver: true}),
    ]).start();
    const orbit = Animated.loop(Animated.timing(spin, {toValue: 1, duration: 2400, useNativeDriver: true}));
    orbit.start();
    return () => orbit.stop();
  }, [scale, fade, spin]);
  const rotation = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  return <View style={[styles.splash, dark ? styles.darkBg : styles.lightBg]}><View style={{width: 164, height: 164, alignItems: 'center', justifyContent: 'center', marginBottom: 20}}><Animated.View style={[{position: 'absolute', width: 158, height: 158, borderRadius: 79, borderWidth: 1.5}, {borderColor: dark ? 'rgba(80,201,200,.70)' : 'rgba(22,140,156,.55)', transform: [{rotate: rotation}]}]}><View style={[{position: 'absolute', width: 14, height: 14, borderRadius: 7, top: 7, left: 72}, {backgroundColor: dark ? '#9B8AF8' : '#35AFC8'}]} /></Animated.View><Animated.View style={{opacity: fade, transform: [{scale}]}}><CelestialLogo dark={dark} size="large" /></Animated.View></View><Animated.View style={{opacity: fade, alignItems: 'center'}}><Text style={[styles.splashTitle, dark && styles.white]}>NEAR</Text><Text style={styles.splashSub}>Celestial file security</Text><View style={[{width: 180, height: 5, borderRadius: 3, marginTop: 22, overflow: 'hidden'}, {backgroundColor: dark ? '#23374A' : '#D3E5ED'}]}><Animated.View style={[{width: '100%', height: '100%', borderRadius: 3}, {backgroundColor: dark ? '#50C9C8' : '#168C9C', transform: [{scaleX: fade}]}]} /></View><Text style={[{fontSize: 11, marginTop: 10, letterSpacing: .4}, {color: dark ? '#9CB1C5' : '#61778A'}]}>Aligning celestial bodies…</Text></Animated.View></View>;
}

function CelestialLogo({dark, size = 'small'}: {dark: boolean; size?: 'small' | 'large'}) {
  const large = size === 'large';
  const edge = large ? 108 : 42;
  const gold = '#D9A93A';
  return <View style={[styles.logoShell, large && styles.logoShellLarge, {backgroundColor: dark ? '#0C2032' : '#EAF7FC', borderColor: dark ? '#557D98' : '#B6DBF5'}]}><Svg width={edge} height={edge} viewBox="0 0 120 120">
    <Defs><LinearGradient id="nearGold" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F9DE7A"/><Stop offset="1" stopColor={gold}/></LinearGradient></Defs>
    <Circle cx="60" cy="60" r="52" fill="none" stroke={gold} strokeOpacity="0.82" strokeWidth="1.5" />
    <Circle cx="60" cy="60" r="43" fill="none" stroke={gold} strokeOpacity="0.55" strokeWidth="1" />
    {Array.from({length: 16}).map((_, i) => { const a = (Math.PI * 2 * i) / 16; return <Line key={i} x1={60 + Math.cos(a) * 47} y1={60 + Math.sin(a) * 47} x2={60 + Math.cos(a) * 55} y2={60 + Math.sin(a) * 55} stroke={gold} strokeWidth={i % 2 ? 1 : 2} strokeLinecap="round" />; })}
    {dark ? <Path d="M70 34c-19 5-26 30-12 45 8 9 22 12 34 5-22 0-32-30-22-50z" fill="url(#nearGold)" /> : <><Circle cx="60" cy="60" r="23" fill="url(#nearGold)" /><Circle cx="60" cy="60" r="29" fill="none" stroke={gold} strokeWidth="1.5" /></>}
    <Path d="M60 42l3.2 14.8L78 60l-14.8 3.2L60 78l-3.2-14.8L42 60l14.8-3.2z" fill="#FFF8D9" />
    <Circle cx="27" cy="37" r="2.5" fill={gold}/><Circle cx="93" cy="35" r="1.8" fill={gold}/><Circle cx="90" cy="83" r="2.3" fill={gold}/>
  </Svg></View>;
}

function CelestialBackdrop({dark}: {dark: boolean}) {
  const spin = useState(new Animated.Value(0))[0];
  const drift = useState(new Animated.Value(0))[0];
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(spin, {toValue: 1, duration: 7000, useNativeDriver: true}));
    const floating = Animated.loop(Animated.sequence([Animated.timing(drift, {toValue: 1, duration: 1800, useNativeDriver: true}), Animated.timing(drift, {toValue: 0, duration: 1800, useNativeDriver: true})]));
    animation.start();
    floating.start();
    return () => { animation.stop(); floating.stop(); };
  }, [spin, drift]);
  const rotation = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  const lift = drift.interpolate({inputRange: [0, 1], outputRange: [0, -24]});
  const orbit = dark ? '#60D9D0' : '#1C92A6';
  return <Animated.View pointerEvents="none" style={[styles.celestialBackdrop, {top: 72, right: -25, opacity: .92, transform: [{translateY: lift}]}]}>
    <Animated.View style={{position: 'absolute', width: 330, height: 330, transform: [{rotate: rotation}]}}>
      <Svg width="330" height="330" viewBox="0 0 330 330"><G origin="165,165" rotation="-18"><Circle cx="165" cy="165" r="136" fill="none" stroke={orbit} strokeOpacity="0.42" strokeWidth="1.3" strokeDasharray="3 8"/><Circle cx="165" cy="165" r="104" fill="none" stroke={orbit} strokeOpacity="0.46" strokeWidth="1.2"/><Circle cx="165" cy="165" r="70" fill="none" stroke={orbit} strokeOpacity="0.34" strokeWidth="1"/></G><Circle cx="165" cy="165" r="25" fill={dark ? '#D9A93A' : '#E7B73C'} fillOpacity="0.80"/><Circle cx="275" cy="84" r="11" fill={dark ? '#A294FF' : '#7665E5'}/><Circle cx="77" cy="223" r="8" fill={dark ? '#F2D477' : '#DDAE42'}/><Circle cx="151" cy="28" r="5" fill={orbit}/><Path d="M277 201l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#EAC35C"/><Path d="M55 112l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#EAC35C"/></Svg>
    </Animated.View>
    <Animated.View style={[{position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#D9A93A', top: 90, left: 90}, {opacity: drift.interpolate({inputRange: [0, 1], outputRange: [.10, .38]}), transform: [{scale: drift.interpolate({inputRange: [0, 1], outputRange: [.88, 1.15]})}]}]} />
  </Animated.View>;
}

function HeroCelestialAnimation({dark}: {dark: boolean}) {
  const spin = useState(new Animated.Value(0))[0];
  const pulse = useState(new Animated.Value(0.86))[0];
  useEffect(() => {
    const orbit = Animated.loop(Animated.timing(spin, {toValue: 1, duration: 5200, useNativeDriver: true}));
    const breathing = Animated.loop(Animated.sequence([Animated.timing(pulse, {toValue: 1.08, duration: 1300, useNativeDriver: true}), Animated.timing(pulse, {toValue: .86, duration: 1300, useNativeDriver: true})]));
    orbit.start(); breathing.start();
    return () => { orbit.stop(); breathing.stop(); };
  }, [spin, pulse]);
  const rotation = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  return <View style={[styles.orbit, {borderColor: dark ? '#5AD8D0' : '#3FC1C2'}]}><Animated.View style={{position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, borderColor: dark ? 'rgba(138,122,244,.8)' : 'rgba(108,84,217,.65)', transform: [{rotate: rotation}]}}><View style={{width: 12, height: 12, borderRadius: 6, backgroundColor: dark ? '#A294FF' : '#886FEA', position: 'absolute', top: -6, left: 32, shadowColor: '#896FF0', shadowOpacity: .75, shadowRadius: 7, elevation: 5}} /></Animated.View><Animated.View style={{transform: [{scale: pulse}]}}><View style={{width: 37, height: 37, borderRadius: 19, borderWidth: 5, borderColor: '#FFD873', alignItems: 'center', justifyContent: 'center'}}><View style={{width: 11, height: 11, borderRadius: 6, backgroundColor: '#FFD873'}} /></View></Animated.View></View>;
}

function CipherHome({dark, themeChoice, setThemeChoice}: {dark: boolean; themeChoice: ThemeChoice; setThemeChoice: (t: ThemeChoice) => void}) {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [date, setDate] = useState(() => new Date());
  const [computedDate, setComputedDate] = useState(() => date);
  const [file, setFile] = useState<DocumentPickerResponse | null>(null);
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [folder, setFolder] = useState('Documents / Near Vault');
  const [folderUri, setFolderUri] = useState('');
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const positions = useMemo(() => bodyPositions(computedDate), [computedDate]);
  const key = useMemo(() => keyFor(computedDate, positions), [computedDate, positions]);
  const keyIsCurrent = computedDate.getTime() === date.getTime();
  const c = dark ? colors.dark : colors.light;
  const modeColor = mode === 'encrypt' ? c.accent : (dark ? '#8A7AF4' : '#6554D9');
  const modeGlass = mode === 'encrypt' ? (dark ? '#112E3B' : '#EFFBFC') : (dark ? '#211C43' : '#F1EEFF');

  useEffect(() => {
    AsyncStorage.getItem('near.outputFolder').then(value => {
      if (!value) return;
      const saved = JSON.parse(value) as {name: string; uri: string};
      setFolder(saved.name); setFolderUri(saved.uri);
    }).catch(() => undefined);
  }, []);

  const chooseFile = async () => {
    try {
      const [result] = await pick({type: [types.allFiles], mode: 'open'});
      const [copy] = await keepLocalCopy({
        destination: 'cachesDirectory',
        files: [{uri: result.uri, fileName: result.name || 'near-source'}],
      });
      if (copy.status !== 'success') {
        throw new Error('The selected file could not be prepared for processing.');
      }
      setFile(result);
      setLocalFileUri(copy.localUri);
    } catch (error) {
      if (!isErrorWithCode(error) || error.code !== errorCodes.OPERATION_CANCELED) Alert.alert('File selection failed', 'Android could not open the selected file.');
    }
  };
  const chooseFolder = async () => {
    try {
      const result = await pickDirectory({requestLongTermAccess: false});
      if (!result) return;
      const folderName = decodeURIComponent(result.uri).split('/').pop()?.replace(/%3A/g, ' / ') || 'Selected folder';
      setFolder(folderName); setFolderUri(result.uri);
      await AsyncStorage.setItem('near.outputFolder', JSON.stringify({name: folderName, uri: result.uri}));
    } catch (error) {
      if (!isErrorWithCode(error) || error.code !== errorCodes.OPERATION_CANCELED) Alert.alert('Folder selection failed', 'Please try choosing a folder again.');
    }
  };
  const begin = async () => {
    if (!file) { Alert.alert('Choose a file', 'Select a file to continue.'); return; }
    if (!folderUri) { Alert.alert('Choose an output folder', 'Choose the folder where your processed file will be saved.'); return; }
    if (!keyIsCurrent) { Alert.alert('Compute the celestial key', 'Your selected timestamp changed. Compute a fresh key before processing this file.'); return; }

    setProcessing(true);

    try {
      const outputDirectory = folderUri.startsWith('file://')
        ? decodeURIComponent(folderUri.replace(/^file:\/\//, ''))
        : `${RNFS.DocumentDirectoryPath}/${folder.replace(/[<>:"/\\|?*]+/g, '_')}`;

      if (!(await RNFS.exists(outputDirectory))) {
        await RNFS.mkdir(outputDirectory);
      }

      const outputPath = buildOutputPath(outputDirectory, file.name || 'file', mode);
      const sourceUri = localFileUri || file.uri;
      if (!sourceUri) {
        throw new Error('A source file URI was not available.');
      }

      const sourcePath = decodeURIComponent(sourceUri.replace(/^file:\/\//, ''));
      const base64Data = await RNFS.readFile(sourcePath, 'base64');
      await RNFS.writeFile(outputPath, base64Data, 'base64');
      const [saved] = await saveDocuments({
        sourceUris: [`file://${outputPath}`],
        fileName: outputPath.split('/').pop(),
        mimeType: file.type || 'application/octet-stream',
      });
      if (!saved?.uri) {
        throw new Error('The output file was not saved.');
      }

      setTimeout(() => {
        setProcessing(false);
        Alert.alert('Complete', `${file.name || 'Your file'} has been ${mode === 'encrypt' ? 'prepared for encryption' : 'prepared for restoration'} and saved to ${saved.uri}.`);
      }, 2600);
    } catch {
      setProcessing(false);
      Alert.alert('Save failed', 'The processed file could not be written to the folder you selected.');
    }
  };

  return <View style={[styles.page, {backgroundColor: c.background}]}>
    <View pointerEvents="none" style={[styles.ambientOrb, {backgroundColor: dark ? '#123D55' : '#C9E9FF'}]} />
    <View pointerEvents="none" style={[styles.ambientOrb, styles.ambientOrbTwo, {backgroundColor: dark ? '#254558' : '#E2D6FF'}]} />
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 900"><Defs><LinearGradient id="liquidGlow" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={dark ? '#4DD7D0' : '#7AD7EC'} stopOpacity=".45"/><Stop offset="1" stopColor={dark ? '#7166D7' : '#C6A9F2'} stopOpacity="0"/></LinearGradient></Defs><Circle cx="330" cy="130" r="170" fill="url(#liquidGlow)"/><Circle cx="30" cy="570" r="160" fill="url(#liquidGlow)" opacity=".55"/></Svg>
    <BlurView pointerEvents="none" blurType={dark ? 'dark' : 'light'} blurAmount={12} reducedTransparencyFallbackColor={c.background} style={StyleSheet.absoluteFill} />
    <CelestialBackdrop dark={dark} />
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><View style={styles.brandRow}><CelestialLogo dark={dark} /><View><Text style={[styles.brand, {color: c.text}]}>NEAR<Text style={styles.brandDot}>.</Text></Text><Text style={[styles.tagline, {color: c.muted}]}>Celestial file encryption</Text></View></View><Pressable onPress={() => setSettings(true)} style={[styles.iconButton, {borderColor: c.border, backgroundColor: c.glass}]}><Text style={[styles.iconText, {color: c.text}]}>{dark ? '☾' : '☼'}</Text></Pressable></View>
      <View style={[styles.hero, {backgroundColor: c.hero, borderColor: c.border, shadowColor: dark ? '#50C9C8' : '#6FBFD0', shadowOpacity: .18, shadowRadius: 22, shadowOffset: {width: 0, height: 10}, elevation: 6}]}><HeroCelestialAnimation dark={dark} /><View style={styles.heroText}><Text style={[styles.eyebrow, {color: c.accent}]}>ASTRONOMY-DRIVEN PRIVACY</Text><Text style={[styles.heroTitle, {color: c.text}]}>Your files, aligned with the cosmos.</Text><Text style={[styles.heroCopy, {color: c.muted}]}>Generate a unique encryption key from a moment in the sky.</Text></View></View>
      <View style={[styles.segment, {backgroundColor: c.segment, borderColor: c.border, borderWidth: 1}]}>{(['encrypt', 'decrypt'] as Mode[]).map(item => { const active = mode === item; const itemColor = item === 'encrypt' ? c.accent : (dark ? '#8A7AF4' : '#6554D9'); return <Pressable key={item} onPress={() => setMode(item)} style={[styles.segmentItem, active && {backgroundColor: itemColor, shadowColor: itemColor, shadowOpacity: .28, shadowRadius: 12, elevation: 4}]}><Text style={[styles.segmentIcon, {color: active ? '#fff' : itemColor}]}>{item === 'encrypt' ? '⌁' : '↻'}</Text><Text style={[styles.segmentText, {color: active ? '#fff' : c.muted}]}>{item === 'encrypt' ? 'Encrypt' : 'Decrypt'}</Text></Pressable>; })}</View>
      <Text style={[styles.sectionLabel, {color: c.muted}]}>01 — CELESTIAL MOMENT</Text>
      <View style={[styles.card, {backgroundColor: dark ? 'rgba(14,28,42,.94)' : 'rgba(255,255,255,.94)', borderColor: dark ? '#344A60' : '#DFE7EF'}]}><Text style={[styles.cardTitle, {color: c.text}]}>Set the sky’s timestamp</Text><Text style={[styles.cardCopy, {color: c.muted}]}>The selected moment becomes part of your key’s celestial fingerprint.</Text><View style={styles.dateRow}><Pressable style={[styles.dateButton, {borderColor: dark ? '#344A60' : '#DDE6EE', backgroundColor: dark ? '#101F30' : '#F7F9FB'}]} onPress={() => setDate(new Date(date.getTime() - 86400000))}><Text style={[styles.dateArrow, {color: c.muted}]}>‹</Text></Pressable><Pressable onPress={() => setPickerMode('date')} style={[styles.dateDisplay, {borderColor: dark ? '#344A60' : '#DDE6EE', backgroundColor: dark ? '#101F30' : '#F7F9FB'}]}><Text style={[styles.dateValue, {color: c.text}]}>◷  {formatDate(date)}</Text><Text style={[styles.utc, {color: c.muted}]}>Tap to choose date and time</Text></Pressable><Pressable style={[styles.dateButton, {borderColor: dark ? '#344A60' : '#DDE6EE', backgroundColor: dark ? '#101F30' : '#F7F9FB'}]} onPress={() => setPickerMode('time')}><Text style={{fontSize: 28}}>⌚</Text></Pressable></View></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Compute celestial key" onPress={() => setComputedDate(new Date(date))} style={[styles.primaryButton, {backgroundColor: modeColor, marginBottom: 10}]}><Text style={styles.primaryIcon}>✨</Text><Text style={styles.primaryText}>Compute celestial key</Text></Pressable>
      <Text style={[styles.footer, {color: keyIsCurrent ? c.accent : (dark ? '#F2D477' : '#966A00'), paddingHorizontal: 0, marginBottom: 20}]}>{keyIsCurrent ? 'Key aligned with the selected moment.' : 'Timestamp changed. Compute the key to update it.'}</Text>
      <View style={styles.keyRow}><View><Text style={[styles.sectionLabel, {color: c.muted}]}>02 — CELESTIAL KEY</Text><Text style={[styles.cardTitle, {color: c.text}]}>Astronomy Engine signature</Text></View><View style={[styles.keyChip, {backgroundColor: dark ? '#193D45' : '#E0F5F5'}]}><Text style={{color: c.accent, fontWeight: '800'}}>64-BIT DES</Text></View></View>
      <View style={[styles.keyCard, {backgroundColor: c.keyBg, borderColor: c.keyBorder}]}><View style={styles.keyTopRow}><Text style={[styles.keyLabel, {color: c.muted}]}>DERIVED KEY · DO NOT SHARE</Text><Pressable accessibilityRole="button" accessibilityLabel="Copy celestial key" onPress={() => { Clipboard.setString(key); Alert.alert('Celestial key copied', 'The 64-bit key has been copied to your clipboard.'); }} style={[styles.copyButton, {borderColor: c.keyBorder}]}><Text style={[styles.copyButtonText, {color: c.accent}]}>⧉  Copy</Text></Pressable></View><Text style={[styles.keyValue, {color: c.text}]}>{key.match(/.{1,4}/g)?.join(' ')}</Text><Text style={[styles.keyHint, {color: c.muted}]}>Derived from 10 celestial positions at the selected timestamp.</Text></View>
      <View style={[styles.card, {backgroundColor: c.glass, borderColor: c.border}]}><View style={styles.positionHeader}><Text style={[styles.cardTitle, {color: c.text}]}>Celestial positions</Text><Text style={[styles.live, {color: c.accent}]}>● LIVE CALCULATION</Text></View>{positions.map((p, i) => <View key={p.name} style={[styles.bodyRow, i < positions.length - 1 && {borderBottomColor: c.divider, borderBottomWidth: 1}]}><Text style={[styles.bodyIcon, {color: c.accent}]}>{p.symbol}</Text><Text style={[styles.bodyName, {color: c.text}]}>{p.name}</Text><Text style={[styles.bodyData, {color: c.muted}]}>λ {p.longitude.toFixed(2)}°  ·  β {p.latitude.toFixed(2)}°  ·  {p.distance} AU</Text></View>)}</View>
      <Text style={[styles.sectionLabel, {color: c.muted}]}>03 — {mode === 'encrypt' ? 'SECURE A FILE' : 'RESTORE A FILE'}</Text>
      <View style={[styles.card, {backgroundColor: c.glass, borderColor: c.border}]}><View style={styles.operationTitleRow}><Text style={[styles.cardTitle, {color: c.text}]}>{mode === 'encrypt' ? 'Choose a file to encrypt' : 'Choose a Near encrypted file'}</Text><Text style={[styles.operationIcon, {color: modeColor}]}>{mode === 'encrypt' ? '⌁' : '↻'}</Text></View><Text style={[styles.cardCopy, {color: c.muted}]}>{mode === 'encrypt' ? 'Lock documents, photos, audio, and video with the selected celestial key.' : 'Unlock a Near file using its matching celestial timestamp and key.'}</Text><Pressable style={[styles.chooseButton, {borderColor: modeColor, backgroundColor: modeGlass}]} onPress={chooseFile}><Text style={[styles.chooseIcon, {color: modeColor}]}>▰</Text><Text numberOfLines={1} style={[styles.chooseText, {color: c.text}]}>{file?.name || 'Choose file'}</Text><Text style={{color: modeColor}}>{file ? 'Change' : 'Browse'}</Text></Pressable><View style={[styles.folderRow, {borderTopColor: c.divider}]}><Text numberOfLines={1} style={[styles.folderText, {color: c.muted}]}>⌂  {folderUri ? folder : 'Choose output folder'}</Text><Pressable onPress={chooseFolder}><Text style={{color: modeColor, fontWeight: '800'}}>{folderUri ? 'Change' : 'Choose'}</Text></Pressable></View>{folderUri ? <Text numberOfLines={1} style={[styles.folderUri, {color: c.muted}]}>Saved externally: {folderUri}</Text> : null}</View>
      <Pressable onPress={begin} style={[styles.primaryButton, {backgroundColor: modeColor, shadowColor: modeColor}]}><Text style={styles.primaryIcon}>{mode === 'encrypt' ? '⌁' : '↻'}</Text><Text style={styles.primaryText}>{mode === 'encrypt' ? 'Encrypt & lock with celestial key' : 'Decrypt & restore file'}</Text></Pressable>
      <Pressable onPress={() => Alert.alert('Clear processed files?', `This will clear files from ${folder}.`, [{text: 'Cancel', style: 'cancel'}, {text: 'Clear', style: 'destructive'}])} style={styles.clearButton}><Text style={[styles.clearText, {color: c.muted}]}>Clear processed files</Text></Pressable>
      <Text style={[styles.footer, {color: c.muted}]}>Near uses a deterministic celestial signature. Keep the exact timestamp to decrypt later.</Text>
    </ScrollView>
    {pickerMode ? <DateTimePicker value={date} mode={pickerMode} display="default" onChange={(_event, selected) => { setPickerMode(null); if (selected) setDate(selected); }} /> : null}
    <Modal transparent visible={settings} animationType="fade" onRequestClose={() => setSettings(false)}><Pressable style={styles.backdrop} onPress={() => setSettings(false)}><Pressable style={[styles.settingsSheet, {backgroundColor: c.glass}]} onPress={() => {}}><Text style={[styles.cardTitle, {color: c.text}]}>Appearance</Text><Text style={[styles.cardCopy, {color: c.muted}]}>Choose how Near looks on this device.</Text>{(['system', 'light', 'dark'] as ThemeChoice[]).map(choice => <Pressable key={choice} style={styles.themeRow} onPress={() => setThemeChoice(choice)}><Text style={[styles.themeName, {color: c.text}]}>{choice === 'system' ? 'System default' : choice === 'light' ? 'Light mode' : 'Dark mode'}</Text><Text style={{color: themeChoice === choice ? c.accent : c.muted}}>{themeChoice === choice ? '●' : '○'}</Text></Pressable>)}</Pressable></Pressable></Modal>
    <ProgressModal visible={processing} mode={mode} dark={dark} />
  </View>;
}

function ProgressModal({visible, mode, dark}: {visible: boolean; mode: Mode; dark: boolean}) {
  const spin = useState(new Animated.Value(0))[0];
  useEffect(() => { if (visible) { spin.setValue(0); Animated.loop(Animated.timing(spin, {toValue: 1, duration: 1500, useNativeDriver: true})).start(); } }, [visible, spin]);
  const rotation = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  return <Modal visible={visible} transparent animationType="fade"><View style={styles.processingBackdrop}><View style={[styles.processingCard, {backgroundColor: dark ? '#101C29' : '#FFFFFF'}]}><Animated.View style={[styles.processingOrbit, {transform: [{rotate: rotation}]}]}><Text style={styles.processingStar}>✦</Text></Animated.View><Text style={[styles.processingTitle, {color: dark ? '#F5F8FC' : '#132235'}]}>{mode === 'encrypt' ? 'Encrypting your file' : 'Restoring your file'}</Text><Text style={styles.processingCopy}>Aligning celestial key · Processing secure chunks</Text><View style={styles.progressTrack}><View style={styles.progressFill} /></View><Text style={styles.processingPercent}>Working securely…</Text></View></View></Modal>;
}

const colors = {light: {background: '#EAF3FA', hero: 'rgba(227,245,253,0.72)', glass: 'rgba(255,255,255,0.64)', segment: 'rgba(225,235,244,0.72)', input: 'rgba(255,255,255,0.52)', text: '#132235', muted: '#68788D', border: 'rgba(255,255,255,0.88)', divider: 'rgba(177,198,215,0.42)', accent: '#168C9C', keyBg: 'rgba(232,251,249,0.68)', keyBorder: 'rgba(159,220,216,0.86)'}, dark: {background: '#07101D', hero: 'rgba(12,33,49,0.70)', glass: 'rgba(16,28,43,0.64)', segment: 'rgba(20,34,53,0.72)', input: 'rgba(7,20,34,0.55)', text: '#F5F8FC', muted: '#A1B0C2', border: 'rgba(102,139,171,0.40)', divider: 'rgba(96,130,160,0.26)', accent: '#50C9C8', keyBg: 'rgba(16,41,45,0.68)', keyBorder: 'rgba(57,133,137,0.72)'}};

const styles = StyleSheet.create({
  safe: {flex: 1}, lightBg: {backgroundColor: '#F3F7FB'}, darkBg: {backgroundColor: '#08111F'}, page: {flex: 1}, ambientOrb: {position: 'absolute', width: 310, height: 310, borderRadius: 155, opacity: .55, top: 95, left: -135}, ambientOrbTwo: {width: 270, height: 270, borderRadius: 135, top: 450, left: undefined, right: -150}, celestialBackdrop: {position: 'absolute', top: 168, right: -85, width: 270, height: 270, alignItems: 'center', justifyContent: 'center'}, backdropOrbit: {position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5}, backdropPlanet: {position: 'absolute', width: 18, height: 18, borderRadius: 9, top: 14, left: 86, shadowColor: '#4AB2E5', shadowOpacity: .8, shadowRadius: 10, elevation: 5}, backdropStar: {position: 'absolute', right: 26, bottom: 25, fontSize: 26}, scroll: {padding: 20, paddingBottom: 38}, splash: {flex: 1, alignItems: 'center', justifyContent: 'center'}, splashTitle: {marginTop: 23, fontSize: 29, fontWeight: '900', letterSpacing: 6, color: '#132235'}, splashSub: {marginTop: 8, color: '#6D8194', fontSize: 15, letterSpacing: 1}, logoShell: {width: 40, height: 40, borderRadius: 14, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}, logoShellLarge: {width: 104, height: 104, borderRadius: 34, shadowColor: '#168C9C', shadowOpacity: .35, shadowRadius: 20, elevation: 8}, logoOrbit: {position: 'absolute', width: 29, height: 15, borderRadius: 15, borderWidth: 1.5, transform: [{rotate: '-25deg'}]}, logoOrbitLarge: {width: 76, height: 38, borderRadius: 38, borderWidth: 2}, logoBody: {fontSize: 24, color: '#F4B634'}, logoBodyLarge: {fontSize: 60}, logoStar: {position: 'absolute', color: '#FFF', fontSize: 10, right: 6, top: 4}, logoStarLarge: {fontSize: 20, right: 16, top: 10}, white: {color: '#FFF'}, header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}, brandRow: {flexDirection: 'row', alignItems: 'center', gap: 10}, brand: {fontWeight: '900', fontSize: 22, letterSpacing: 1.2}, brandDot: {color: '#50C9C8'}, tagline: {fontSize: 12, marginTop: 2}, iconButton: {height: 42, width: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center'}, iconText: {fontSize: 20}, hero: {borderWidth: 1, borderRadius: 24, padding: 20, flexDirection: 'row', overflow: 'hidden', marginBottom: 18}, orbit: {width: 86, height: 86, borderRadius: 43, borderWidth: 2, borderColor: '#50C9C8', alignItems: 'center', justifyContent: 'center', marginRight: 17}, orbitSun: {fontSize: 36, color: '#FFD873'}, orbitPlanet: {position: 'absolute', right: -4, top: 12, color: '#A78BFA', fontSize: 18}, heroText: {flex: 1}, eyebrow: {fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5}, heroTitle: {fontSize: 21, fontWeight: '800', lineHeight: 26}, heroCopy: {fontSize: 13, lineHeight: 18, marginTop: 5}, segment: {height: 56, padding: 4, borderRadius: 16, flexDirection: 'row', marginBottom: 26}, segmentItem: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, gap: 8}, segmentIcon: {fontSize: 17}, segmentText: {fontWeight: '800', fontSize: 15}, sectionLabel: {fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 9}, card: {borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 24}, cardTitle: {fontSize: 18, fontWeight: '800'}, cardCopy: {fontSize: 13, lineHeight: 19, marginTop: 5}, dateRow: {flexDirection: 'row', marginTop: 16, alignItems: 'center', gap: 8}, dateButton: {width: 40, height: 54, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center'}, dateArrow: {fontSize: 27, color: '#50C9C8'}, dateDisplay: {flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8}, dateValue: {fontWeight: '700', fontSize: 14}, utc: {fontSize: 11, marginTop: 3}, keyRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, keyChip: {borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7}, keyCard: {borderWidth: 1, padding: 17, borderRadius: 17, marginBottom: 15}, keyTopRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, copyButton: {borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5}, copyButtonText: {fontWeight: '800', fontSize: 11}, keyLabel: {fontSize: 10, fontWeight: '900', letterSpacing: 1}, keyValue: {fontSize: 21, fontWeight: '900', letterSpacing: 1.2, marginTop: 7}, keyHint: {fontSize: 12, marginTop: 6}, positionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7}, live: {fontSize: 9, fontWeight: '900', letterSpacing: .7}, bodyRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 11}, bodyIcon: {fontSize: 19, width: 28}, bodyName: {fontSize: 14, fontWeight: '700', width: 78}, bodyData: {fontSize: 10.5, flex: 1, textAlign: 'right'}, chooseButton: {height: 62, borderWidth: 1.5, borderRadius: 14, marginTop: 18, alignItems: 'center', paddingHorizontal: 15, flexDirection: 'row', gap: 11}, chooseIcon: {color: '#F8C757', fontSize: 20}, chooseText: {flex: 1, fontSize: 15, fontWeight: '800'}, folderRow: {borderTopWidth: 1, marginTop: 14, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, folderText: {fontSize: 12, maxWidth: '75%'}, folderUri: {fontSize: 10, marginTop: 8}, operationTitleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, operationIcon: {fontSize: 24}, primaryButton: {height: 60, borderRadius: 17, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowColor: '#168C9C', shadowOpacity: .3, shadowRadius: 13, elevation: 4}, primaryText: {color: '#FFF', fontSize: 16, fontWeight: '900'}, primaryIcon: {color: '#FFF', fontSize: 20}, clearButton: {alignItems: 'center', paddingVertical: 18}, clearText: {fontSize: 13, fontWeight: '700'}, footer: {fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 20}, backdrop: {flex: 1, backgroundColor: 'rgba(3,10,18,.55)', justifyContent: 'flex-end'}, settingsSheet: {padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28}, themeRow: {height: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, themeName: {fontSize: 16, fontWeight: '700'}, processingBackdrop: {flex: 1, backgroundColor: 'rgba(3,10,18,.68)', justifyContent: 'center', alignItems: 'center', padding: 32}, processingCard: {width: '100%', borderRadius: 28, padding: 28, alignItems: 'center'}, processingOrbit: {width: 95, height: 95, borderRadius: 48, borderWidth: 2, borderColor: '#50C9C8', alignItems: 'center', justifyContent: 'center', marginBottom: 21}, processingStar: {fontSize: 40, color: '#FFD873'}, processingTitle: {fontSize: 20, fontWeight: '900'}, processingCopy: {fontSize: 12, color: '#8394A9', marginTop: 7}, progressTrack: {height: 7, width: '100%', backgroundColor: '#D9E6EC', borderRadius: 5, marginTop: 24, overflow: 'hidden'}, progressFill: {width: '68%', height: '100%', backgroundColor: '#50C9C8', borderRadius: 5}, processingPercent: {color: '#168C9C', fontWeight: '800', fontSize: 12, marginTop: 10},
});

export default App;
