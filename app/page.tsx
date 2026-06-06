"use client";

import { useState, useCallback } from "react";

/* ─── Types ───────────────────────────────────────────────────── */

type CuisineOption =
  | "Chuan"
  | "Lu"
  | "Yue"
  | "Su"
  | "Zhe"
  | "Min"
  | "Xiang"
  | "Hui";

type TimeOption = "<15min" | "<30min" | "1hr";

type Lang = "zh" | "en";

interface RecipeResult {
  id: string;
  title: string;
  imageUrl: string;
  snippet: string;
}

const CUISINES: { value: CuisineOption; labelZh: string; labelEn: string }[] = [
  { value: "Chuan", labelZh: "川菜", labelEn: "Sichuan" },
  { value: "Lu", labelZh: "鲁菜", labelEn: "Shandong" },
  { value: "Yue", labelZh: "粤菜", labelEn: "Cantonese" },
  { value: "Su", labelZh: "苏菜", labelEn: "Jiangsu" },
  { value: "Zhe", labelZh: "浙菜", labelEn: "Zhejiang" },
  { value: "Min", labelZh: "闽菜", labelEn: "Fujian" },
  { value: "Xiang", labelZh: "湘菜", labelEn: "Hunan" },
  { value: "Hui", labelZh: "徽菜", labelEn: "Anhui" },
];

const TIMES: TimeOption[] = ["<15min", "<30min", "1hr"];

const T = {
  zh: {
    brand: "非遗食谱 AI",
    heroTitle: "千年传承，一菜一味",
    heroSub:
      "输入你冰箱里的食材，AI 为你生成中国八大菜系的精选菜谱、历史典故与养生智慧。",
    prompt: "输入你现有的食材，例如：Chicken, Soy sauce, Ginger…",
    generate: "开始烹饪",
    cuisine: "菜系",
    time: "烹饪时间",
    generating: "正在为您下厨…",
    gumroadTitle: "想要解锁完整 100 道独家大厨秘方？",
    gumroadSub: "获取《精选私房四川菜谱 PDF》——含高清步骤图解、历史典故与大师心法。",
    gumroadBtn: "立即以 $19 获取",
    resultsTitle: "为您精选的食谱",
  },
  en: {
    brand: "Culinary Heritage AI",
    heroTitle: "Millennia of Flavor, One Dish at a Time",
    heroSub:
      "Tell us what's in your fridge. AI crafts authentic Chinese recipes, stories, and wellness wisdom from the Eight Great Cuisines.",
    prompt: "List your ingredients, e.g.: Chicken, Soy sauce, Ginger…",
    generate: "Start Cooking",
    cuisine: "Cuisine",
    time: "Cook Time",
    generating: "Prepping your dish…",
    gumroadTitle: "Unlock 100 Exclusive Chef Secrets",
    gumroadSub:
      "Get the Private Collection: Sichuan Home Kitchen PDF — step-by-step photos, folk stories, and master techniques.",
    gumroadBtn: "Get it for $19",
    resultsTitle: "Your Curated Recipes",
  },
};

/* ─── Sub-components ──────────────────────────────────────────── */

function Navbar({ lang, onToggleLang }: { lang: Lang; onToggleLang: () => void }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-black/70 backdrop-blur-md border-b border-zinc-900">
      <span className="text-sm font-semibold tracking-[0.25em] text-white select-none">
        {T[lang].brand}
      </span>
      <button
        onClick={onToggleLang}
        className="text-xs font-medium tracking-wide text-zinc-500 hover:text-white transition-colors duration-200
                   border border-zinc-800 hover:border-zinc-600 rounded-full px-3 py-1"
      >
        {lang === "zh" ? "EN" : "中文"}
      </button>
    </nav>
  );
}

function IngredientInput({
  value,
  onChange,
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  lang: Lang;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={T[lang].prompt}
      className="w-full max-w-2xl bg-zinc-900/80 border border-zinc-800 rounded-xl px-5 py-4
                 text-white placeholder-zinc-600 text-base outline-none
                 transition-all duration-300
                 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-600/40 focus:bg-zinc-900"
    />
  );
}

function GenerateButton({
  loading,
  lang,
  onClick,
}: {
  loading: boolean;
  lang: Lang;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="relative inline-flex items-center justify-center px-8 py-3 rounded-xl text-sm font-semibold
                 text-white bg-gradient-to-r from-purple-600 to-indigo-600
                 hover:from-purple-500 hover:to-indigo-500
                 transition-all duration-300
                 disabled:opacity-60 disabled:cursor-not-allowed
                 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {T[lang].generating}
        </span>
      ) : (
        T[lang].generate
      )}
    </button>
  );
}

function CuisineSelector({
  lang,
  value,
  onChange,
}: {
  lang: Lang;
  value: CuisineOption;
  onChange: (v: CuisineOption) => void;
}) {
  const isEn = lang === "en";
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{T[lang].cuisine}</span>
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1 max-w-xs w-full">
        {CUISINES.map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200
              ${value === c.value ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {isEn ? c.labelEn : c.labelZh}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimeSelector({
  lang,
  value,
  onChange,
}: {
  lang: Lang;
  value: TimeOption;
  onChange: (v: TimeOption) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{T[lang].time}</span>
      <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
        {TIMES.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-4 py-2 text-xs font-medium transition-all duration-200
              ${value === opt ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="aspect-square rounded-xl skeleton-shimmer overflow-hidden border border-zinc-800/50" />
  );
}

function RecipeCard({ recipe }: { recipe: RecipeResult }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden hover:border-zinc-700 transition-colors duration-300">
      <div className="aspect-video bg-zinc-800 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white mb-1.5">{recipe.title}</h3>
        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{recipe.snippet}</p>
      </div>
    </div>
  );
}

function GumroadCard({ lang }: { lang: Lang }) {
  const gumroadUrl = "https://your-gumroad-product-link";

  return (
    <div className="w-full max-w-2xl mx-auto mt-16 border border-dashed border-purple-500/50 rounded-2xl bg-purple-950/10 p-6 md:p-8 text-center backdrop-blur-sm">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-600/20 mb-4">
        <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-white mb-2">{T[lang].gumroadTitle}</h3>
      <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">{T[lang].gumroadSub}</p>
      <a
        href={gumroadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center px-8 py-3 rounded-xl text-sm font-semibold
                   text-white bg-gradient-to-r from-purple-600 to-indigo-600
                   hover:from-purple-500 hover:to-indigo-500
                   transition-all duration-300
                   focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        {T[lang].gumroadBtn}
        <svg className="w-4 h-4 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 17l9.2-9.2M17 17V7H7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const [ingredients, setIngredients] = useState("");
  const [cuisine, setCuisine] = useState<CuisineOption>("Chuan");
  const [time, setTime] = useState<TimeOption>("<30min");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecipeResult[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const toggleLang = useCallback(() => setLang((l) => (l === "zh" ? "en" : "zh")), []);

  const handleGenerate = useCallback(async () => {
    if (!ingredients.trim()) return;
    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredients.trim(), cuisine, time }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setResults(data.recipes ?? []);
    } catch {
      // Fallback: show empty on error
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [ingredients, cuisine, time]);

  const renderGrid = () => {
    if (loading) {
      return Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />);
    }

    if (results === null && !hasSearched) {
      return Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />);
    }

    if (results && results.length > 0) {
      return results.map((r) => <RecipeCard key={r.id} recipe={r} />);
    }

    return (
      <div className="col-span-full text-center py-12 text-zinc-600 text-sm">
        {lang === "zh" ? "暂无匹配食谱，请尝试其他食材组合。" : "No recipes found. Try different ingredients."}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar lang={lang} onToggleLang={toggleLang} />

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-12">
        {/* Hero */}
        <div className="text-center mb-12 space-y-3">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            {T[lang].heroTitle}
          </h1>
          <p className="text-sm md:text-base text-zinc-500 max-w-lg mx-auto leading-relaxed">
            {T[lang].heroSub}
          </p>
        </div>

        {/* Input Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-2xl mb-10">
          <div className="flex-1">
            <IngredientInput value={ingredients} onChange={setIngredients} lang={lang} />
          </div>
          <GenerateButton loading={loading} lang={lang} onClick={handleGenerate} />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 md:gap-12 mb-16">
          <CuisineSelector lang={lang} value={cuisine} onChange={setCuisine} />
          <TimeSelector lang={lang} value={time} onChange={setTime} />
        </div>

        {/* Results */}
        {hasSearched && (
          <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-6 self-start max-w-5xl mx-auto w-full">
            {T[lang].resultsTitle}
          </h2>
        )}
        <section className="w-full max-w-5xl mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{renderGrid()}</div>
        </section>

        {/* Gumroad Monetization */}
        <GumroadCard lang={lang} />
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-700">
        &copy; {new Date().getFullYear()} Culinary Heritage AI &mdash; 非遗食谱体验馆
      </footer>
    </div>
  );
}
