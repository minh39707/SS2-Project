import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/constants/colors";
import { radii, shadows, spacing } from "@/src/constants/theme";
import { sendAiChatMessage } from "@/src/services/ai.service";

const starterMessages = [
  {
    id: "welcome",
    role: "assistant",
    text: "Minh co the giai thich tinh nang, goi y thoi quen, hoac nhan check-in bang chat cho ban.",
  },
];

const defaultQuickPrompts = [
  "Giu streak the nao?",
  "Goi y ban de hon",
  "Toi nay nen lam gi?",
];

const chatGptSegmentRotations = [
  "0deg",
  "60deg",
  "120deg",
  "180deg",
  "240deg",
  "300deg",
];

function ChatGptGlyph({ size = 22, color = colors.surface, accentColor = colors.primary }) {
  const segmentWidth = Math.max(7, Math.round(size * 0.42));
  const segmentHeight = Math.max(11, Math.round(size * 0.24));
  const offset = Math.max(5, Math.round(size * 0.24));
  const coreSize = Math.max(6, Math.round(size * 0.28));

  return (
    <View style={[styles.glyphWrap, { width: size, height: size }]}>
      {chatGptSegmentRotations.map((rotation) => (
        <View
          key={rotation}
          style={[
            styles.glyphSegment,
            {
              width: segmentWidth,
              height: segmentHeight,
              backgroundColor: color,
              borderRadius: segmentHeight / 2,
              transform: [{ rotate: rotation }, { translateY: -offset }],
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.glyphCore,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            backgroundColor: accentColor,
          },
        ]}
      />
    </View>
  );
}

export default function AssistantChat({
  variant = "inline",
  title = "AI Habit Coach",
  subtitle = "Hoi ve app, xin loi khuyen, hoac check-in thoi quen bang chat.",
  quickPrompts = defaultQuickPrompts,
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(starterMessages);
  const [isSending, setIsSending] = useState(false);
  const chatHeight = Math.min(height * 0.58, 460);
  const bubbleWidth = 58;
  const bubbleHeight = 58;
  const bubbleMargin = spacing.md;
  const bubbleBottom = Math.max(insets.bottom + 108, 124);
  const minBubbleX = bubbleMargin;
  const maxBubbleX = Math.max(bubbleMargin, width - bubbleWidth - bubbleMargin);
  const minBubbleY = Math.max(insets.top + 86, bubbleMargin + 12);
  const maxBubbleY = Math.max(minBubbleY, height - bubbleBottom - bubbleHeight);
  const defaultBubblePosition = {
    x: maxBubbleX,
    y: maxBubbleY,
  };
  const bubblePosition = useRef(new Animated.ValueXY(defaultBubblePosition)).current;
  const bubbleOffsetRef = useRef(defaultBubblePosition);
  const dragStartRef = useRef(defaultBubblePosition);

  const clampBubbleX = useCallback(
    (value) => Math.max(minBubbleX, Math.min(maxBubbleX, value)),
    [maxBubbleX, minBubbleX],
  );
  const clampBubbleY = useCallback(
    (value) => Math.max(minBubbleY, Math.min(maxBubbleY, value)),
    [maxBubbleY, minBubbleY],
  );

  const openChat = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
  };

  const sendMessage = async (nextDraft) => {
    const content = (nextDraft ?? draft).trim();

    if (!content || isSending) {
      return;
    }

    void Haptics.selectionAsync();
    const now = Date.now();
    const userMessage = {
      id: `${now}-user`,
      role: "user",
      text: content,
    };
    const pendingMessageId = `${now}-assistant-pending`;

    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: pendingMessageId,
        role: "assistant",
        text: "Minh dang suy nghi...",
      },
    ]);
    setDraft("");
    setIsOpen(true);
    setIsSending(true);

    try {
      const response = await sendAiChatMessage(content, {
        conversationId: "assistant-chat",
      });
      const replyText = response.clarification_needed
        ? response.clarification_question ?? response.reply
        : response.reply;

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessageId
            ? {
                id: `${now}-assistant`,
                role: "assistant",
                text: replyText,
              }
            : message,
        ),
      );
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessageId
            ? {
                id: `${now}-assistant-error`,
                role: "assistant",
                text: "Minh chua ket noi duoc AI luc nay. Ban thu lai sau mot chut nhe.",
              }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    const nextPosition = {
      x: clampBubbleX(bubbleOffsetRef.current.x),
      y: clampBubbleY(bubbleOffsetRef.current.y),
    };

    bubbleOffsetRef.current = nextPosition;
    bubblePosition.setValue(nextPosition);
  }, [bubblePosition, clampBubbleX, clampBubbleY, height, width]);

  const bubblePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          bubblePosition.stopAnimation((value) => {
            bubbleOffsetRef.current = value;
            dragStartRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          bubblePosition.setValue({
            x: clampBubbleX(dragStartRef.current.x + gestureState.dx),
            y: clampBubbleY(dragStartRef.current.y + gestureState.dy),
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextPosition = {
            x: clampBubbleX(dragStartRef.current.x + gestureState.dx),
            y: clampBubbleY(dragStartRef.current.y + gestureState.dy),
          };

          bubbleOffsetRef.current = nextPosition;
          bubblePosition.setValue(nextPosition);

          if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
            openChat();
          }
        },
        onPanResponderTerminate: () => {
          bubblePosition.setValue(bubbleOffsetRef.current);
        },
      }),
    [bubblePosition, clampBubbleX, clampBubbleY],
  );

  const renderPromptChip = (prompt) => (
    <Pressable
      key={prompt}
      disabled={isSending}
      onPress={() => void sendMessage(prompt)}
      style={({ pressed }) => [
        styles.promptChip,
        isSending && styles.promptChipDisabled,
        pressed && styles.promptChipPressed,
      ]}
    >
      <Text color="primary" variant="caption">
        {prompt}
      </Text>
    </Pressable>
  );

  const trigger =
    variant === "floating" ? (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Animated.View
          {...bubblePanResponder.panHandlers}
          style={[
            styles.bubbleWrap,
            {
              width: bubbleWidth,
              height: bubbleHeight,
              transform: [{ translateX: bubblePosition.x }, { translateY: bubblePosition.y }],
            },
          ]}
        >
          <View style={styles.bubble}>
            <ChatGptGlyph accentColor={colors.primary} color={colors.surface} size={24} />
          </View>
        </Animated.View>
      </View>
    ) : (
      <View style={styles.inlineCard}>
        <View style={styles.inlineHeader}>
          <View style={styles.inlineIconWrap}>
            <ChatGptGlyph accentColor="#EEF5FF" color={colors.primary} size={18} />
          </View>
          <View style={styles.inlineCopy}>
            <Text variant="subtitle">{title}</Text>
            <Text color="muted" variant="body">
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.promptRow}>{quickPrompts.map(renderPromptChip)}</View>

        <Pressable
          onPress={openChat}
          style={({ pressed }) => [
            styles.inlinePrimaryButton,
            pressed && styles.inlinePrimaryButtonPressed,
          ]}
        >
          <Ionicons color={colors.surface} name="chatbox-ellipses" size={16} />
          <Text color="white" style={styles.inlinePrimaryText} variant="label">
            Open Coach
          </Text>
        </Pressable>
      </View>
    );

  return (
    <>
      {trigger}

      <Modal animationType="fade" onRequestClose={() => setIsOpen(false)} transparent visible={isOpen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable onPress={() => setIsOpen(false)} style={styles.backdrop} />

          <View
            style={[
              styles.chatCard,
              {
                height: chatHeight,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderCopy}>
                <Text variant="subtitle">{title}</Text>
                <Text color="muted" variant="caption">
                  Hoi ve thoi quen, streak, va cac buoc nho de giu tien do moi ngay.
                </Text>
              </View>
              <Pressable onPress={() => setIsOpen(false)} style={styles.closeButton}>
                <Ionicons color={colors.textMuted} name="close" size={18} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false}>
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.role === "user" ? styles.userMessage : styles.assistantMessage,
                  ]}
                >
                  <Text
                    color={message.role === "user" ? "white" : "default"}
                    style={styles.messageText}
                    variant="body"
                  >
                    {message.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.promptRow}>{quickPrompts.map(renderPromptChip)}</View>

            <View style={styles.inputRow}>
              <TextInput
                editable={!isSending}
                onChangeText={setDraft}
                onSubmitEditing={() => void sendMessage()}
                placeholder="Hoi hoac check-in thoi quen..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={draft}
              />
              <Pressable
                disabled={isSending}
                onPress={() => void sendMessage()}
                style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
              >
                <Ionicons color={colors.surface} name="send" size={18} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  glyphWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  glyphSegment: {
    position: "absolute",
  },
  glyphCore: {
    position: "absolute",
  },
  bubbleWrap: {
    position: "absolute",
  },
  bubble: {
    flex: 1,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#EAF1FF",
    ...shadows.card,
  },
  inlineCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  inlineHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  inlineIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineCopy: {
    flex: 1,
    gap: 4,
  },
  inlinePrimaryButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  inlinePrimaryButtonPressed: {
    opacity: 0.86,
  },
  inlinePrimaryText: {
    fontWeight: "700",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    gap: 10,
    paddingBottom: 4,
  },
  messageBubble: {
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.lg,
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#F7FAFF",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  messageText: {
    lineHeight: 20,
  },
  promptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  promptChipDisabled: {
    opacity: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
