export const ONBOARDING_TOTAL_STEPS = 5;

export const INITIAL_ONBOARDING_DATA = {
  life_area: null,
  life_area_label: null,
  habit_name: null,
  habit_type: null,
  time_period: 'morning',
  time_exact: '07:00',
  frequency: 'everyday',
  specific_days: [],
};

export const DEFAULT_TIME_BY_PERIOD = {
  morning: '07:00',
  afternoon: '13:00',
  evening: '19:00',
};

export const LIFE_AREA_OPTIONS = [
  {
    label: 'Health & Fitness',
    value: 'health_fitness',
    description: 'Boost your energy, movement, and daily wellness.',
    icon: 'barbell-outline',
  },
  {
    label: 'Mind & Mood',
    value: 'mind_mood',
    description: 'Create space for calm, focus, and emotional balance.',
    icon: 'leaf-outline',
  },
  {
    label: 'Career & Study',
    value: 'career_study',
    description: 'Build routines that support deep work and steady growth.',
    icon: 'school-outline',
  },
  {
    label: 'Home & Organization',
    value: 'home_organization',
    description: 'Keep your space lighter, cleaner, and easier to manage.',
    icon: 'home-outline',
  },
  {
    label: 'Finances',
    value: 'finances',
    description: 'Stay consistent with the money habits that matter most.',
    icon: 'wallet-outline',
  },
  {
    label: 'Relationships',
    value: 'relationships',
    description: 'Make time for the people and conversations you value.',
    icon: 'people-outline',
  },
  {
    label: 'Creativity & Hobbies',
    value: 'creativity_hobbies',
    description: 'Protect time for curiosity, joy, and personal projects.',
    icon: 'color-palette-outline',
  },
];

export const EDUCATION_ITEMS = [
  {
    title: 'Start tiny',
    description: 'Small actions are easier to repeat and build momentum.',
    icon: 'sparkles-outline',
  },
  {
    title: 'Be consistent',
    description: 'Doing it regularly matters more than doing it perfectly.',
    icon: 'repeat-outline',
  },
  {
    title: 'Be patient',
    description: 'Real habit change takes time—keep going.',
    icon: 'hourglass-outline',
  },
];

export const PRESET_HABITS = [
  {
    label: 'Drink water',
    value: 'drink_water',
    description: 'A simple reset habit that fits into any routine.',
    icon: 'water-outline',
  },
  {
    label: 'Stretching',
    value: 'stretching',
    description: 'Wake up your body with a short mobility break.',
    icon: 'body-outline',
  },
  {
    label: 'Take vitamins',
    value: 'take_vitamins',
    description: 'Keep your health basics easy to remember.',
    icon: 'medkit-outline',
  },
  {
    label: 'Plank',
    value: 'plank',
    description: 'Build strength with a quick daily challenge.',
    icon: 'fitness-outline',
  },
  {
    label: 'Walk',
    value: 'walk',
    description: 'Add gentle movement and fresh air to your day.',
    icon: 'walk-outline',
  },
];

export const TIME_PERIOD_OPTIONS = [
  {
    label: 'Morning',
    value: 'morning',
    description: 'Start your day with a calm, easy win.',
    icon: 'sunny-outline',
  },
  {
    label: 'Afternoon',
    value: 'afternoon',
    description: 'Place the habit where your day naturally opens up.',
    icon: 'partly-sunny-outline',
  },
  {
    label: 'Evening',
    value: 'evening',
    description: 'Wind down with a simple habit before bed.',
    icon: 'moon-outline',
  },
];

export const FREQUENCY_OPTIONS = [
  {
    label: 'Everyday',
    value: 'everyday',
    description: 'A daily rhythm helps habits stick faster.',
  },
  {
    label: 'Weekdays',
    value: 'weekdays',
    description: 'Best for work and school routines.',
  },
  {
    label: 'Weekends',
    value: 'weekends',
    description: 'Keep it light for slower days.',
  },
  {
    label: 'Choose specific days',
    value: 'specific_days',
    description: 'Pick the exact days that feel realistic for you.',
  },
];

export const DAY_OPTIONS = [
  { label: 'Monday', short: 'Mon', value: 'mon' },
  { label: 'Tuesday', short: 'Tue', value: 'tue' },
  { label: 'Wednesday', short: 'Wed', value: 'wed' },
  { label: 'Thursday', short: 'Thu', value: 'thu' },
  { label: 'Friday', short: 'Fri', value: 'fri' },
  { label: 'Saturday', short: 'Sat', value: 'sat' },
  { label: 'Sunday', short: 'Sun', value: 'sun' },
];

export const ONBOARDING_COPY = {
  welcomeTitle: 'Build better habits, one small step at a time',
  welcomeDescription:
    'Create routines that fit your life and stay consistent with gentle reminders.',
  lifeAreaTitle: 'Which area of life would you like to improve first?',
  educationTitle: 'Strong habits start simple',
  educationDescription:
    'A few smart principles make new habits feel lighter and easier to repeat.',
  habitTitle: 'Choose your first habit',
  habitDescription: 'Pick a small win you would genuinely like to repeat this week.',
  scheduleTitle: 'Let’s make it fit your day',
  scheduleDescription:
    'Choose a time and rhythm that feels realistic, calm, and easy to keep.',
  saveTitle: 'Save your progress',
  saveDescription:
    'Your first habit is ready. Continue to login and unlock your HabitForge dashboard.',
};
