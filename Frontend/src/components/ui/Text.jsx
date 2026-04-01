import { StyleSheet, Text as RNText } from 'react-native';
import { colors } from '@/src/constants/colors';
import { fonts } from '@/src/constants/theme';
const variantStyles = {
    title: { fontSize: 24, lineHeight: 30, fontWeight: '700', fontFamily: fonts?.display },
    subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', fontFamily: fonts?.display },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '500', fontFamily: fonts?.text },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', fontFamily: fonts?.text },
    label: { fontSize: 13, lineHeight: 18, fontWeight: '600', fontFamily: fonts?.rounded },
};
const colorStyles = {
    default: { color: colors.text },
    muted: { color: colors.textMuted },
    primary: { color: colors.primary },
    white: { color: colors.surface },
};
export function Text({ children, variant = 'body', color = 'default', style, numberOfLines, }) {
    return (<RNText numberOfLines={numberOfLines} style={[styles.base, variantStyles[variant], colorStyles[color], style]}>
      {children}
    </RNText>);
}
const styles = StyleSheet.create({
    base: {
        includeFontPadding: false,
    },
});
export default Text;

