import { ClothingItem, Outfit, OutfitSchedule, WishlistItem } from '../types';

export const HERO_EDITORIAL_IMG = '/src/assets/images/hero_concrete_editorial_1794905625502.jpg';

const IMG_BOXY_TEE = '/src/assets/images/wardrobe_boxy_tee_1794905625912.jpg';
const IMG_HOODIE = '/src/assets/images/wardrobe_heavy_hoodie_1794905626786.jpg';
const IMG_CARGO = '/src/assets/images/wardrobe_cargo_pants_1794905627491.jpg';
const IMG_JACKET = '/src/assets/images/wardrobe_work_jacket_1794905627455.jpg';
const IMG_SNEAKERS = '/src/assets/images/wardrobe_sneakers_1794905626993.jpg';

export const DEMO_USER_ID = 'demo_swooosh_concrete_user';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function offsetDateISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export const DEMO_WARDROBE: ClothingItem[] = [
  {
    id: 'demo_item_tee_1',
    userId: DEMO_USER_ID,
    name: 'Heavyweight Washed Boxy Tee',
    category: 'T-shirts',
    brand: 'Entire Studios',
    color: 'Charcoal',
    size: 'L',
    price: 115,
    purchaseDate: '2026-08-14',
    description: '320gsm enzyme-washed organic cotton with dropped shoulders and cropped boxy drape.',
    imageUrl: IMG_BOXY_TEE,
    wearCount: 14,
    lastWornAt: offsetDateISO(-2),
    createdAt: '2026-08-14T10:00:00.000Z',
  },
  {
    id: 'demo_item_hoodie_1',
    userId: DEMO_USER_ID,
    name: 'Architectural Concrete Pullover Hoodie',
    category: 'Hoodies',
    brand: 'Represent Clo',
    color: 'Bone',
    size: 'L',
    price: 210,
    purchaseDate: '2026-09-02',
    description: '480gsm brushed loopback fleece in warm stone-bone tone with structured double-layered hood.',
    imageUrl: IMG_HOODIE,
    wearCount: 9,
    lastWornAt: offsetDateISO(-1),
    createdAt: '2026-09-02T12:30:00.000Z',
  },
  {
    id: 'demo_item_jacket_1',
    userId: DEMO_USER_ID,
    name: 'Cropped Canvas Work Jacket',
    category: 'Jackets',
    brand: 'Carhartt WIP',
    color: 'Slate',
    size: 'M',
    price: 285,
    purchaseDate: '2026-09-18',
    description: 'Garment-dyed heavyweight duck canvas workwear jacket with brushed nickel hardware.',
    imageUrl: IMG_JACKET,
    wearCount: 7,
    lastWornAt: offsetDateISO(-4),
    createdAt: '2026-09-18T15:20:00.000Z',
  },
  {
    id: 'demo_item_pants_1',
    userId: DEMO_USER_ID,
    name: 'Wide-Leg Technical Cargo Trousers',
    category: 'Pants',
    brand: 'Stone Island',
    color: 'Black',
    size: '32',
    price: 390,
    purchaseDate: '2026-07-22',
    description: 'Relaxed straight-wide silhouette with articulated knees and concealed bellows cargo pockets.',
    imageUrl: IMG_CARGO,
    wearCount: 16,
    lastWornAt: offsetDateISO(-1),
    createdAt: '2026-07-22T09:15:00.000Z',
  },
  {
    id: 'demo_item_sneakers_1',
    userId: DEMO_USER_ID,
    name: 'Minimalist Concrete Low-Top Sneakers',
    category: 'Sneakers',
    brand: 'Common Projects',
    color: 'Bone / Gray',
    size: '43',
    price: 425,
    purchaseDate: '2026-06-11',
    description: 'Full-grain Italian calfskin with slate suede panel overlays and vulcanized cup sole.',
    imageUrl: IMG_SNEAKERS,
    wearCount: 22,
    lastWornAt: offsetDateISO(-1),
    createdAt: '2026-06-11T16:40:00.000Z',
  },
  {
    id: 'demo_item_shirt_1',
    userId: DEMO_USER_ID,
    name: 'Relaxed Poplin Studio Overshirt',
    category: 'Shirts',
    brand: 'AURALEE',
    color: 'Ash Gray',
    size: 'L',
    price: 260,
    purchaseDate: '2026-10-05',
    description: 'Crisp high-density cotton poplin shirt with concealed placket and clean square hem.',
    imageUrl: IMG_JACKET,
    wearCount: 3,
    lastWornAt: offsetDateISO(-6),
    createdAt: '2026-10-05T11:00:00.000Z',
  },
  {
    id: 'demo_item_jorts_1',
    userId: DEMO_USER_ID,
    name: 'Raw Selvedge Baggy Denim Jorts',
    category: 'Jorts',
    brand: 'Stussy',
    color: 'Washed Gray',
    size: '32',
    price: 155,
    purchaseDate: '2026-08-29',
    description: 'Below-the-knee wide cut washed charcoal denim shorts with contrast bar-tack stitching.',
    imageUrl: IMG_CARGO,
    wearCount: 5,
    lastWornAt: offsetDateISO(-10),
    createdAt: '2026-08-29T14:00:00.000Z',
  },
  {
    id: 'demo_item_acc_1',
    userId: DEMO_USER_ID,
    name: 'Brushed Sterling Link Chain & Ring Set',
    category: 'Accessories',
    brand: 'Werkstatt München',
    color: 'Silver',
    size: 'OS',
    price: 340,
    purchaseDate: '2026-10-20',
    description: 'Hand-hammered matte 925 sterling silver curb chain and signet ring.',
    wearCount: 0,
    createdAt: '2026-10-20T18:10:00.000Z',
  },
];

export const DEMO_OUTFITS: Outfit[] = [
  {
    id: 'demo_outfit_1',
    userId: DEMO_USER_ID,
    name: 'Brutalist Studio Daily',
    styleCategory: 'Streetwear',
    description: 'Heavyweight bone hoodie anchored by wide technical black cargos and clean leather low-tops.',
    topId: 'demo_item_hoodie_1',
    bottomId: 'demo_item_pants_1',
    shoesId: 'demo_item_sneakers_1',
    accessoryIds: ['demo_item_acc_1'],
    isFavorite: true,
    source: 'builder',
    createdAt: '2026-10-12T09:00:00.000Z',
  },
  {
    id: 'demo_outfit_2',
    userId: DEMO_USER_ID,
    name: 'Monochrome Workwear Layer',
    styleCategory: 'Minimalist',
    description: 'Cropped dark slate canvas jacket layered for crisp evening proportions.',
    topId: 'demo_item_jacket_1',
    bottomId: 'demo_item_pants_1',
    shoesId: 'demo_item_sneakers_1',
    accessoryIds: [],
    isFavorite: true,
    source: 'builder',
    createdAt: '2026-10-24T14:30:00.000Z',
  },
  {
    id: 'demo_outfit_3',
    userId: DEMO_USER_ID,
    name: 'Off-Duty Charcoal Proportion',
    styleCategory: 'Oversized',
    description: 'Relaxed washed charcoal boxy tee paired with wide baggy jorts and bone leather sneakers.',
    topId: 'demo_item_tee_1',
    bottomId: 'demo_item_jorts_1',
    shoesId: 'demo_item_sneakers_1',
    accessoryIds: ['demo_item_acc_1'],
    isFavorite: false,
    source: 'ai',
    createdAt: '2026-11-02T11:15:00.000Z',
  },
];

export const DEMO_WISHLIST: WishlistItem[] = [
  {
    id: 'demo_wish_1',
    userId: DEMO_USER_ID,
    name: 'XT-6 GORE-TEX Concrete Sneaker',
    brand: 'Salomon',
    category: 'Sneakers',
    price: 220,
    productUrl: 'https://www.salomon.com',
    notes: 'Ideal technical wet-weather pairing for wide black cargo pants.',
    imageUrl: IMG_SNEAKERS,
    isPurchased: false,
    createdAt: '2026-10-15T10:00:00.000Z',
  },
  {
    id: 'demo_wish_2',
    userId: DEMO_USER_ID,
    name: 'Pleated Wool Wide Trousers',
    brand: 'Our Legacy',
    category: 'Pants',
    price: 440,
    productUrl: 'https://www.ourlegacy.com',
    notes: 'Elevates the cropped work jacket into smart casual / gallery territory.',
    imageUrl: IMG_CARGO,
    isPurchased: false,
    createdAt: '2026-10-28T13:20:00.000Z',
  },
  {
    id: 'demo_wish_3',
    userId: DEMO_USER_ID,
    name: 'Distressed Matte Leather Bomber',
    brand: 'Acne Studios',
    category: 'Jackets',
    price: 1450,
    notes: 'Statement outerwear investment piece.',
    imageUrl: IMG_JACKET,
    isPurchased: false,
    createdAt: '2026-11-05T16:45:00.000Z',
  },
  {
    id: 'demo_wish_4',
    userId: DEMO_USER_ID,
    name: 'Heavyweight Ribbed Beanie',
    brand: 'NN.07',
    category: 'Accessories',
    price: 75,
    notes: 'Picked up last month.',
    imageUrl: IMG_BOXY_TEE,
    isPurchased: true,
    createdAt: '2026-09-20T09:30:00.000Z',
  },
];

export function getInitialDemoSchedules(): OutfitSchedule[] {
  return [
    {
      id: 'demo_sched_today',
      userId: DEMO_USER_ID,
      date: getTodayISO(),
      outfitId: 'demo_outfit_1',
      notes: 'Client studio presentation & evening gallery walk.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo_sched_plus2',
      userId: DEMO_USER_ID,
      date: offsetDateISO(2),
      outfitId: 'demo_outfit_2',
      notes: 'Morning espresso meeting + design sprint.',
      createdAt: new Date().toISOString(),
    },
  ];
}
