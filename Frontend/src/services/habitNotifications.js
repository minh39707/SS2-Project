import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest } from "@/src/services/api";
import { formatTimeLabel } from "@/src/utils/onboarding";

const NOTIFICATION_CHANNEL_ID = "habit-reminders";
const STORAGE_KEY_PREFIX = "habit-app:habit-notifications";
const WEEKDAY_TO_NOTIFICATION_DAY = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

const isExpoGo = Constants.appOwnership === "expo";

let notificationsModulePromise = null;
let didConfigureNotificationHandler = false;

async function getNotificationsModuleAsync() {
  if (Platform.OS === "web" || isExpoGo) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications")
      .then((module) => {
        const Notifications = module?.default ?? module;

        if (!didConfigureNotificationHandler) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          didConfigureNotificationHandler = true;
        }

        return Notifications;
      })
      .catch((error) => {
        notificationsModulePromise = null;

        if (__DEV__) {
          console.warn("Failed to load expo-notifications", error);
        }

        return null;
      });
  }

  return notificationsModulePromise;
}

function getStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeReminderTimes(reminders = []) {
  return [...new Set(
    reminders.filter((value) => typeof value === "string" && value.trim()),
  )];
}

function parseReminderTime(reminderTime) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(reminderTime ?? "").trim());

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
  };
}

function getMonthlyReminderDay(startDate) {
  const parsedDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().getDate();
  }

  return parsedDate.getDate();
}

function getReminderBody(habit, reminderTime) {
  const reminderLabel = formatTimeLabel(reminderTime);

  if (habit.habitType === "negative") {
    return `Đến ${reminderLabel} Rồi, Hôm nay bạn có tránh được "${habit.title}" chưa?`;
  }

  return `Đến giờ ${reminderLabel} rồi, nhớ hoàn thành "${habit.title}" nhé.`;
}

function buildNotificationContent(habit, reminderTime) {
  return {
    title:
      habit.habitType === "negative"
        ? `Check-in thói quen: ${habit.title}`
        : `Nhớ thực hiện: ${habit.title}`,
    body: getReminderBody(habit, reminderTime),
    sound: false,
    data: {
      url: "/habit-manage",
      habitId: habit.id,
      habitType: habit.habitType,
      reminderTime,
    },
  };
}

function buildScheduleKey(habit, suffix) {
  return [
    habit.id,
    normalizeText(habit.title),
    normalizeText(habit.habitType),
    normalizeText(habit.frequencyType),
    normalizeText(habit.startDate),
    normalizeText((habit.frequencyDays ?? []).join(",")),
    suffix,
  ].join("::");
}

function buildReminderEntriesForHabit(habit, Notifications) {
  const frequencyType = habit.frequencyType ?? "daily";
  const reminderTimes = normalizeReminderTimes(habit.reminders);
  const entries = [];

  if (habit.isActive === false || reminderTimes.length === 0) {
    return entries;
  }

  for (const reminderTime of reminderTimes) {
    const timeParts = parseReminderTime(reminderTime);

    if (!timeParts) {
      continue;
    }

    if (frequencyType === "weekly") {
      for (const dayKey of habit.frequencyDays ?? []) {
        const weekday = WEEKDAY_TO_NOTIFICATION_DAY[dayKey];

        if (!weekday) {
          continue;
        }

        entries.push({
          key: buildScheduleKey(habit, `weekly:${dayKey}:${reminderTime}`),
          content: buildNotificationContent(habit, reminderTime),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: timeParts.hour,
            minute: timeParts.minute,
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        });
      }

      continue;
    }

    if (frequencyType === "monthly") {
      entries.push({
        key: buildScheduleKey(habit, `monthly:${getMonthlyReminderDay(habit.startDate)}:${reminderTime}`),
        content: buildNotificationContent(habit, reminderTime),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: getMonthlyReminderDay(habit.startDate),
          hour: timeParts.hour,
          minute: timeParts.minute,
          channelId: NOTIFICATION_CHANNEL_ID,
        },
      });
      continue;
    }

    entries.push({
      key: buildScheduleKey(habit, `daily:${reminderTime}`),
      content: buildNotificationContent(habit, reminderTime),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: timeParts.hour,
        minute: timeParts.minute,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });
  }

  return entries;
}

function buildReminderEntries(habits = [], Notifications) {
  return habits.flatMap((habit) =>
    buildReminderEntriesForHabit(habit, Notifications),
  );
}

async function ensureNotificationChannelAsync(Notifications) {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "Habit reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function readStoredNotificationMap(userId) {
  const rawValue = await AsyncStorage.getItem(getStorageKey(userId));

  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

async function writeStoredNotificationMap(userId, entries) {
  if (!userId) {
    return;
  }

  if (!entries || Object.keys(entries).length === 0) {
    await AsyncStorage.removeItem(getStorageKey(userId));
    return;
  }

  await AsyncStorage.setItem(
    getStorageKey(userId),
    JSON.stringify(entries),
  );
}

async function cancelNotificationIds(Notifications, notificationIds = []) {
  await Promise.all(
    notificationIds.map(async (notificationId) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch (error) {
        if (__DEV__) {
          console.warn("Failed to cancel scheduled notification", error);
        }
      }
    }),
  );
}

async function hasGrantedNotificationPermissionAsync(Notifications) {
  const settings = await Notifications.getPermissionsAsync();
  const iosProvisionalStatus =
    Notifications.IosAuthorizationStatus?.PROVISIONAL;

  return (
    settings.granted ||
    settings.ios?.status === iosProvisionalStatus
  );
}

async function ensureNotificationPermissionAsync(Notifications, requestPermissions) {
  if (await hasGrantedNotificationPermissionAsync(Notifications)) {
    return true;
  }

  if (!requestPermissions) {
    return false;
  }

  const response = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return (
    response.granted ||
    response.ios?.status === Notifications.IosAuthorizationStatus?.PROVISIONAL
  );
}

async function loadHabitsForNotifications(userId, authToken) {
  const response = await apiRequest("/habits", {
    method: "GET",
    userId,
    authToken,
    timeoutMs: 20000,
  });

  return response?.habits ?? [];
}

export async function clearManagedHabitNotifications(userId) {
  if (!userId || Platform.OS === "web") {
    return;
  }

  const Notifications = await getNotificationsModuleAsync();

  if (!Notifications) {
    await writeStoredNotificationMap(userId, {});
    return;
  }

  const storedEntries = await readStoredNotificationMap(userId);
  await cancelNotificationIds(Notifications, Object.values(storedEntries));
  await writeStoredNotificationMap(userId, {});
}

export async function syncHabitNotificationsForUser({
  userId,
  authToken,
  habits = null,
  requestPermissions = false,
} = {}) {
  if (!userId || Platform.OS === "web") {
    return {
      permissionGranted: false,
      scheduledCount: 0,
    };
  }

  const Notifications = await getNotificationsModuleAsync();

  if (!Notifications) {
    return {
      permissionGranted: false,
      scheduledCount: 0,
    };
  }

  await ensureNotificationChannelAsync(Notifications);

  const resolvedHabits = Array.isArray(habits)
    ? habits
    : await loadHabitsForNotifications(userId, authToken);
  const desiredEntries = buildReminderEntries(resolvedHabits, Notifications);
  const storedEntries = await readStoredNotificationMap(userId);

  if (desiredEntries.length === 0) {
    await cancelNotificationIds(Notifications, Object.values(storedEntries));
    await writeStoredNotificationMap(userId, {});
    return {
      permissionGranted: true,
      scheduledCount: 0,
    };
  }

  const permissionGranted = await ensureNotificationPermissionAsync(
    Notifications,
    requestPermissions,
  );

  if (!permissionGranted) {
    await cancelNotificationIds(Notifications, Object.values(storedEntries));
    await writeStoredNotificationMap(userId, {});
    return {
      permissionGranted: false,
      scheduledCount: 0,
    };
  }

  const pendingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const pendingNotificationIds = new Set(
    pendingNotifications.map((notification) => notification.identifier),
  );
  const desiredEntriesMap = Object.fromEntries(
    desiredEntries.map((entry) => [entry.key, entry]),
  );
  const nextStoredEntries = {};
  const staleNotificationIds = [];

  for (const [scheduleKey, notificationId] of Object.entries(storedEntries)) {
    if (
      !desiredEntriesMap[scheduleKey] ||
      !pendingNotificationIds.has(notificationId)
    ) {
      staleNotificationIds.push(notificationId);
      continue;
    }

    nextStoredEntries[scheduleKey] = notificationId;
  }

  await cancelNotificationIds(Notifications, staleNotificationIds);

  for (const entry of desiredEntries) {
    if (nextStoredEntries[entry.key]) {
      continue;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: entry.content,
        trigger: entry.trigger,
      });

      nextStoredEntries[entry.key] = notificationId;
    } catch (error) {
      if (__DEV__) {
        console.warn("Failed to schedule habit notification", error);
      }
    }
  }

  await writeStoredNotificationMap(userId, nextStoredEntries);

  return {
    permissionGranted: true,
    scheduledCount: Object.keys(nextStoredEntries).length,
  };
}
