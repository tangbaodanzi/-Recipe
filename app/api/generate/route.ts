import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════════
   POST /api/generate

   Pipeline:
     Step 1 — Text generation
       Primary:  Tencent Hunyuan (混元大模型) via OpenAI-compatible endpoint
                 Model: hunyuan-turbo
                 Docs:  https://cloud.tencent.com/document/product/1729
       Fallback: Local mock recipe data (no API key required)

     Step 2 — Image generation
       Primary:  Pollinations.ai (free, no API key)
                 URL: https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&model=flux
       Fallback: SiliconFlow Stable Diffusion (free tier, needs API key)
       Final:    placehold.co placeholder image

   Required .env.local variables (see .env.local.example):
     TENCENT_HUNYUAN_API_KEY  — your Tencent Cloud API key
     TENCENT_HUNYUAN_SECRET_ID  — (optional) Tencent Cloud SecretId if using the SDK
     TENCENT_HUNYUAN_SECRET_KEY — (optional) Tencent Cloud SecretKey
     SILICONFLOW_API_KEY        — (optional) SiliconFlow API key for image fallback
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Types ──────────────────────────────────────────────────────── */

interface RecipePayload {
  ingredients: string;
  cuisine: string;
  time: string;
}

interface AiRecipe {
  title: string;
  titleZh: string;
  snippet: string;
  fullRecipe: string;
  history: string;
  wellness: string;
  imagePrompt: string;
}

interface RecipeCard {
  id: string;
  title: string;
  snippet: string;
  fullRecipe: string;
  history: string;
  wellness: string;
  imageUrl: string;
}

/* ═══════════════════════════════════════════════════════════════════
   STEP 1: TEXT GENERATION — Tencent Hunyuan (混元大模型)
   ═══════════════════════════════════════════════════════════════════ */

// Tencent Hunyuan provides an OpenAI-compatible chat completions endpoint.
// Base URL differs by region; the default below targets the public cloud API.
// If you are using Tencent Yuanqi (元器) instead of raw Hunyuan, swap the
// base URL to your Yuanqi knowledge-base endpoint and adjust auth headers.

const HUNYUAN_BASE_URL =
  process.env.TENCENT_HUNYUAN_BASE_URL ??
  "https://api.hunyuan.cloud.tencent.com/v1";

const HUNYUAN_API_KEY = process.env.TENCENT_HUNYUAN_API_KEY ?? "";

/**
 * Build a structured system prompt that forces Hunyuan to return clean JSON.
 * The cuisine label is translated to Chinese for better model comprehension.
 */
function buildHunyuanPrompt(payload: RecipePayload): string {
  const cuisineMap: Record<string, string> = {
    Chuan: "川菜 (Sichuan)",
    Lu: "鲁菜 (Shandong)",
    Yue: "粤菜 (Cantonese)",
    Su: "苏菜 (Jiangsu)",
    Zhe: "浙菜 (Zhejiang)",
    Min: "闽菜 (Fujian)",
    Xiang: "湘菜 (Hunan)",
    Hui: "徽菜 (Anhui)",
  };
  const cuisineName = cuisineMap[payload.cuisine] ?? payload.cuisine;

  return `
You are a master chef specializing in ${cuisineName} Chinese cuisine and a historian of Chinese culinary heritage.

A home cook has the following ingredients available: ${payload.ingredients}
They want to cook within: ${payload.time}

Generate 2 suitable recipes. Return ONLY valid JSON (no markdown, no extra text) in this shape:

[
  {
    "title": "Dish name in English only",
    "titleZh": "中文菜名",
    "snippet": "One-sentence English description (max 30 words).",
    "fullRecipe": "Numbered step-by-step cooking instructions in English, each step on a new line with 'N. ' prefix.",
    "history": "A short historical or folklore story about this dish in English (2-3 sentences).",
    "wellness": "TCM or nutritional health benefits in English (1-2 sentences).",
    "imagePrompt": "Detailed food photography prompt in English for an AI image generator: describe the dish, plating, lighting, camera angle, background. Use keywords like 'professional food photography, overhead shot, warm natural light, Chinese ceramic plate, 8K'."
  }
]

Rules:
- Use ONLY the listed ingredients plus common Chinese pantry staples (soy sauce, Shaoxing wine, ginger, garlic, scallion, sesame oil, cornstarch, rice, cooking oil).
- Keep total cook time under the requested limit.
- Every field must be in fluent, native-level English except "titleZh".
- The "imagePrompt" must be at least 30 words and photorealistic.
`.trim();
}

/**
 * Call Tencent Hunyuan chat completions.
 * Returns the parsed AIRecipe[] on success, or null on failure (triggers mock fallback).
 */
async function callHunyuan(payload: RecipePayload): Promise<AiRecipe[] | null> {
  if (!HUNYUAN_API_KEY) {
    console.warn("[Hunyuan] TENCENT_HUNYUAN_API_KEY not set — using mock data.");
    return null;
  }

  const systemPrompt = buildHunyuanPrompt(payload);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000); // 25s timeout

    const res = await fetch(`${HUNYUAN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HUNYUAN_API_KEY}`,
      },
      body: JSON.stringify({
        model: "hunyuan-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate 2 recipes using these ingredients: ${payload.ingredients}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[Hunyuan] API returned ${res.status}: ${await res.text().catch(() => "")}`
      );
      return null;
    }

    const json = await res.json();
    const rawContent: string =
      json?.choices?.[0]?.message?.content ?? "";

    // Hunyuan may wrap JSON in ```json ... ``` fences — strip them
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed: AiRecipe[] = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("[Hunyuan] Parsed result is not a non-empty array.");
      return null;
    }

    return parsed.slice(0, 2); // cap at 2 recipes
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[Hunyuan] Request timed out.");
    } else {
      console.error("[Hunyuan] Unexpected error:", err);
    }
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   STEP 2: IMAGE GENERATION — Pollinations.ai (free, primary)
                         — SiliconFlow (free tier, fallback)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Pollinations.ai is a free, no-auth image generation service.
 * The URL itself IS the image — embed it directly in an <img> tag.
 *
 * Docs: https://pollinations.ai
 *
 * Parameters via query string:
 *   width, height  — output dimensions (default 1024×1024)
 *   model          — "flux" | "turbo" | "flux-realism" (default "flux")
 *   seed           — for reproducible results (optional)
 *   nologo         — set to "true" to suppress the Pollinations watermark
 */
function buildPollinationsUrl(imagePrompt: string): string {
  const base = "https://image.pollinations.ai/prompt";
  const encoded = encodeURIComponent(imagePrompt);
  return `${base}/${encoded}?width=1024&height=1024&model=flux&nologo=true`;
}

/**
 * SiliconFlow image generation fallback.
 * Requires SILICONFLOW_API_KEY in .env.local.
 * Free tier: 100 images/day on sd-3-medium or sd-xl models.
 *
 * Docs: https://docs.siliconflow.cn/api-reference/images/images-generations
 */
async function generateImageSiliconFlow(
  imagePrompt: string
): Promise<string | null> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      "https://api.siliconflow.cn/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "stabilityai/stable-diffusion-3-medium",
          prompt: imagePrompt,
          num_images: 1,
          guidance_scale: 7.5,
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!res.ok) {
      console.error(`[SiliconFlow] HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    // SiliconFlow returns { images: [{ url: "..." }] }
    return json?.images?.[0]?.url ?? null;
  } catch (err) {
    console.error("[SiliconFlow] Error:", err);
    return null;
  }
}

/**
 * Generate an image URL for a single recipe.
 * Tries Pollinations.ai → SiliconFlow → placeholder.
 */
async function generateImage(imagePrompt: string): Promise<string> {
  // Pollinations.ai is free and always available
  const pollinationsUrl = buildPollinationsUrl(imagePrompt);

  // Optionally try SiliconFlow for a different style — if it works, use it.
  // If not, the Pollinations URL works as a direct image src and renders fine.
  const sfUrl = await generateImageSiliconFlow(imagePrompt);
  if (sfUrl) return sfUrl;

  return pollinationsUrl;
}

/* ═══════════════════════════════════════════════════════════════════
   FALLBACK: Mock recipe data (used when no LLM API key is configured)
   ═══════════════════════════════════════════════════════════════════ */

const MOCK_RECIPES: Record<
  string,
  Omit<AiRecipe, "imagePrompt">
> = {
  chuan_chicken: {
    title: "Kung Pao Chicken",
    titleZh: "宫保鸡丁",
    snippet:
      "A fiery Sichuan classic combining tender diced chicken, roasted peanuts, and dried chilies in a sweet-sour-soy glaze.",
    fullRecipe:
      "1. Marinate chicken cubes in soy sauce, Shaoxing wine, and cornstarch for 15 min.\n2. Stir-fry dried chilies and Sichuan peppercorns in hot oil until fragrant.\n3. Add chicken, sear until golden.\n4. Toss in diced scallions, ginger, garlic, and roasted peanuts.\n5. Pour in the sauce (soy, black vinegar, sugar, sesame oil).\n6. Serve immediately over steamed rice.",
    history:
      "Named after Ding Baozhen (丁宝桢), a Qing-dynasty governor. His personal chef created this dish, which became a Sichuan staple and a global icon of Chinese cuisine.",
    wellness:
      "Sichuan peppercorns warm the stomach and dispel dampness in TCM. Chicken provides lean protein; black vinegar aids digestion.",
  },
  chuan_tofu: {
    title: "Mapo Tofu",
    titleZh: "麻婆豆腐",
    snippet:
      "Silky tofu swimming in a bold, numbing chili-bean sauce with minced pork. The soul of Sichuan home cooking.",
    fullRecipe:
      "1. Blanch cubed silken tofu in salted boiling water for 2 min, drain gently.\n2. Stir-fry minced pork with doubanjiang until the oil turns red.\n3. Add ginger, garlic, fermented black beans, and chili flakes.\n4. Pour in stock, slide in tofu, simmer 5 min.\n5. Thicken with cornstarch slurry, finish with ground Sichuan pepper and scallions.",
    history:
      "Invented in 1862 by a pockmarked ('ma') woman ('po') named Chen at her Chengdu restaurant. The dish has survived over 150 years unchanged in spirit.",
    wellness:
      "Tofu is rich in plant protein and isoflavones. Chili and Sichuan pepper promote circulation and expel cold in TCM theory.",
  },
  yue_fish: {
    title: "Steamed Fish Cantonese Style",
    titleZh: "清蒸鱼",
    snippet:
      "Whole fresh fish steamed to perfection with ginger and scallions, finished with sizzling soy oil. The essence of Cantonese elegance.",
    fullRecipe:
      "1. Score a whole fresh fish on both sides.\n2. Place on a bed of ginger slices and scallion whites, steam 8–10 min.\n3. Discard the cloudy steaming liquid.\n4. Top with fresh julienned scallions and ginger.\n5. Heat peanut oil until smoking, pour over the aromatics.\n6. Drizzle with seasoned soy sauce and serve immediately.",
    history:
      "Steaming dates back to the Zhou dynasty (1046–256 BC). Cantonese chefs perfected it as the ultimate test of ingredient freshness.",
    wellness:
      "Steaming preserves omega-3 fatty acids with no added fat. Ginger warms the spleen/stomach in TCM, aiding fish digestion.",
  },
  lu_braised: {
    title: "Braised Sea Cucumber with Scallions",
    titleZh: "葱烧海参",
    snippet:
      "A regal Shandong banquet dish — tender sea cucumber simmered in a rich scallion-infused brown sauce.",
    fullRecipe:
      "1. Rehydrate dried sea cucumber over 3 days, changing water daily.\n2. Sauté thick scallion sections until golden and aromatic.\n3. Add sea cucumber, Shaoxing wine, dark and light soy, sugar, and stock.\n4. Braise on low heat for 20–30 min until gelatinous.\n5. Reduce sauce until glossy, plate with scallions on top.",
    history:
      "Prized in Shandong since the Ming dynasty, sea cucumber was served at state banquets and symbolizes wealth and hospitality.",
    wellness:
      "Sea cucumber is rich in collagen and chondroitin. In TCM it nourishes kidney essence (jing) and supports joint health.",
  },
  xiang_stirfry: {
    title: "Chairman Mao's Red-Braised Pork",
    titleZh: "毛氏红烧肉",
    snippet:
      "Hunan's most iconic dish — pork belly slow-braised in caramelized sugar, soy, and star anise until melt-in-your-mouth tender.",
    fullRecipe:
      "1. Blanch pork belly cubes, drain.\n2. Caramelize rock sugar in a dry wok until amber.\n3. Add pork, stir to coat with caramel.\n4. Pour in Shaoxing wine, light soy, dark soy, star anise, cinnamon, and dried chili.\n5. Add water to cover, simmer 90 min until fork-tender.\n6. Reduce sauce over high heat, serve with steamed buns.",
    history:
      "A favourite of Chairman Mao Zedong, born in Hunan. His personal chef refined this dish; it is now served in Hunanese restaurants worldwide.",
    wellness:
      "Pork belly is warming and nourishing in TCM. Star anise aids digestion; the long braise renders much of the fat.",
  },
  default_base: {
    title: "Wok-Seared Ginger Chicken with Seasonal Greens",
    titleZh: "姜汁滑炒鸡柳",
    snippet:
      "A quick, aromatic stir-fry that works with whatever greens you have on hand. Classic Chinese home cooking at its simplest.",
    fullRecipe:
      "1. Slice chicken breast against the grain, marinate with soy, wine, and cornstarch.\n2. Heat wok until smoking, add oil, sear chicken until just cooked. Remove.\n3. Stir-fry sliced ginger and garlic until fragrant.\n4. Add seasonal greens (bok choy, gai lan, or cabbage), toss with a splash of water.\n5. Return chicken, season with oyster sauce and white pepper. Serve over rice.",
    history:
      "The wok has been central to Chinese cooking for over 2,000 years. Quick stir-frying evolved from the need to cook efficiently with scarce fuel.",
    wellness:
      "Ginger is a TCM powerhouse — anti-inflammatory, warming, and digestive. Paired with lean chicken and leafy greens, this is a balanced one-pan meal.",
  },
};

function pickMockRecipes(cuisine: string): Omit<AiRecipe, "imagePrompt">[] {
  const lower = cuisine.toLowerCase();
  if (lower === "chuan" || lower === "sichuan") {
    return [MOCK_RECIPES.chuan_chicken, MOCK_RECIPES.chuan_tofu];
  }
  if (lower === "yue" || lower === "cantonese") {
    return [MOCK_RECIPES.yue_fish];
  }
  if (lower === "lu" || lower === "shandong") {
    return [MOCK_RECIPES.lu_braised];
  }
  if (lower === "xiang" || lower === "hunan") {
    return [MOCK_RECIPES.xiang_stirfry];
  }
  return [MOCK_RECIPES.default_base];
}

function buildMockImagePrompt(title: string): string {
  return `Professional food photography of ${title}, Chinese cuisine, overhead shot on a rustic ceramic plate, warm natural lighting, garnished with fresh herbs, steam rising, 8K ultra detailed`;
}

/**
 * Build the final fallback image prompt when the LLM doesn't provide one.
 */
function fallbackImagePrompt(title: string, cuisine: string): string {
  const cuisineMap: Record<string, string> = {
    Chuan: "Sichuan", Lu: "Shandong", Yue: "Cantonese", Su: "Jiangsu",
    Zhe: "Zhejiang", Min: "Fujian", Xiang: "Hunan", Hui: "Anhui",
  };
  const cuisineEn = cuisineMap[cuisine] ?? "Chinese";
  return `Professional food photography of ${title}, ${cuisineEn} Chinese cuisine, overhead shot on a rustic ceramic plate, warm natural light, garnished, steam rising, dark moody background, 8K ultra detailed`;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN ROUTE HANDLER
   ═══════════════════════════════════════════════════════════════════ */

export async function POST(request: Request) {
  /* ── 1. Parse and validate input ─────────────────────────────── */

  let body: RecipePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ingredients = "", cuisine = "Chuan", time = "<30min" } = body;

  if (!ingredients.trim()) {
    return NextResponse.json(
      { error: "ingredients is required" },
      { status: 400 }
    );
  }

  /* ── 2. Text generation ──────────────────────────────────────── */

  console.log(
    `[generate] ingredients="${ingredients}" cuisine=${cuisine} time=${time}`
  );

  const hunyuanResult = await callHunyuan({ ingredients, cuisine, time });

  let recipesAi: AiRecipe[];

  if (hunyuanResult && hunyuanResult.length > 0) {
    recipesAi = hunyuanResult;
    console.log(`[generate] Hunyuan returned ${recipesAi.length} recipe(s).`);
  } else {
    // Fall back to mock data
    const mockData = pickMockRecipes(cuisine);
    recipesAi = mockData.map((r) => ({
      ...r,
      imagePrompt: buildMockImagePrompt(r.title),
    }));
    console.log(
      `[generate] Using mock data — ${recipesAi.length} recipe(s).`
    );
  }

  /* ── 3. Image generation (per recipe) ────────────────────────── */

  const cards: RecipeCard[] = await Promise.all(
    recipesAi.map(async (r, i) => {
      const imagePrompt =
        r.imagePrompt || fallbackImagePrompt(r.title, cuisine);

      const imageUrl = await generateImage(imagePrompt);

      return {
        id: `${Date.now()}-${i}`,
        title: `${r.title} (${r.titleZh})`,
        snippet: r.snippet,
        fullRecipe: r.fullRecipe,
        history: r.history,
        wellness: r.wellness,
        imageUrl,
      };
    })
  );

  /* ── 4. Respond ──────────────────────────────────────────────── */

  return NextResponse.json({
    recipes: cards,
    meta: { cuisine, time, ingredients },
  });
}
