// Food vocabulary: translating MyBaby's free-text solids (often Russian) into ingredient names, and allergen groups.
const RU = [
  ['кабачок', 'Zucchini'], ['цукини', 'Zucchini'], ['брокколи', 'Broccoli'], ['broccoli', 'Broccoli'], ['кур', 'Chicken'], ['индейк', 'Turkey'],
  ['авокадо', 'Avocado'], ['тыкв', 'Pumpkin'], ['банан', 'Banana'], ['лосос', 'Salmon'], ['треск', 'Cod'], ['рыб', 'Fish'],
  ['морков', 'Carrot'], ['картош', 'Potato'], ['картоф', 'Potato'], ['говяд', 'Beef'], ['телят', 'Veal'], ['свинин', 'Pork'], ['баранин', 'Lamb'],
  ['каш', 'Porridge'], ['овсян', 'Oats'], ['гречк', 'Buckwheat'], ['кускус', 'Couscous'], ['кукус', 'Couscous'], ['манго', 'Mango'],
  ['рис', 'Rice'], ['десерт', 'Dessert'], ['капуст', 'Cabbage'], ['цветн', 'Cauliflower'], ['батат', 'Sweet potato'], ['фетучини', 'Pasta'],
  ['макарон', 'Pasta'], ['паст', 'Pasta'], ['малин', 'Raspberry'], ['клубник', 'Strawberry'], ['черник', 'Blueberry'], ['яблок', 'Apple'],
  ['груш', 'Pear'], ['слив', 'Plum'], ['персик', 'Peach'], ['болоньез', 'Bolognese'], ['смузи', 'Smoothie'], ['фрукт', 'Fruit'],
  ['овощ', 'Vegetables'], ['горош', 'Peas'], ['фасол', 'Beans'], ['чечевиц', 'Lentils'], ['шпинат', 'Spinach'], ['свекл', 'Beetroot'],
  ['яйц', 'Egg'], ['желтк', 'Egg'], ['творог', 'Cottage cheese'], ['йогурт', 'Yoghurt'], ['кефир', 'Kefir'], ['сыр', 'Cheese'],
  ['хлеб', 'Bread'], ['арахис', 'Peanut'], ['кунжут', 'Sesame'], ['тахин', 'Sesame'], ['хумус', 'Hummus'], ['томат', 'Tomato'], ['помидор', 'Tomato'],
];
const EN = ['zucchini', 'broccoli', 'chicken', 'turkey', 'avocado', 'pumpkin', 'banana', 'salmon', 'cod', 'fish', 'carrot', 'potato', 'beef', 'porridge', 'oats', 'couscous', 'mango', 'rice', 'cabbage', 'cauliflower', 'sweet potato', 'pasta', 'raspberry', 'strawberry', 'blueberry', 'apple', 'pear', 'plum', 'peach', 'peas', 'beans', 'lentils', 'spinach', 'egg', 'yoghurt', 'yogurt', 'cheese', 'bread', 'peanut', 'sesame', 'hummus', 'tomato'];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export function parseFoods(text) {
  const s = (text || '').toLowerCase().trim();
  if (!s) return [];
  const out = [];
  for (const [k, v] of RU) if (s.includes(k) && !out.includes(v)) out.push(v);
  for (const k of EN) if (s.includes(k)) { const v = k === 'yogurt' ? 'Yoghurt' : cap(k); if (!out.includes(v)) out.push(v); }
  if (out.includes('Smoothie') && out.includes('Fruit')) { out.splice(out.indexOf('Smoothie'), 1); out[out.indexOf('Fruit')] = 'Fruit smoothie'; }
  if (out.includes('Sweet potato') && out.includes('Potato') && !/картош|картоф|potato/.test(s.replaceAll('sweet potato', ''))) out.splice(out.indexOf('Potato'), 1);
  if (!out.length) out.push(cap(s.split(/[,+]/)[0].trim()).slice(0, 40));
  return out;
}

// Allergen groups worth tracking (Danish guidance: introduce and keep in the diet).
export const ALLERGENS = [
  { key: 'egg', name: 'Egg', match: /egg|omelet/i, tip: 'Well cooked, about twice a week' },
  { key: 'peanut', name: 'Peanut', match: /peanut/i, tip: 'Smooth butter thinned into food; never whole nuts' },
  { key: 'dairy', name: 'Dairy', match: /yoghurt|yogurt|cheese|kefir|cottage|milk(?! formula)|butter(?!.*peanut)/i, tip: 'Plain yoghurt or cheese in food' },
  { key: 'wheat', name: 'Wheat', match: /pasta|bread|couscous|wheat|fettuc|bolognese/i, tip: 'Pasta, bread, couscous' },
  { key: 'fish', name: 'Fish', match: /salmon|cod|fish|tuna/i, tip: 'Not canned tuna before age 3' },
  { key: 'sesame', name: 'Sesame', match: /sesame|tahini|hummus/i, tip: 'Tahini or hummus' },
  { key: 'treenut', name: 'Tree nuts', match: /almond|cashew|hazelnut|walnut|nut butter/i, tip: 'Smooth nut butter, never whole nuts' },
  { key: 'soy', name: 'Soy', match: /soy|tofu|edamame/i, tip: 'Tofu or soy yoghurt' },
];

export const TEXTURES = [['puree', 'Smooth'], ['mashed', 'Mashed'], ['lumpy', 'Lumpy'], ['finger', 'Finger food']];
export const PORTIONS = [['taste', 'A taste'], ['some', 'Some'], ['most', 'Most'], ['all', 'All of it']];
export const REACTIONS = [['none', 'None'], ['rash', 'Rash'], ['vomit', 'Vomited'], ['other', 'Other']];
export const MILESTONES = ['First tooth', 'Rolls over', 'Sits unaided', 'Crawls', 'Pulls to stand', 'Cruises', 'First steps', 'Waves', 'Claps', 'First word', 'Pincer grasp', 'Drinks from cup'];
