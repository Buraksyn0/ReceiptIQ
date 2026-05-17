import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s, vs, ms } from '../Constants/Responsive';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Burada Sentry / Crashlytics gibi bir servise log gönderilebilir
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* İkon */}
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={ms(64)} color="#008080" />
          </View>

          {/* Başlık */}
          <Text style={styles.title}>Bir şeyler ters gitti</Text>
          <Text style={styles.subtitle}>
            Beklenmedik bir hata oluştu. Endişelenme, verileriniz güvende.
          </Text>

          {/* Hata detayı (sadece dev modunda) */}
          {__DEV__ && this.state.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText} numberOfLines={4}>
                {this.state.error.toString()}
              </Text>
            </View>
          )}

          {/* Yeniden dene butonu */}
          <TouchableOpacity style={styles.btn} onPress={this.handleReset} activeOpacity={0.85}>
            <Ionicons name="refresh" size={ms(20)} color="#fff" style={{ marginRight: s(8) }} />
            <Text style={styles.btnText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(32),
  },
  iconWrap: {
    width: s(110),
    height: s(110),
    borderRadius: s(32),
    backgroundColor: '#008080' + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(28),
  },
  title: {
    fontSize: ms(24),
    fontWeight: '800',
    color: '#1A1D1E',
    marginBottom: vs(12),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: ms(15),
    color: '#718096',
    textAlign: 'center',
    lineHeight: ms(22),
    marginBottom: vs(32),
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#FFF5F5',
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: '#FED7D7',
    padding: s(14),
    marginBottom: vs(24),
  },
  errorText: {
    fontSize: ms(12),
    color: '#C53030',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#008080',
    paddingHorizontal: s(36),
    paddingVertical: vs(16),
    borderRadius: s(20),
    elevation: 4,
    shadowColor: '#008080',
    shadowOpacity: 0.25,
    shadowRadius: s(8),
  },
  btnText: {
    color: '#fff',
    fontSize: ms(17),
    fontWeight: '700',
  },
});

export default ErrorBoundary;
