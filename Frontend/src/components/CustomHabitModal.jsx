import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View, } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import PrimaryButton from '@/src/components/PrimaryButton';
import SecondaryButton from '@/src/components/SecondaryButton';
export default function CustomHabitModal({ visible, initialValue = '', onClose, onSave }) {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (visible) {
            setValue(initialValue);
            setError(null);
        }
    }, [initialValue, visible]);
    const handleSave = () => {
        const trimmed = value.trim();
        if (!trimmed) {
            setError('Please enter a habit name.');
            return;
        }
        onSave(trimmed);
    };
    return (<Modal animationType="fade" transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.overlay}/>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.card}>
          <View style={styles.textWrap}>
            <Text variant="subtitle">Create your own habit</Text>
            <Text variant="body" color="muted">
              Give it a short, friendly name so it feels easy to keep.
            </Text>
          </View>

          <View style={styles.inputWrap}>
            <Text variant="caption" color="muted">
              Habit name
            </Text>
            <TextInput autoFocus onChangeText={(text) => {
            setValue(text);
            if (error) {
                setError(null);
            }
        }} placeholder="Read 10 pages" placeholderTextColor="#9CA3AF" style={styles.input} value={value}/>
            {error ? (<Text variant="caption" style={styles.errorText}>
                {error}
              </Text>) : null}
          </View>

          <View style={styles.actions}>
            <PrimaryButton label="Save habit" onPress={handleSave}/>
            <SecondaryButton label="Cancel" onPress={onClose}/>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>);
}
const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
    modalWrap: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        padding: spacing.lg,
        gap: spacing.lg,
    },
    textWrap: {
        gap: spacing.xs,
    },
    inputWrap: {
        gap: spacing.xs,
    },
    input: {
        minHeight: 52,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.md,
        color: colors.text,
    },
    errorText: {
        color: colors.danger,
    },
    actions: {
        gap: spacing.xs,
    },
});

