import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { fonts } from '@/src/constants/theme';
import { authPalette } from './AuthScreenFrame';
export default function AuthField({ label, icon, secureTextEntry, style, ...props }) {
    const [focused, setFocused] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const showPasswordToggle = Boolean(secureTextEntry);
    return (<View style={styles.field}>
      <Text style={styles.label} variant="caption">
        {label}
      </Text>

      <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
        <Ionicons color={authPalette.accent} name={icon} size={18}/>
        <TextInput {...props} onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
        }} onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
        }} placeholderTextColor="#85A0C8" secureTextEntry={secureTextEntry && !passwordVisible} selectionColor={authPalette.accent} style={[styles.input, style]}/>

        {showPasswordToggle ? (<Pressable accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={() => setPasswordVisible((current) => !current)} style={styles.toggle}>
            <Ionicons color="#6E89AF" name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={18}/>
          </Pressable>) : null}
      </View>
    </View>);
}
const styles = StyleSheet.create({
    field: {
        gap: 8,
    },
    label: {
        color: authPalette.muted,
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.2,
    },
    inputShell: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 18,
        paddingHorizontal: 18,
        backgroundColor: authPalette.input,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputShellFocused: {
        borderColor: authPalette.border,
        backgroundColor: '#F4F8FF',
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        color: authPalette.inputText,
        fontSize: 15,
        lineHeight: 20,
        fontFamily: fonts?.text,
    },
    toggle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

