#!/usr/bin/env node
/**
 * Build a Shopify-ready catalog from the local Instagram data export in Media/.
 * Does not scrape Instagram — reads already-exported JSON + files only.
 *
 * Usage:
 *   node scripts/build-media-catalog.mjs
 *   → writes data/media-catalog.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mediaRoot = fs.existsSync(path.join(root, "Media"))
  ? path.join(root, "Media")
  : path.join(root, "media");

function fixMojibake(s) {
  if (!s) return "";
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
    return s;
  }
}

function slugify(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(mediaRoot, rel), "utf8"));
}

/** @type {Array<{pattern: RegExp, title: string, type: string, tags: string[], description: string}>} */
const PRODUCT_RULES = [
  {
    pattern: /canvas photo frame|instant.?film|easel/i,
    title: "Canvas Photo Frame",
    type: "Desk Decor",
    tags: ["desk", "photo-frame", "decor"],
    description:
      "A miniature canvas-style frame for Instax and small prints. Matte 3D-printed stand and border — clean lines, desk-ready, print-to-order.",
  },
  {
    pattern: /diamond sword|minecraft/i,
    title: "Minecraft Diamond Sword",
    type: "Collectibles",
    tags: ["gaming", "collectible", "minecraft-inspired"],
    description:
      "Pixel-true diamond sword collectible. Crisp edges, solid in the hand, made for shelves and gaming desks. Print-to-order.",
  },
  {
    pattern: /gta\s*vi/i,
    title: "GTA VI Keychain",
    type: "Keychains",
    tags: ["keychain", "gaming"],
    description:
      "Bold retro GTA VI–inspired keychain with a multicolor finish. Pocket-sized hype for keys and bags. Print-to-order.",
  },
  {
    pattern: /mini organizer shelf|arch aesthetic/i,
    title: "Mini Organizer Shelf",
    type: "Desk Organizers",
    tags: ["organizer", "desk", "shelf"],
    description:
      "Arched mini shelf for jewelry, skincare, or desk clutter. Modern silhouette, tactile print layers, print-to-order.",
  },
  {
    pattern: /father.?s day|mentor and dream|superhero sculpture/i,
    title: "Father's Day Superhero Sculpture",
    type: "Sculptures",
    tags: ["sculpture", "gift", "low-poly"],
    description:
      "Low-poly mentor-and-hero sculpture. Weight and stance that feel collectible — a gift piece with presence. Print-to-order.",
  },
  {
    pattern: /plantosaurus/i,
    title: "Plantosaurus Planter",
    type: "Planters",
    tags: ["planter", "dino", "decor"],
    description:
      "Dino meets planter. Compact 3D-printed Plantosaurus for small greens — playful silhouette, sturdy print. Print-to-order.",
  },
  {
    pattern: /abstract vase/i,
    title: "Abstract Vase",
    type: "Home Decor",
    tags: ["vase", "decor", "minimal"],
    description:
      "Sculptural abstract vase with smooth curves and layered texture. Statement desk or shelf piece. Print-to-order.",
  },
  {
    pattern: /hogwarts/i,
    title: "Hogwarts Castle",
    type: "Collectibles",
    tags: ["castle", "collectible", "featured"],
    description:
      "Detailed Hogwarts-inspired castle print. Towers and bridges in patient layers — a display piece for true fans. Print-to-order.",
  },
  {
    pattern: /charizard|fire dragon collectible/i,
    title: "Charizard Collectible",
    type: "Collectibles",
    tags: ["pokemon-inspired", "collectible"],
    description:
      "Fire-dragon desk collectible in vibrant multicolor filament. Iconic stance, collector-scale detail. Print-to-order.",
  },
  {
    pattern: /galactic buddy|space companion/i,
    title: "Galactic Buddy",
    type: "Collectibles",
    tags: ["sci-fi", "desk-buddy", "mini"],
    description:
      "Tiny galactic companion for laptop corners and desks. Soft sci-fi charm in a pocket-scale print. Print-to-order.",
  },
  {
    pattern: /sneaker keychain|street style, mini size/i,
    title: "Sneaker Keychain",
    type: "Keychains",
    tags: ["keychain", "sneaker", "streetwear"],
    description:
      "Mini sneaker keychain with clean lines and bold colorways. Street energy on your keys. Print-to-order.",
  },
  {
    pattern: /f1 collection|from track to table/i,
    title: "F1 Collection",
    type: "Racing",
    tags: ["f1", "racing", "collection", "featured"],
    description:
      "F1-inspired coasters, keyrings, and signs. Speed-coded details for racing desks and garages. Print-to-order.",
  },
  {
    pattern: /psyduck/i,
    title: "Psyduck Figure",
    type: "Collectibles",
    tags: ["pokemon-inspired", "desk-buddy"],
    description:
      "Confused, cute, iconic. Psyduck-inspired desk figure with soft character and solid print feel. Print-to-order.",
  },
  {
    pattern: /clean desk, clear mind|desk organizer designed/i,
    title: "Desk Organizer",
    type: "Desk Organizers",
    tags: ["organizer", "desk", "minimal"],
    description:
      "Compact desk organizer — minimal footprint, sorted essentials. Functional geometry, print-to-order.",
  },
  {
    pattern: /two hands one heart|open it to say i love you|tiny surprise with a big feeling/i,
    title: "Love Box Surprise",
    type: "Gifts",
    tags: ["gift", "valentine", "keepsake"],
    description:
      "A tiny openable keepsake that says I love you without saying much. Solid hinges, soft gesture. Print-to-order.",
  },
  {
    pattern: /gecko|flexible and full of life/i,
    title: "Flexi Gecko",
    type: "Flexi Toys",
    tags: ["flexi", "articulated", "gecko"],
    description:
      "Spotted articulated gecko — flexes joint by joint. Desk fidget and shelf creature in one. Print-to-order.",
  },
  {
    pattern: /black cat figurine|55\s*🐈/i,
    title: "Black Cat Figurine",
    type: "Collectibles",
    tags: ["cat", "figurine", "minimal"],
    description:
      "Minimal black cat with bold yellow eyes. Quiet charm for shelves and nightstands. Print-to-order.",
  },
  {
    pattern: /stitch|little blue (character|buddy)|cute quirky and full of personality/i,
    title: "Stitch Figure",
    type: "Collectibles",
    tags: ["stitch", "desk-buddy", "featured"],
    description:
      "Blue desk buddy with big personality in a compact print. Soft curves, collectible stance. Print-to-order.",
  },
  {
    pattern: /stranger things/i,
    title: "Stranger Things Keychain",
    type: "Keychains",
    tags: ["keychain", "tv-inspired"],
    description:
      "Upside-Down energy on a keyring. Creepy-cool detail for fans who like their carry weird. Print-to-order.",
  },
  {
    pattern: /crocodile keychain|naughty crocodile/i,
    title: "Crocodile Keychain",
    type: "Keychains",
    tags: ["keychain", "flexi", "crocodile"],
    description:
      "Small crocodile keychain with big attitude. Flexible bite of color for bags and keys. Print-to-order.",
  },
  {
    pattern: /fox keychain/i,
    title: "Fox Keychain",
    type: "Keychains",
    tags: ["keychain", "fox", "flexi"],
    description:
      "Playful fox keychain — bright color, flexible details, ready for keys or gifting. Print-to-order.",
  },
  {
    pattern: /angry baby chicken|grumpy buddy/i,
    title: "Angry Baby Chicken",
    type: "Collectibles",
    tags: ["desk-buddy", "chicken", "cute"],
    description:
      "Tiny grumpy chicken. Soft body, loud mood — a smile-sized desk companion. Print-to-order.",
  },
  {
    pattern: /balance and freedom|sculptural form represents inner strength/i,
    title: "Balance Freedom Sculpture",
    type: "Sculptures",
    tags: ["sculpture", "art", "minimal"],
    description:
      "Motion caught in filament — a balance sculpture with calm curves and engineering presence. Print-to-order.",
  },
  {
    pattern: /warm glow lamp/i,
    title: "Warm Glow Lamp",
    type: "Lighting",
    tags: ["lamp", "desk", "mood"],
    description:
      "Soft-curve lamp with a warm, calm glow. Bedside and desk mood lighting in layered print. Print-to-order.",
  },
  {
    pattern: /2026 glasses/i,
    title: "2026 Party Glasses",
    type: "Props",
    tags: ["party", "prop", "new-year"],
    description:
      "Lightweight 2026 glasses prop for parties, reels, and countdown shots. Fun, wearable print. Print-to-order.",
  },
  {
    pattern: /pok[ée]ball keychain/i,
    title: "Pokéball Keychain",
    type: "Keychains",
    tags: ["keychain", "pokemon-inspired"],
    description:
      "Classic Pokéball keychain — compact, clean, nostalgia on a ring. Print-to-order.",
  },
  {
    pattern: /weightless, balanced|modern 3d sculpture that feels/i,
    title: "Modern Balance Sculpture",
    type: "Sculptures",
    tags: ["sculpture", "art", "minimal"],
    description:
      "Modern sculpture that feels weightless and strong. Minimal form, maximum shelf impact. Print-to-order.",
  },
  {
    pattern: /porsche gt3/i,
    title: "Porsche GT3 Wall Art",
    type: "Automotive",
    tags: ["car", "wall-art", "porsche-inspired"],
    description:
      "Porsche GT3 silhouette as a sleek wall or desk piece. Iconic lines, garage attitude. Print-to-order.",
  },
  {
    pattern: /pikachu keychain/i,
    title: "Pikachu Keychain",
    type: "Keychains",
    tags: ["keychain", "pokemon-inspired"],
    description:
      "Pocket-cute Pikachu-inspired keychain. Bright, nostalgic, ready to gift. Print-to-order.",
  },
  {
    pattern: /\bjain\b|name piece|turning names into/i,
    title: "Custom Name Décor",
    type: "Custom",
    tags: ["custom", "name", "decor"],
    description:
      "Your name as minimal desk décor. Clean letterforms, personal shelf presence. Print-to-order — share the name at checkout notes.",
  },
  {
    pattern: /mini message stand/i,
    title: "Mini Message Stand",
    type: "Desk Decor",
    tags: ["desk", "sign", "gift"],
    description:
      "Tiny roadside-style message stand for desks and study tables. Small words, daily smile. Print-to-order.",
  },
  {
    pattern: /coolest little rebel|funky 3d mini figure/i,
    title: "Rebel Mini Figure",
    type: "Collectibles",
    tags: ["figurine", "desk-buddy"],
    description:
      "Edgy mini figure with attitude and balance. Desk rebel for collectors who like edge. Print-to-order.",
  },
  {
    pattern: /panda hoodie keychain/i,
    title: "Panda Hoodie Keychain",
    type: "Keychains",
    tags: ["keychain", "panda"],
    description:
      "Hoodie panda keychain — cute meets cool on bags and backpacks. Print-to-order.",
  },
  {
    pattern: /puffy letter/i,
    title: "Puffy Letter Keychain",
    type: "Keychains",
    tags: ["keychain", "letter", "custom"],
    description:
      "Soft-look puffy letter keychains A–Z. Initials and names, lightweight and loud. Print-to-order — pick your letter.",
  },
  {
    pattern: /turn memories into models|photo can become a detailed 3d/i,
    title: "Custom Photo Figure",
    type: "Custom",
    tags: ["custom", "keepsake", "figure"],
    description:
      "Your photo, printed as a keepsake figure. Couples, families, moments — personal and lasting. Print-to-order.",
  },
  {
    pattern: /tumbler keychain/i,
    title: "Mini Tumbler Keychain",
    type: "Keychains",
    tags: ["keychain", "pastel"],
    description:
      "Mini tumbler keychain in soft pastels. Trendy daily carry detail. Print-to-order.",
  },
  {
    pattern: /make it yours/i,
    title: "Make It Yours Custom",
    type: "Custom",
    tags: ["custom", "personalize"],
    description:
      "Custom colorways and personalization on select Toying Idea pieces. Tell us your vibe — we print it. Print-to-order.",
  },
  {
    pattern: /flexi dragon/i,
    title: "Flexi Dragon",
    type: "Flexi Toys",
    tags: ["flexi", "dragon", "articulated", "featured"],
    description:
      "Articulated flexi dragon — jointed spine, poseable presence. Desk legend in motion. Print-to-order.",
  },
  {
    pattern: /robo[- ]?skull/i,
    title: "Robo Skull Collectible",
    type: "Collectibles",
    tags: ["skull", "sci-fi", "collectible"],
    description:
      "Robo-skull mini collectible for sci-fi shelves and student desks. High detail, compact scale. Print-to-order.",
  },
  {
    pattern: /cat knight|batman mask|pet-safe/i,
    title: "Pet Batman Mask",
    type: "Pet Accessories",
    tags: ["pet", "mask", "fun"],
    description:
      "Lightweight Batman-style mask for pets — photo-ready, comfy, designed for short safe wears. Print-to-order.",
  },
  {
    pattern: /bike keychain|bike-outline/i,
    title: "Bike Keychain",
    type: "Keychains",
    tags: ["keychain", "bike", "rider"],
    description:
      "Clean bike-outline keychain for riders. Light, durable, sharp silhouette. Print-to-order.",
  },
  {
    pattern: /mini jeep|military-style/i,
    title: "Military Mini Jeep",
    type: "Collectibles",
    tags: ["jeep", "vehicle", "collectible"],
    description:
      "Military-style mini Jeep in multi-tone finish. Assembled detail for desk display. Print-to-order.",
  },
  {
    pattern: /jacket|hoodie.*organis|style meet storage/i,
    title: "Mini Jacket Organizer",
    type: "Desk Organizers",
    tags: ["organizer", "jacket", "desk"],
    description:
      "Mini jacket and hoodie organizers — storage that looks like streetwear. Desk statement pieces. Print-to-order.",
  },
  {
    pattern: /kakashi/i,
    title: "Kakashi Art Blank",
    type: "DIY",
    tags: ["anime", "blank", "paint-your-own"],
    description:
      "White Kakashi blank for paint-your-own finishes. Your colors, your Copy Ninja. Print-to-order.",
  },
  {
    pattern: /naruto/i,
    title: "Naruto Wall Art",
    type: "Wall Art",
    tags: ["anime", "wall-art"],
    description:
      "Bold Naruto silhouette cut for wall or desk. Sharp lines in a ready frame vibe. Print-to-order.",
  },
  {
    pattern: /coaster drop|ocean waves/i,
    title: "Ocean Wave Coasters",
    type: "Home Decor",
    tags: ["coaster", "ocean"],
    description:
      "Ocean-wave coasters with deep blue detail and a smooth premium feel. Table calm, print-to-order.",
  },
  {
    pattern: /mustang|muscle mood|1:64 scale stand/i,
    title: "Mustang Display Stand",
    type: "Automotive",
    tags: ["mustang", "display", "1-64"],
    description:
      "1:64 muscle-car display stand with honeycomb slots and Mustang energy. Garage shelf ready. Print-to-order.",
  },
  {
    pattern: /motogp/i,
    title: "MotoGP Circuit Board",
    type: "Racing",
    tags: ["motogp", "racing", "wall-art"],
    description:
      "MotoGP circuit board — twenty tracks mapped in orange energy. For riders and race-day walls. Print-to-order.",
  },
  {
    pattern: /2026 season is mapped|melbourne to abu dhabi/i,
    title: "F1 Season Circuit Board",
    type: "Racing",
    tags: ["f1", "circuit", "wall-art"],
    description:
      "Full-season F1 circuit board — Melbourne to Abu Dhabi on one display piece. Strategy meets speed. Print-to-order.",
  },
  {
    pattern: /parshwanath/i,
    title: "Parshwanath Bhagwan Idol",
    type: "Spiritual",
    tags: ["idol", "spiritual", "murti"],
    description:
      "Devotional Parshwanath Bhagwan murti with calm detail for desk or temple space. Print-to-order.",
  },
  {
    pattern: /ganesha/i,
    title: "Ganesha Murti",
    type: "Spiritual",
    tags: ["idol", "ganesha", "spiritual"],
    description:
      "Lord Ganesha idol in gold, white, or black finishes. Blessings in every layer for home or office. Print-to-order.",
  },
  {
    pattern: /fidget cube/i,
    title: "Fidget Cubes",
    type: "Fidgets",
    tags: ["fidget", "desk"],
    description:
      "Click, flip, twist fidget cubes for restless hands. Vibrant colors, satisfying mechanics. Print-to-order.",
  },
  {
    pattern: /skeleton/i,
    title: "Skeleton Buddies",
    type: "Collectibles",
    tags: ["skeleton", "keychain", "spooky"],
    description:
      "Skeleton duo — mini collectible and keychain options. Cute spook for desks and bags. Print-to-order.",
  },
  {
    pattern: /forever tulip/i,
    title: "Forever Tulip",
    type: "Home Decor",
    tags: ["flower", "decor", "tulip"],
    description:
      "Zero-maintenance tulip bloom. Plant-based filament, forever fresh on a shelf. Print-to-order.",
  },
  {
    pattern: /geometric planter/i,
    title: "Geometric Planters",
    type: "Planters",
    tags: ["planter", "geometric", "succulent"],
    description:
      "Geometric planters for succulents — modern facets, plant-based filament. Desk nature, print-to-order.",
  },
  {
    pattern: /custom name keychain/i,
    title: "Custom Name Keychain",
    type: "Keychains",
    tags: ["keychain", "custom", "name"],
    description:
      "Bright custom name keychains for bags and keys. Bold type, eco filament, gift-ready. Print-to-order.",
  },
  {
    pattern: /armored guardian/i,
    title: "Armored Guardian",
    type: "Collectibles",
    tags: ["armor", "figurine", "sci-fi"],
    description:
      "Futuristic armored guardian figure. Precision detail for bold display shelves. Print-to-order.",
  },
  {
    pattern: /ho ho ho/i,
    title: "Ho Ho Ho Decor Set",
    type: "Seasonal",
    tags: ["christmas", "decor", "set"],
    description:
      "Festive Ho Ho Ho décor set with cute holiday characters. Plant-based filament cheer. Print-to-order.",
  },
  {
    pattern: /twist maze puzzle/i,
    title: "Twist Maze Puzzle",
    type: "Puzzles",
    tags: ["puzzle", "fidget"],
    description:
      "Twist-cylinder maze puzzle — addictive, stylish, plant-based filament. Desk brain teaser. Print-to-order.",
  },
  {
    pattern: /spotify keychain/i,
    title: "Custom Spotify Keychain",
    type: "Keychains",
    tags: ["keychain", "custom", "spotify"],
    description:
      "Custom Spotify-code keychain for a song or moment. Always in your pocket. Print-to-order.",
  },
  {
    pattern: /skull hair stick/i,
    title: "Skull Hair Stick",
    type: "Accessories",
    tags: ["hair", "skull", "accessory"],
    description:
      "Edgy skull-and-bone hair stick. Statement accessory in plant-based filament. Print-to-order.",
  },
  {
    pattern: /floating form sculpt/i,
    title: "Floating Form Sculpt",
    type: "Sculptures",
    tags: ["sculpture", "minimal", "art"],
    description:
      "Suspended floating-form sculpture — calm, futuristic, minimal presence. Print-to-order.",
  },
  {
    pattern: /coffee cup buddy/i,
    title: "Coffee Cup Buddy",
    type: "Collectibles",
    tags: ["coffee", "desk-buddy"],
    description:
      "Mini coffee-cup companion for morning desks. Small charm, solid print. Print-to-order.",
  },
  {
    pattern: /bart simpson/i,
    title: "Bart Simpson",
    type: "Collectibles",
    tags: ["simpson", "collectible", "featured"],
    description:
      "Bart Simpson–inspired collectible with mischievous stance. Nostalgia for the shelf. Print-to-order.",
  },
  {
    pattern: /pikachu.?décor|bring the spark of joy|PIKACHU/i,
    title: "Pikachu Décor",
    type: "Collectibles",
    tags: ["pokemon-inspired", "decor"],
    description:
      "Cheerful Pikachu-inspired décor for desks and display corners. Electric cuteness, print-to-order.",
  },
  {
    pattern: /christmas.?décor|jolly santa|santa and fluffy/i,
    title: "Christmas Santa Décor",
    type: "Seasonal",
    tags: ["christmas", "santa", "decor"],
    description:
      "Jolly Santa holiday décor with soft snow vibes. Desk and table warmth. Print-to-order.",
  },
  {
    pattern: /iron man helmet piggy/i,
    title: "Iron Man Helmet Piggy Bank",
    type: "Collectibles",
    tags: ["marvel-inspired", "piggy-bank"],
    description:
      "Multicolor Iron Man helmet piggy bank — save coins in style. Decor and function. Print-to-order.",
  },
  {
    pattern: /capybara/i,
    title: "Holiday Capybara Collection",
    type: "Seasonal",
    tags: ["capybara", "christmas", "collection"],
    description:
      "Holiday capybaras — Santa hat, ribbon, and ride-along cheer. Adorable seasonal set. Print-to-order.",
  },
  {
    pattern: /snowflake coaster/i,
    title: "Snowflake Coaster Set",
    type: "Home Decor",
    tags: ["coaster", "winter", "set"],
    description:
      "Intricate snowflake coaster sets in multi-color winter magic. Protect tables with detail. Print-to-order.",
  },
  {
    pattern: /sitting snowman|articulated sitting snowman/i,
    title: "Articulated Sitting Snowman",
    type: "Flexi Toys",
    tags: ["snowman", "flexi", "seasonal"],
    description:
      "Articulated sitting snowman — poseable festive friend for the 365-day challenge kickoff. Print-to-order.",
  },
  {
    pattern: /lights out and away we go|f1.?model|circuit to your desk/i,
    title: "F1 Desk Model",
    type: "Racing",
    tags: ["f1", "model", "desk"],
    description:
      "Circuit thrill as a desk model. Racing lines in a fresh print for fans of lights-out starts. Print-to-order.",
  },
  {
    pattern: /tiny garage with a big vibe/i,
    title: "Mini Garage Display",
    type: "Automotive",
    tags: ["garage", "display", "cars"],
    description:
      "Tiny garage scene with big collector vibe. Compact display energy for car shelves. Print-to-order.",
  },
  {
    pattern: /bold.?layered and built to stand out|attitude and style to your collection/i,
    title: "Layered Statement Figure",
    type: "Collectibles",
    tags: ["figurine", "statement"],
    description:
      "Bold layered figure built to stand out. Attitude and style for serious shelves. Print-to-order.",
  },
  {
    pattern: /flexi love cat|love cat keyring/i,
    title: "Flexi Love Cat Keyring",
    type: "Keychains",
    tags: ["keychain", "cat", "flexi", "featured"],
    description:
      "Articulated love-cat keyring — flexible charm for everyday carry. Print-to-order.",
  },
  {
    pattern: /flexi caterpillar|caterpillar/i,
    title: "Flexi Caterpillar",
    type: "Flexi Toys",
    tags: ["flexi", "caterpillar", "featured"],
    description:
      "Jointed flexi caterpillar — bendy, colorful, endlessly fidgetable. Print-to-order.",
  },
  {
    pattern: /power, attitude, and sharp details|anime-inspired figure/i,
    title: "Anime Stance Figure",
    type: "Collectibles",
    tags: ["anime", "figurine"],
    description:
      "Anime-inspired stance figure with sharp details and vibrant color. Fan-shelf energy. Print-to-order.",
  },
  {
    pattern: /^❤️|two hands|i love you|valentines?/i,
    title: "Love Box Surprise",
    type: "Gifts",
    tags: ["gift", "valentine", "keepsake"],
    description:
      "A tiny openable keepsake that says I love you without saying much. Solid hinges, soft gesture. Print-to-order.",
  },
];

const SKIP = [
  /welcome to the toying idea/i,
  /proud to collaborate/i,
  /happy new year/i,
  /our website is live/i,
  /behind every bulk order/i,
];

function matchRule(caption) {
  for (const rule of PRODUCT_RULES) {
    if (rule.pattern.test(caption)) return rule;
  }
  return null;
}

function extractPost(post) {
  for (const lv of post.label_values || []) {
    if (lv.label === "Media" && lv.media?.length) {
      let caption = "";
      for (const m of lv.media) {
        if ((m.title || "").trim()) {
          caption = fixMojibake(m.title);
          break;
        }
      }
      return { caption, media: lv.media, timestamp: post.timestamp };
    }
  }
  return { caption: "", media: [], timestamp: post.timestamp };
}

function absPath(uri) {
  return path.join(mediaRoot, uri);
}

function main() {
  const posts = loadJson("your_instagram_activity/media/posts.json");
  const posts1 = loadJson("your_instagram_activity/media/posts_1.json");
  let reels = [];
  try {
    reels = loadJson("your_instagram_activity/media/reels.json").ig_reels_media || [];
  } catch {
    reels = [];
  }

  const p1ByTs = new Map();
  for (const p of posts1) {
    const ts = p.creation_timestamp;
    if (ts != null) p1ByTs.set(ts, p);
    for (const m of p.media || []) {
      if (m.creation_timestamp != null && !p1ByTs.has(m.creation_timestamp)) {
        p1ByTs.set(m.creation_timestamp, p);
      }
    }
  }

  /** @type {Map<string, any>} */
  const byHandle = new Map();

  function upsert({ title, description, productType, tags, uris, caption, source }) {
    if (SKIP.some((r) => r.test(caption || title))) return;
    const handle = slugify(title);
    if (!handle) return;
    const images = [];
    const videos = [];
    for (const uri of uris) {
      if (!uri) continue;
      const full = absPath(uri);
      if (!fs.existsSync(full)) continue;
      const ext = path.extname(uri).toLowerCase();
      if (ext === ".mp4" || ext === ".mov") videos.push(uri);
      else if ([".heic", ".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) images.push(uri);
    }
    if (!images.length && !videos.length) return;

    if (!byHandle.has(handle)) {
      byHandle.set(handle, {
        handle,
        title,
        description,
        productType,
        tags: [...new Set(["toying-idea", "3d-printed", "print-to-order", ...(tags || [])])],
        price: 999,
        currency: "INR",
        status: "DRAFT",
        images: [],
        videos: [],
        sources: [],
        captions: [],
      });
    }
    const entry = byHandle.get(handle);
    for (const u of images) if (!entry.images.includes(u)) entry.images.push(u);
    for (const u of videos) if (!entry.videos.includes(u)) entry.videos.push(u);
    entry.sources.push(source);
    if (caption) entry.captions.push(caption.slice(0, 240));
  }

  for (const post of posts) {
    const { caption, media, timestamp } = extractPost(post);
    if (!media.length) continue;
    if (SKIP.some((r) => r.test(caption))) continue;

    const rule = matchRule(caption);
    if (!rule) {
      // Ambiguous — keep as review item later
      continue;
    }

    const uris = media.map((m) => m.uri).filter(Boolean);
    const carousel = p1ByTs.get(timestamp);
    if (carousel?.media?.length) {
      for (const m of carousel.media) {
        if (m.uri && !uris.includes(m.uri)) uris.push(m.uri);
      }
    }

    upsert({
      title: rule.title,
      description: rule.description,
      productType: rule.type,
      tags: rule.tags,
      uris,
      caption,
      source: "post",
    });
  }

  for (const reel of reels) {
    for (const m of reel.media || []) {
      const caption = fixMojibake(m.title || "");
      if (!caption || SKIP.some((r) => r.test(caption))) continue;
      const rule = matchRule(caption);
      if (!rule) continue;
      upsert({
        title: rule.title,
        description: rule.description,
        productType: rule.type,
        tags: rule.tags,
        uris: m.uri ? [m.uri] : [],
        caption,
        source: "reel",
      });
    }
  }

  const products = [...byHandle.values()].sort((a, b) => a.title.localeCompare(b.title));
  const ambiguous = [];
  for (const post of posts) {
    const { caption, media } = extractPost(post);
    if (!media.length || !caption) continue;
    if (SKIP.some((r) => r.test(caption))) continue;
    if (!matchRule(caption)) {
      ambiguous.push({
        firstLine: caption.split("\n")[0].slice(0, 120),
        uris: media.map((m) => m.uri),
      });
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    mediaRoot: path.relative(root, mediaRoot),
    assumptions: [
      "Grouped by Instagram post captions from the local data export (not scraped).",
      "Carousel images attached when posts_1.json shares the same creation timestamp.",
      "Sneaker and other multi-post products merged by matched product title/handle.",
      "Placeholder price 999 INR; status DRAFT so retail pricing can be set in Admin.",
      "HEIC will be converted to JPEG at import time for Shopify compatibility.",
    ],
    productCount: products.length,
    products,
    ambiguous,
    skippedPatterns: SKIP.map(String),
  };

  const outPath = path.join(root, "data", "media-catalog.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${products.length} products → ${outPath}`);
  console.log(`Ambiguous posts (not catalogued): ${ambiguous.length}`);
  for (const p of products) {
    console.log(
      `  ${p.handle} | imgs=${p.images.length} vids=${p.videos.length} | ${p.title}`
    );
  }
  if (ambiguous.length) {
    console.log("\nAmbiguous:");
    for (const a of ambiguous) console.log(`  - ${a.firstLine}`);
  }
}

main();
