import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing } from '@/src/constants/theme';
const starterMessages = [
    {
        id: 'welcome',
        role: 'assistant',
        text: 'Chao ban! Minh co the goi y habit, nhac uong nuoc va chia nho muc tieu hom nay.',
    },
];
const quickPrompts = ['Nhac uong nuoc', 'Goi y tap luyen', 'Toi nen doc gi?'];
function normalizeText(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function buildAssistantReply(input) {
    const normalized = normalizeText(input);
    if (normalized.includes('nuoc')) {
        return 'Ban da co 3/8 ly nuoc. Thu dat moc tiep theo trong 30 phut toi de day thoi quen nhe.';
    }
    if (normalized.includes('tap') || normalized.includes('the duc') || normalized.includes('workout')) {
        return 'Bat dau voi 5 phut khoi dong, sau do chon 1 bai ngan nhu squat, plank hoac di bo nhanh.';
    }
    if (normalized.includes('doc') || normalized.includes('sach')) {
        return 'Hay chia muc tieu doc sach thanh 10 phut dau tien. Khi bat nhip roi ban se de tiep tuc hon.';
    }
    if (normalized.includes('streak') || normalized.includes('chuoi')) {
        return 'Hom nay uu tien cac viec nho, de hoan thanh som va giu streak on dinh truoc khi tang muc do kho.';
    }
    return 'Minh de xuat ban hoan thanh 1 habit nho truoc, sau do chot them 1 muc de tang EXP va giu nhip trong ngay.';
}
export default function AssistantChat() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState(starterMessages);
    const chatHeight = Math.min(height * 0.58, 460);
    const bubbleTop = Math.max(insets.top + 180, height * 0.36);
    const sendMessage = (nextDraft) => {
        const content = (nextDraft ?? draft).trim();
        if (!content) {
            return;
        }
        void Haptics.selectionAsync();
        const userMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            text: content,
        };
        const assistantMessage = {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            text: buildAssistantReply(content),
        };
        setMessages((current) => [...current, userMessage, assistantMessage]);
        setDraft('');
    };
    return (<>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsOpen(true);
        }} style={({ pressed }) => [
            styles.bubble,
            { top: bubbleTop },
            pressed && styles.bubblePressed,
        ]}>
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.surface}/>
          <Text variant="caption" color="white" style={styles.bubbleLabel}>
            AI
          </Text>
        </Pressable>
      </View>

      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}/>

          <View style={[styles.chatCard, { height: chatHeight, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderCopy}>
                <Text variant="subtitle">Tro ly AI</Text>
                <Text variant="caption" color="muted">
                  De xuat nho gon cho lich thoi quen hom nay
                </Text>
              </View>
              <Pressable onPress={() => setIsOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={18} color={colors.textMuted}/>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false}>
              {messages.map((message) => (<View key={message.id} style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}>
                  <Text variant="body" color={message.role === 'user' ? 'white' : 'default'} style={styles.messageText}>
                    {message.text}
                  </Text>
                </View>))}
            </ScrollView>

            <View style={styles.promptRow}>
              {quickPrompts.map((prompt) => (<Pressable key={prompt} onPress={() => sendMessage(prompt)} style={({ pressed }) => [styles.promptChip, pressed && styles.promptChipPressed]}>
                  <Text variant="caption" color="primary">
                    {prompt}
                  </Text>
                </Pressable>))}
            </View>

            <View style={styles.inputRow}>
              <TextInput onChangeText={setDraft} onSubmitEditing={() => sendMessage()} placeholder="Nhap cau hoi cua ban..." placeholderTextColor={colors.textMuted} style={styles.input} value={draft}/>
              <Pressable onPress={() => sendMessage()} style={styles.sendButton}>
                <Ionicons name="send" size={18} color={colors.surface}/>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>);
}
const styles = StyleSheet.create({
    bubble: {
        position: 'absolute',
        right: -18,
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderWidth: 6,
        borderColor: '#EAF1FF',
        ...shadows.card,
    },
    bubblePressed: {
        transform: [{ scale: 0.97 }],
    },
    bubbleLabel: {
        fontWeight: '700',
    },
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.18)',
    },
    chatCard: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: radii.xxl,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        gap: spacing.md,
        ...shadows.card,
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    chatHeaderCopy: {
        flex: 1,
        gap: 4,
    },
    closeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageList: {
        gap: 10,
        paddingBottom: 4,
    },
    messageBubble: {
        maxWidth: '84%',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: radii.lg,
    },
    assistantMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#F7FAFF',
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary,
    },
    messageText: {
        lineHeight: 20,
    },
    promptRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    promptChip: {
        backgroundColor: colors.primarySoft,
        borderRadius: radii.pill,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    promptChipPressed: {
        opacity: 0.85,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    input: {
        flex: 1,
        minHeight: 48,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: 16,
        color: colors.text,
        fontSize: 14,
    },
    sendButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

