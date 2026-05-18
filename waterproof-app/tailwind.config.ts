import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stitch 디자인 토큰
        primary:           "#1e293b",  // 딥 네이비/슬레이트 (헤딩, 강조)
        accent:            "#2563eb",  // 프로페셔널 블루 (액션, 점수)
        surface:           "#ffffff",
        "surface-variant": "#f1f5f9",
        "on-surface":      "#0f172a",
        "on-surface-var":  "#64748b",
        background:        "#f8fafc",
        // 기존 호환
        foreground:        "var(--foreground)",
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Hanken Grotesk", "sans-serif"],
        data: ["Hanken Grotesk", "Pretendard Variable", "sans-serif"], // 큰 숫자 강조용
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "1rem",
        "2xl": "1rem",
      },
      boxShadow: {
        premium: "0 10px 30px -10px rgba(0, 0, 0, 0.1)",
        glass:   "0 4px 12px -2px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
