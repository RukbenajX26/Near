import React, { useState } from 'react';
import { ScrollView, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateSelector } from './src/components/DateSelector';
import { CelestialBackdrop } from './src/components/CelestialArt';
import {
  CompletionModal,
  CompletionResult,
} from './src/components/CompletionModal';
import { FileOperations } from './src/components/FileOperations';
import { Header } from './src/components/Header';
import { HeroSection } from './src/components/HeroSection';
import { KeyDisplay } from './src/components/KeyDisplay';
import { ModeToggle } from './src/components/ModeToggle';
import { PositionsView } from './src/components/PositionsView';
import { ProgressModal } from './src/components/ProgressModal';
import { SettingsModal } from './src/components/SettingsModal';
import { useAppState } from './src/hooks/useAppState';
import { useTheme } from './src/hooks/useTheme';
import { styles } from './src/styles/appStyles';

function App() {
  const { dark, themeChoice, setThemeChoice, colors } = useTheme(
    useColorScheme(),
  );
  const [keyReady, setKeyReady] = useState(false);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const {
    date,
    setDate,
    mode,
    setMode,
    file,
    setFile,
    folderUri,
    setFolderUri,
    processing,
    setProcessing,
    showSettings,
    setShowSettings,
  } = useAppState();

  const resetSelections = () => {
    setDate(new Date());
    setFile(null);
    setFolderUri('');
    setKeyReady(false);
    setCompletion(null);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <CelestialBackdrop colors={colors} dark={dark} />
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Header
        dark={dark}
        colors={colors}
        onSettingsPress={() => setShowSettings(true)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroSection dark={dark} colors={colors} />
        <ModeToggle
          colors={colors}
          mode={mode}
          onModeChange={nextMode => {
            setMode(nextMode);
            setKeyReady(false);
          }}
        />
        <DateSelector
          colors={colors}
          date={date}
          onCompute={() => setKeyReady(true)}
          onDateChange={nextDate => {
            setDate(nextDate);
            setKeyReady(false);
          }}
        />
        {keyReady ? <KeyDisplay date={date} colors={colors} /> : null}
        {keyReady ? <PositionsView date={date} colors={colors} /> : null}
        <FileOperations
          colors={colors}
          date={date}
          file={file}
          folderUri={folderUri}
          keyReady={keyReady}
          mode={mode}
          onFileSelect={setFile}
          onFolderSelect={setFolderUri}
          onResetSelections={resetSelections}
          onComplete={setCompletion}
          onProcessEnd={() => setProcessing(false)}
          onProcessStart={() => {
            setCompletion(null);
            setProcessing(true);
          }}
        />
      </ScrollView>
      <SettingsModal
        colors={colors}
        onClose={() => setShowSettings(false)}
        onThemeChange={setThemeChoice}
        themeChoice={themeChoice}
        visible={showSettings}
      />
      <ProgressModal dark={dark} mode={mode} visible={processing} />
      <CompletionModal
        dark={dark}
        onClose={() => setCompletion(null)}
        result={completion}
        visible={completion !== null}
      />
    </SafeAreaView>
  );
}

export default App;
