export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'DM Serif Display'", "Georgia", "serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        ink: {
          50:"#f5f4f0", 100:"#e8e6df", 200:"#cdc9bc", 300:"#aaa49a",
          400:"#888278", 500:"#6b6560", 600:"#524e4a", 700:"#3d3a37",
          800:"#282522", 900:"#161310", 950:"#0d0b09"
        },
        jade: {
          50:"#edfaf4", 100:"#d3f4e5", 200:"#a9e8cc", 300:"#72d5aa",
          400:"#3db984", 500:"#1d9e6a", 600:"#148055", 700:"#0f6644",
          800:"#0b4f35", 900:"#073b28"
        },
        amber: {
          50:"#fff9eb", 100:"#fef0c7", 200:"#fedb8a", 300:"#fec04d",
          400:"#fea520", 500:"#f88007", 600:"#dc5e02", 700:"#b84006",
          800:"#95320d", 900:"#7a2a0f"
        },
        rose: {
          50:"#fff1f2", 100:"#ffe4e6", 200:"#fecdd3", 300:"#fda4af",
          400:"#fb7185", 500:"#f43f5e", 600:"#e11d48", 700:"#be123c",
          800:"#9f1239", 900:"#881337"
        },
      }
    }
  },
  plugins: [],
}
