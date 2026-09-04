import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

export function ZoryqLogo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 34 : 44;
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { width: size, height: size, borderRadius: compact ? 11 : 14 }]}>
        <View style={styles.orbit} />
        <Text style={[styles.z, { fontSize: compact ? 22 : 29 }]}>Z</Text>
        <View style={styles.spark} />
      </View>
      <Text style={compact ? styles.wordSmall : styles.word}>
        ZO<Text style={styles.cyan}>R</Text>YQ
      </Text>
    </View>
  );
}

type LogoStyles = {
  row: ViewStyle;
  mark: ViewStyle;
  orbit: ViewStyle;
  z: TextStyle;
  spark: ViewStyle;
  word: TextStyle;
  wordSmall: TextStyle;
  cyan: TextStyle;
};

const styles = StyleSheet.create<LogoStyles>({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: {
    backgroundColor: '#12091F',
    borderWidth: 1,
    borderColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 7
  },
  orbit: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.cyan,
    opacity: 0.72,
    transform: [{ rotate: '-28deg' }]
  },
  z: { color: colors.purple, fontWeight: '900', fontStyle: 'italic', lineHeight: 31 },
  spark: {
    position: 'absolute',
    top: 4,
    right: 7,
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: colors.lime
  },
  word: { color: colors.text, fontSize: 25, fontWeight: '900', letterSpacing: 4 },
  wordSmall: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  cyan: { color: colors.cyan }
});
