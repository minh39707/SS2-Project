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

const starterMessages = [
  {
    id: "welcome",
    role: "assistant",
    text: "Hi! I can help you protect your streak, simplify today's task, or suggest a better habit.",
  },
];

const defaultQuickPrompts = [
  "Protect my streak",
  "Suggest an easier version",
  "Plan tonight's routine",
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

function normalizeText(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildAssistantReply(input) {
  const normalized = normalizeText(input);

  if (normalized.includes("streak")) {
    return "Protect your streak with the smallest possible win first. Do a 5-minute version now, then build from there.";
  }

  if (
    normalized.includes("water") ||
    normalized.includes("drink") ||
    normalized.includes("nuoc")
  ) {
    return "Tie water to a trigger. Drink one glass after waking up, one before lunch, and one before dinner.";
  }

  if (
    normalized.includes("easy") ||
    normalized.includes("simpl") ||
    normalized.includes("nho")
  ) {
    return "Shrink today's task until it feels easy to start. A 2-minute version still protects your momentum.";
  }

  if (
    normalized.includes("night") ||
    normalized.includes("routine") ||
    normalized.includes("toi")
  ) {
    return "Try a 3-step evening flow: put your phone away, prepare tomorrow's essentials, and sleep at a fixed time.";
  }

  return "Focus on one small win first. Once you complete that, EXP and streak progress become much easier to maintain.";
}

export default function AssistantChat({
  variant = "inline",
  title = "AI Habit Coach",
  subtitle = "Get practical suggestions to keep your mission, reward, and streak moving.",
  quickPrompts = defaultQuickPrompts,
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(starterMessages);
  const chatHeight = Math.min(height * 0.58, 460);
  const bubbleWidth = 58;
  const bubbleHeight = 58;
  const bubbleMargin = spacing.md;
  const bubbleBottom = Math.max(insets.bottom + 108, 124);
  const minBubbleX = bubbleMargin;
  const maxBubbleX = Math.max(bubbleMargin, width - bubbleWidth - bubbleMargin);
  const minBubbleY = Math.max(insets.top + 86, bubbleMargin + 12);
  const maxBubbleY = Math.max(
    minBubbleY,
    height - bubbleBottom - bubbleHeight,
  );
  const defaultBubblePosition = {
    x: maxBubbleX,
    y: maxBubbleY,
  };
  const bubblePosition = useRef(
    new Animated.ValueXY(defaultBubblePosition),
  ).current;
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

  const sendMessage = (nextDraft) => {
    const content = (nextDraft ?? draft).trim();

    if (!content) {
      return;
    }

    void Haptics.selectionAsync();
    const now = Date.now();
    const userMessage = {
      id: `${now}-user`,
      role: "user",
      text: content,
    };
    const assistantMessage = {
      id: `${now}-assistant`,
      role: "assistant",
      text: buildAssistantReply(content),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setIsOpen(true);
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
              transform: [
                { translateX: bubblePosition.x },
                { translateY: bubblePosition.y },
              ],
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
            <ChatGptGlyph
              accentColor="#EEF5FF"
              color={colors.primary}
              size={18}
            />
          </View>
          <View style={styles.inlineCopy}>
            <Text variant="subtitle">{title}</Text>
            <Text color="muted" variant="body">
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.promptRow}>
          {quickPrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => sendMessage(prompt)}
              style={({ pressed }) => [
                styles.promptChip,
                pressed && styles.promptChipPressed,
              ]}
            >
              <Text color="primary" variant="caption">
                {prompt}
              </Text>
            </Pressable>
          ))}
        </View>

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

      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
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
                  Short, practical suggestions for habits, streaks, and daily flow.
                </Text>
              </View>
              <Pressable
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons color={colors.textMuted} name="close" size={18} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.role === "user"
                      ? styles.userMessage
                      : styles.assistantMessage,
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

            <View style={styles.promptRow}>
              {quickPrompts.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => sendMessage(prompt)}
                  style={({ pressed }) => [
                    styles.promptChip,
                    pressed && styles.promptChipPressed,
                  ]}
                >
                  <Text color="primary" variant="caption">
                    {prompt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                onChangeText={setDraft}
                onSubmitEditing={() => sendMessage()}
                placeholder="Ask for a suggestion..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={draft}
              />
              <Pressable onPress={() => sendMessage()} style={styles.sendButton}>
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
});
