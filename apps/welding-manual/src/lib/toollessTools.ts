export type ToollessToolEntry = {
  id: string;
  label: string;
  imageUrl: string;
  highlight?: boolean;
};

export type ToollessToolCategory = {
  id: string;
  label: string;
  accentColor: string;
  tools: ToollessToolEntry[];
};

export const TOOLLESS_TOOL_CATEGORIES: ToollessToolCategory[] = [
  {
    id: "fixing-pins",
    label: "固定ピン",
    accentColor: "border-l-violet-400",
    tools: [
      { id: "pin-yellow", label: "黄色固定ピン", imageUrl: "/tools/pin-yellow.jpg", highlight: true },
      { id: "pin-blue",   label: "青色固定ピン", imageUrl: "/tools/pin-blue.jpg" },
      { id: "pin-red",    label: "赤色固定ピン", imageUrl: "/tools/pin-red.jpg" },
    ],
  },
  {
    id: "toolless-tools",
    label: "治具レスツール",
    accentColor: "border-l-sky-400",
    tools: [
      { id: "flat-bar-large",  label: "I大", imageUrl: "/tools/flat-bar-large.jpg" },
      { id: "flat-bar-medium", label: "I中", imageUrl: "/tools/flat-bar-medium.jpg" },
      { id: "flat-bar-small",  label: "I小", imageUrl: "/tools/flat-bar-small.jpg" },
      { id: "l-bracket-large",  label: "L大",  imageUrl: "/tools/l-bracket-large.jpg" },
      { id: "l-bracket-medium", label: "L中",  imageUrl: "/tools/l-bracket-medium.jpg" },
      { id: "l-bracket-small",  label: "L小",  imageUrl: "/tools/l-bracket-small.jpg" },
      { id: "l-bracket-xsmall", label: "L極小", imageUrl: "/tools/l-bracket-xsmall.jpg" },
    ],
  },
  {
    id: "clamps",
    label: "クランプ",
    accentColor: "border-l-amber-400",
    tools: [
      { id: "clamp-large",   label: "クランプ大",  imageUrl: "/tools/clamp-large.jpg" },
      { id: "clamp-small",   label: "クランプ小",  imageUrl: "/tools/clamp-small.jpg" },
      { id: "c-clamp-large", label: "Cクランプ大", imageUrl: "/tools/c-clamp-large.jpg" },
      { id: "c-clamp-small", label: "Cクランプ小", imageUrl: "/tools/c-clamp-small.jpg" },
    ],
  },
  {
    id: "magnets",
    label: "マグネット",
    accentColor: "border-l-red-400",
    tools: [
      { id: "magnet-round",  label: "丸マグネット",         imageUrl: "/tools/magnet-round.jpg" },
      { id: "magnet-v",      label: "Vマグネット",          imageUrl: "/tools/magnet-v.jpg" },
      { id: "magnet-large",  label: "マグネット大",         imageUrl: "/tools/magnet-large.jpg" },
      { id: "magnet-hex",    label: "マグネット六角ホルダー", imageUrl: "/tools/magnet-hex.jpg" },
      { id: "magnet-holder", label: "マグネットホルダ台",    imageUrl: "/tools/magnet-holder.jpg" },
    ],
  },
  {
    id: "blocks",
    label: "ブロック",
    accentColor: "border-l-emerald-400",
    tools: [
      { id: "v-block-small", label: "Vブロック小", imageUrl: "/tools/v-block-small.jpg" },
      { id: "v-block-large", label: "Vブロック大", imageUrl: "/tools/v-block-large.jpg" },
      { id: "block",         label: "ブロック",    imageUrl: "/tools/block.jpg" },
    ],
  },
];
