import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';
import {BUTTON_NAME, ENDPOINT_CONFIG} from './src/config';

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>SUPERNOTE FRAMEWORK</Text>
        <Text style={styles.title}>Endpoint Lasso</Text>
        <Text style={styles.paragraph}>
          This plugin is intended to run headlessly from the lasso toolbar. Use it as a shareable
          framework for sending Supernote lasso selections to your own HTTP endpoint.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Build</Text>
          <Text style={styles.cardLine}>Button: {BUTTON_NAME}</Text>
          <Text style={styles.cardLine}>Format: {ENDPOINT_CONFIG.requestFormat}</Text>
          <Text style={styles.cardLine}>
            Page PNG: {ENDPOINT_CONFIG.includePagePng ? 'enabled' : 'disabled'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Build Flow</Text>
        <Text style={styles.paragraph}>
          1. Copy `.env.example` to `.env`.
        </Text>
        <Text style={styles.paragraph}>
          2. Set `SN_ENDPOINT_URL` and any optional auth headers.
        </Text>
        <Text style={styles.paragraph}>
          3. Run `npm run build:plugin` to generate `src/runtimeConfig.js` and package the plugin.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f1e8',
  },
  content: {
    padding: 24,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#666055',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#27231d',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d4cbbc',
    borderRadius: 18,
    backgroundColor: '#fcfaf4',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  cardLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#27231d',
    marginBottom: 4,
  },
});

export default App;
