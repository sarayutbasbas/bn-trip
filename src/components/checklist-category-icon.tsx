import {
  Baby,
  BedDouble,
  BookOpenCheck,
  BriefcaseMedical,
  Camera,
  CircleHelp,
  Flashlight,
  Heart,
  House,
  Laptop,
  PawPrint,
  Plane,
  Scissors,
  Shirt,
  ShoppingBag,
  ShowerHead,
  Sparkles,
  Utensils,
  WalletCards,
  Watch,
} from "lucide-react";
import {
  CHECKLIST_CATEGORY_ICON_KEYS,
  CHECKLIST_CATEGORY_ICON_LABELS,
  normalizeChecklistCategoryIcon,
  type ChecklistCategoryIconKey,
} from "@/src/lib/checklist-category-icons";

const icons = {
  plane: Plane,
  shirt: Shirt,
  laptop: Laptop,
  medical: BriefcaseMedical,
  sparkles: Sparkles,
  heart: Heart,
  shower: ShowerHead,
  scissors: Scissors,
  watch: Watch,
  passport: BookOpenCheck,
  camera: Camera,
  flashlight: Flashlight,
  house: House,
  wallet: WalletCards,
  food: Utensils,
  bed: BedDouble,
  shopping: ShoppingBag,
  baby: Baby,
  pet: PawPrint,
  help: CircleHelp,
} satisfies Record<ChecklistCategoryIconKey, typeof Plane>;

export function ChecklistCategoryIcon({
  iconKey,
  categoryName,
  size = 20,
}: {
  iconKey?: string | null;
  categoryName: string;
  size?: number;
}) {
  const normalized = normalizeChecklistCategoryIcon(iconKey, categoryName);
  const Icon = icons[normalized];
  return <Icon size={size} aria-hidden="true" />;
}

export function ChecklistCategoryIconPicker({
  value,
  onChange,
}: {
  value: ChecklistCategoryIconKey;
  onChange: (value: ChecklistCategoryIconKey) => void;
}) {
  return (
    <div className="checklist-icon-picker" role="radiogroup" aria-label="เลือกไอคอนหมวดหมู่">
      {CHECKLIST_CATEGORY_ICON_KEYS.map((key) => {
        const Icon = icons[key];
        return (
          <button
            type="button"
            className={value === key ? "active" : ""}
            key={key}
            onClick={() => onChange(key)}
            role="radio"
            aria-checked={value === key}
            title={CHECKLIST_CATEGORY_ICON_LABELS[key]}
          >
            <Icon size={20} />
            <span>{CHECKLIST_CATEGORY_ICON_LABELS[key]}</span>
          </button>
        );
      })}
    </div>
  );
}
