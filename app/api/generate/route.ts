import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/generate

   Current behaviour (v0):
     - Accepts a JSON body: { ingredients, cuisine, time }
     - Returns mock recipe data for rapid frontend iteration.

   Future integration plan:
     1. Claude 3.5 Sonnet (Anthropic API)
        - Prompt: "You are a master chef of {cuisine} Chinese cuisine.
          Given these ingredients: {ingredients}, generate a complete
          recipe in English with: (a) dish name, (b) ingredient list
          with quantities, (c) step-by-step instructions, (d) a short
          historical or cultural story behind the dish, (e) health /
          TCM wellness benefits."
        - Parse the structured JSON response from Claude.

     2. Flux.1-schnell (via Replicate / Fal.ai)
        - Use the dish name + a style prompt to generate a high-res
          food photograph: "Professional food photography of {dishName},
          Chinese {cuisine} cuisine, overhead shot, warm lighting,
          rustic ceramic plate, 8K."
        - Store the generated image URL alongside the recipe.

     3. Replace the mock arrays below with real API calls.
   ═══════════════════════════════════════════════════════════════ */

/* ─── Mock data pool ──────────────────────────────────────────── */

const MOCK_RECIPES: Record<
  string,
  {
    title: string;
    snippet: string;
    fullRecipe: string;
    history: string;
    wellness: string;
  }
> = {
  chuan_chicken: {
    title: "Kung Pao Chicken (宫保鸡丁)",
    snippet:
      "A fiery Sichuan classic combining tender diced chicken, roasted peanuts, and dried chilies in a sweet-sour-soy glaze. Ready in under 30 minutes.",
    fullRecipe:
      "1. Marinate chicken cubes in soy sauce, Shaoxing wine, and cornstarch for 15 min.\n2. Stir-fry dried chilies and Sichuan peppercorns in hot oil until fragrant.\n3. Add chicken, sear until golden.\n4. Toss in diced scallions, ginger, garlic, and roasted peanuts.\n5. Pour in the sauce (soy, black vinegar, sugar, sesame oil).\n6. Serve immediately over steamed rice.",
    history:
      "Named after Ding Baozhen (丁宝桢), a Qing-dynasty governor whose official title was 'Gong Bao.' His personal chef created this dish, which later became a Sichuan staple.",
    wellness:
      "Sichuan peppercorns are believed in TCM to warm the stomach and dispel dampness. Chicken provides lean protein, while the vinegar aids digestion.",
  },
  chuan_tofu: {
    title: "Mapo Tofu (麻婆豆腐)",
    snippet:
      "Silky tofu swimming in a bold, numbing chili-bean sauce with minced pork. The soul of Sichuan home cooking.",
    fullRecipe:
      "1. Blanch cubed silken tofu in salted boiling water for 2 min, drain gently.\n2. Stir-fry minced pork with doubanjiang (fermented broad bean paste) until the oil turns red.\n3. Add ginger, garlic, fermented black beans, and chili flakes.\n4. Pour in stock, slide in tofu, simmer 5 min.\n5. Thicken with cornstarch slurry, finish with ground Sichuan pepper and scallions.",
    history:
      "Invented in 1862 by a pockmarked ('ma') woman ('po') named Chen at her restaurant near Wanfu Bridge in Chengdu. The dish has survived over 150 years unchanged in spirit.",
    wellness:
      "Tofu is rich in plant protein and isoflavones. The chili and pepper combination is said to promote circulation and expel cold in TCM theory.",
  },
  yue_fish: {
    title: "Steamed Fish Cantonese Style (清蒸鱼)",
    snippet:
      "Whole fresh fish steamed to perfection with ginger and scallions, finished with sizzling soy oil. The essence of Cantonese elegance.",
    fullRecipe:
      "1. Score a whole fresh fish (sea bass or tilapia) on both sides.\n2. Place on a bed of ginger slices and scallion whites, steam 8–10 min.\n3. Discard the cloudy steaming liquid.\n4. Top with fresh julienned scallions and ginger.\n5. Heat peanut oil until smoking, pour over the aromatics.\n6. Drizzle with seasoned soy sauce. Serve immediately.",
    history:
      "Steaming is the oldest Chinese cooking technique, dating back to the Zhou dynasty (1046–256 BC). Cantonese chefs perfected it as the ultimate test of ingredient freshness.",
    wellness:
      "Steaming preserves omega-3 fatty acids and requires no added fat. Ginger warms the middle burner (stomach/spleen) in TCM, aiding digestion of fish.",
  },
  lu_braised: {
    title: "Braised Sea Cucumber with Scallions (葱烧海参)",
    snippet:
      "A regal Shandong banquet dish — tender sea cucumber simmered in a rich scallion-infused brown sauce.",
    fullRecipe:
      "1. Rehydrate dried sea cucumber over 3 days, changing water daily.\n2. Sauté thick scallion sections until golden and aromatic.\n3. Add sea cucumber, Shaoxing wine, dark and light soy, sugar, and stock.\n4. Braise on low heat for 20–30 min until gelatinous.\n5. Reduce sauce until glossy, plate with scallions on top.",
    history:
      "Sea cucumber has been prized in Shandong since the Ming dynasty. It was served at state banquets and symbolizes wealth and hospitality.",
    wellness:
      "Sea cucumber is a renowned TCM ingredient, rich in collagen and chondroitin. It is believed to nourish the kidney essence (jing) and support joint health.",
  },
  xiang_stirfry: {
    title: "Chairman Mao's Red-Braised Pork (毛氏红烧肉)",
    snippet:
      "Hunan's most iconic dish — pork belly slow-braised in caramelized sugar, soy, and star anise until melt-in-your-mouth tender.",
    fullRecipe:
      "1. Blanch pork belly cubes, drain.\n2. Caramelize rock sugar in a dry wok until amber.\n3. Add pork, stir to coat with caramel.\n4. Pour in Shaoxing wine, light soy, dark soy, star anise, cinnamon, and dried chili.\n5. Add water to cover, simmer 90 min until the meat is fork-tender.\n6. Reduce sauce over high heat, serve with steamed buns.",
    history:
      "A favourite of Chairman Mao Zedong, who was born in Hunan. His personal chef refined this dish, and it is now served in Hunanese restaurants worldwide.",
    wellness:
      "Pork belly is considered warming and nourishing in TCM. Star anise aids digestion, while the long braise renders much of the fat, making it surprisingly digestible.",
  },
  default_base: {
    title: "Wok-Seared Ginger Chicken with Seasonal Greens",
    snippet:
      "A quick, aromatic stir-fry that works with whatever greens you have on hand. Classic Chinese home cooking at its simplest.",
    fullRecipe:
      "1. Slice chicken breast against the grain, marinate with soy, wine, and cornstarch.\n2. Heat wok until smoking, add oil, sear chicken until just cooked. Remove.\n3. Stir-fry sliced ginger and garlic until fragrant.\n4. Add seasonal greens (bok choy, gai lan, or cabbage), toss with a splash of water.\n5. Return chicken, season with oyster sauce and white pepper. Serve over rice.",
    history:
      "The wok has been central to Chinese cooking for over 2,000 years. This quick-stir-fry method evolved from the need to cook efficiently with scarce fuel.",
    wellness:
      "Ginger is a TCM powerhouse — anti-inflammatory, warming, and digestive. Paired with lean chicken and leafy greens, this is a balanced one-pan meal.",
  },
};

/* ─── Helper: pick mock based on cuisine ──────────────────────── */

function pickMockRecipes(cuisine: string) {
  const cuisineLower = cuisine.toLowerCase();

  let pool: typeof MOCK_RECIPES[keyof typeof MOCK_RECIPES][] = [];

  if (cuisineLower === "chuan" || cuisineLower === "sichuan") {
    pool = [MOCK_RECIPES.chuan_chicken, MOCK_RECIPES.chuan_tofu];
  } else if (cuisineLower === "yue" || cuisineLower === "cantonese") {
    pool = [MOCK_RECIPES.yue_fish];
  } else if (cuisineLower === "lu" || cuisineLower === "shandong") {
    pool = [MOCK_RECIPES.lu_braised];
  } else if (cuisineLower === "xiang" || cuisineLower === "hunan") {
    pool = [MOCK_RECIPES.xiang_stirfry];
  } else {
    // Su, Zhe, Min, Hui — use generic
    pool = [MOCK_RECIPES.default_base];
  }

  return pool;
}

/* ─── Route handler ───────────────────────────────────────────── */

export async function POST(request: Request) {
  let body: { ingredients?: string; cuisine?: string; time?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ingredients = "", cuisine = "Chuan", time = "<30min" } = body;

  if (!ingredients.trim()) {
    return NextResponse.json({ error: "ingredients is required" }, { status: 400 });
  }

  // Simulate async work (future: call Claude 3.5 Sonnet here)
  await new Promise((r) => setTimeout(r, 1200));

  const mockPool = pickMockRecipes(cuisine);

  const recipes = mockPool.map((r, i) => ({
    id: `${Date.now()}-${i}`,
    title: r.title,
    snippet: r.snippet,
    fullRecipe: r.fullRecipe,
    history: r.history,
    wellness: r.wellness,
    // Placeholder image — replace with Flux.1-schnell generated image in production
    imageUrl: `https://placehold.co/600x400/1a1a2e/e0e0e0?text=${encodeURIComponent(r.title.slice(0, 20))}`,
  }));

  return NextResponse.json({ recipes, meta: { cuisine, time, ingredients } });
}
