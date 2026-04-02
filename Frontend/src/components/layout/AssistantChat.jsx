import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
  const { height } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(starterMessages);
  const chatHeight = Math.min(height * 0.58, 460);
  const bubbleBottom = Math.max(insets.bottom + 116, 132);

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

  const trigger =
    variant === "floating" ? (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable
          onPress={openChat}
          style={({ pressed }) => [
            styles.bubble,
            { bottom: bubbleBottom },
            pressed && styles.bubblePressed,
          ]}
        >
          <Ionicons
            color={colors.surface}
            name="chatbubble-ellipses"
            size={24}
          />
          <Text color="white" style={styles.bubbleLabel} variant="caption">
            Coach
          </Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.inlineCard}>
        <View style={styles.inlineHeader}>
          <View style={styles.inlineIconWrap}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
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
  bubble: {
    position: "absolute",
    right: 8,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 6,
    borderColor: "#EAF1FF",
    ...shadows.card,
  },
  bubblePressed: {
    transform: [{ scale: 0.97 }],
  },
  bubbleLabel: {
    fontWeight: "700",
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
