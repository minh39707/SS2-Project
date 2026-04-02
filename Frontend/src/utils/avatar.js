const DEFAULT_AVATAR_STYLE = "adventurer-neutral";
const DEFAULT_AVATAR_SIZE = 256;

const PRESET_SEEDS = [
  { id: "sunny-scout", label: "Scout" },
  { id: "nova-dreamer", label: "Nova" },
  { id: "mint-runner", label: "Mint" },
  { id: "maple-spark", label: "Maple" },
  { id: "peach-rider", label: "Peach" },
  { id: "blue-orbit", label: "Orbit" },
];

export function getInitials(name) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "HH"
  );
}

export function buildAvatarUrl(seed, size = DEFAULT_AVATAR_SIZE) {
  const encodedSeed = encodeURIComponent(seed || "habit-hero");

  return `https://api.dicebear.com/9.x/${DEFAULT_AVATAR_STYLE}/png?seed=${encodedSeed}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export function getDefaultAvatarUrl(seedSource) {
  return buildAvatarUrl(seedSource || "habit-hero");
}

export function resolveAvatarUrl(avatarUrl, seedSource) {
  const trimmedValue =
    typeof avatarUrl === "string" ? avatarUrl.trim() : avatarUrl;

  return trimmedValue || getDefaultAvatarUrl(seedSource);
}

export const AVATAR_PRESETS = PRESET_SEEDS.map((preset, index) => ({
  ...preset,
  url: buildAvatarUrl(`${preset.id}-${index + 1}`),
}));
