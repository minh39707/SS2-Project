import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
import { useOnboarding } from '@/src/store/OnboardingContext';
import TimePickerModal from '@/src/components/ui/TimePickerModal';
import { formatTimeLabel } from '@/src/utils/onboarding';
const SHOW_ON_OPTIONS = ['Morning', 'Afternoon', 'Evening'];

export default function CreateHabitFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setHabitSelection } = useOnboarding();

  const habitCategory = params.habitType ?? 'good';
  const isGoodHabit = habitCategory === 'good';

  const [name, setName] = useState('');
  const [repeat] = useState('Everyday');
  const [timesPerDay] = useState(1);
  const [reminders, setReminders] = useState(['09:00']);
  const [showOn, setShowOn] = useState({ Morning: true, Afternoon: true, Evening: true });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingReminderIndex, setEditingReminderIndex] = useState(-1);
  const [error, setError] = useState(null);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a habit name.');
      return;
    }
    setHabitSelection(trimmed, 'custom');
    router.dismiss(2); // Pop both create-habit and create-habit-form
  };

  const addReminder = () => {
    setReminders([...reminders, '09:00']);
  };

  const removeReminder = (index) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  const openTimePicker = (index) => {
    setEditingReminderIndex(index);
    setShowTimePicker(true);
  };

  const handleTimeConfirm = (time) => {
    const updated = [...reminders];
    updated[editingReminderIndex] = time;
    setReminders(updated);
    setShowTimePicker(false);
  };

  const toggleShowOn = (key) => {
    setShowOn((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        >
          <Ionicons color={colors.text} name="close" size={24} />
        </Pressable>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
        >
          <Text variant="label" style={styles.saveBtnText}>
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name Field */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.nameRow}>
          <View style={[styles.nameIcon, { backgroundColor: isGoodHabit ? '#EDF5FF' : '#F1F5F9' }]}>
            <Ionicons
              color={isGoodHabit ? colors.primary : '#64748B'}
              name={isGoodHabit ? 'leaf' : 'ban'}
              size={20}
            />
          </View>
          <TextInput
            autoFocus
            onChangeText={(text) => {
              setName(text);
              if (error) setError(null);
            }}
            placeholder="Name"
            placeholderTextColor="#9CA3AF"
            style={styles.nameInput}
            value={name}
          />
        </Animated.View>

        {error && (
          <Text variant="caption" style={styles.errorText}>
            {error}
          </Text>
        )}

        <View style={styles.divider} />

        {/* Repeat */}
        <Animated.View entering={FadeInDown.duration(420).delay(40)} style={styles.fieldRow}>
          <Ionicons color={colors.text} name="repeat" size={24} />
          <Text variant="subtitle" style={styles.fieldLabel}>
            Repeat {repeat.toLowerCase()}
          </Text>
        </Animated.View>

        <View style={styles.divider} />

        {/* Times per day */}
        <Animated.View entering={FadeInDown.duration(440).delay(80)} style={styles.fieldRow}>
          <Ionicons color={colors.text} name="locate" size={24} />
          <Text variant="subtitle" style={styles.fieldLabel}>
            {timesPerDay} time{timesPerDay > 1 ? 's' : ''} per day
          </Text>
        </Animated.View>

        <View style={styles.divider} />

        {/* Reminders */}
        <Animated.View entering={FadeInDown.duration(460).delay(120)} style={styles.sectionWrap}>
          <View style={styles.fieldRow}>
            <Ionicons color={colors.text} name="notifications-outline" size={24} />
            <Text variant="subtitle" style={styles.fieldLabel}>
              Remind me at
            </Text>
          </View>

          {reminders.map((time, index) => (
            <View key={index} style={styles.reminderRow}>
              <Pressable onPress={() => openTimePicker(index)} style={styles.reminderTime}>
                <Text variant="body">{formatTimeLabel(time)}</Text>
              </Pressable>
              {reminders.length > 1 && (
                <Pressable onPress={() => removeReminder(index)}>
                  <Ionicons color="#94A3B8" name="close" size={20} />
                </Pressable>
              )}
            </View>
          ))}

          <Pressable onPress={addReminder} style={styles.addRow}>
            <Text variant="body" color="primary">
              Add Reminder
            </Text>
            <Ionicons color={colors.primary} name="add" size={20} />
          </Pressable>
        </Animated.View>

        <View style={styles.divider} />

        {/* Show on */}
        <Animated.View entering={FadeInDown.duration(480).delay(160)} style={styles.sectionWrap}>
          <View style={styles.fieldRow}>
            <Ionicons color={colors.text} name="sunny-outline" size={24} />
            <Text variant="subtitle" style={styles.fieldLabel}>
              Show on
            </Text>
          </View>

          {SHOW_ON_OPTIONS.map((option) => (
            <View key={option} style={styles.checkRow}>
              <Switch
                onValueChange={() => toggleShowOn(option)}
                thumbColor={showOn[option] ? colors.primary : '#F4F3F4'}
                trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
                value={showOn[option]}
              />
              <Text variant="body">{option}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <TimePickerModal
        initialTime={editingReminderIndex >= 0 ? reminders[editingReminderIndex] : '09:00'}
        onClose={() => setShowTimePicker(false)}
        onConfirm={handleTimeConfirm}
        visible={showTimePicker}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.xl,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  saveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  nameIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  fieldLabel: {
    flex: 1,
  },
  sectionWrap: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 40,
    paddingVertical: spacing.xs,
  },
  reminderTime: {
    paddingVertical: spacing.xs,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 40,
    paddingVertical: spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: 40,
    paddingVertical: spacing.xs,
  },
});
