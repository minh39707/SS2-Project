import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import PrimaryButton from '@/src/components/PrimaryButton';
import SecondaryButton from '@/src/components/SecondaryButton';
import WheelPicker from '@/src/components/WheelPicker';
import { fromTimePickerParts, toTimePickerParts } from '@/src/utils/onboarding';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const MERIDIEMS = ['AM', 'PM'];

export default function TimePickerModal({ visible, initialTime, onClose, onConfirm }) {
    const [hour, setHour] = useState(7);
    const [minute, setMinute] = useState(0);
    const [meridiem, setMeridiem] = useState('AM');

    useEffect(() => {
        if (!visible) {
            return;
        }
        const parts = toTimePickerParts(initialTime);
        setHour(parts.hour);
        setMinute(parts.minute);
        setMeridiem(parts.meridiem);
    }, [initialTime, visible]);

    return (
        <Modal animationType="fade" transparent visible={visible}>
            <Pressable onPress={onClose} style={styles.overlay} />
            <View style={styles.modalContent}>
                <View style={styles.card}>
                    <Text variant="subtitle" style={styles.title}>
                        Choose reminder time
                    </Text>

                    <View style={styles.pickerRow}>
                        <WheelPicker
                            data={HOURS}
                            label="Hour"
                            onChange={setHour}
                            value={hour}
                        />
                        <WheelPicker
                            data={MINUTES}
                            label="Minute"
                            onChange={setMinute}
                            value={minute}
                        />
                        <WheelPicker
                            data={MERIDIEMS}
                            label="Period"
                            onChange={setMeridiem}
                            value={meridiem}
                        />
                    </View>

                    <View style={styles.actions}>
                        <View style={styles.buttonHalf}>
                            <SecondaryButton label="Cancel" onPress={onClose} />
                        </View>
                        <View style={styles.buttonHalf}>
                            <PrimaryButton
                                label="Confirm"
                                onPress={() => onConfirm(fromTimePickerParts(hour, minute, meridiem))}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    modalContent: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.xl,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 32,
        padding: spacing.xl,
        gap: spacing.xl,
        // Elevation for Android
        elevation: 5,
        // Shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    title: {
        textAlign: 'center',
        fontSize: 20,
        fontWeight: '700',
    },
    pickerRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        height: 180,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    buttonHalf: {
        flex: 1,
    },
});


