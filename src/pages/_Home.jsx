import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { useTheme } from '../contexts/ThemeContext'

// ── Categories ─────────────────────────────────────

const categories = [
  { id: 'text', label: '文字 & 轉檔', desc: '小說轉檔 · 社群排版 · AI 提示詞' },
  { id: 'media', label: '圖片 & 多媒體', desc: '去背 · PDF · 卡片 · 問安圖 · 色票 · 歌詞 · 歌單' },
  { id: 'discover', label: '查詢 & 測驗', desc: '閱讀器推薦 · 美妝色號' },
  { id: 'reading', label: '閱讀 & 電子書', desc: '書櫃管理 · 圖書館新書' },
]

// ── Tools ──────────────────────────────────────────

const tools = [
  {
    id: 'epub', name: 'TXT 轉 EPUB', category: 'text',
    description: '上傳 TXT 小說檔案，自動偵測章節結構、支援簡轉繁，一鍵生成標準 EPUB 電子書格式。',
    path: '/txt-to-epub', color: 'rose',
  },
  {
    id: 'epub-editor', name: 'EPUB 編輯器', category: 'text',
    description: 'EPUB 電子書編輯工具：簡轉繁、台灣標點符號、字型替換、行距字級調整。',
    path: '/epub-editor', color: 'lavender',
  },
  {
    id: 'post-writer', name: '社群貼文排版', category: 'text',
    description: '解決 FB、IG、Threads 換行消失問題。即時預覽、多平台支援、雜誌感設計與 Broetry 排版模式。',
    path: '/post-writer', color: 'sage',
  },
  {
    id: 'spell', name: 'SD 咒語產生器', category: 'text',
    description: 'Stable Diffusion 提示詞快速組合，中英對照，一鍵複製。',
    path: '/spell/', color: 'lavender', external: true,
  },
  {
    id: 'bg-removal', name: '批次去背', category: 'media',
    description: '上傳多張圖片，AI 自動去除背景。全程本機處理，不限解析度，完全免費。',
    path: '/bg-remove', color: 'lavender',
  },
  {
    id: 'pdf-editor', name: 'PDF 編輯工具', category: 'media',
    description: '線上 PDF 編輯：手寫簽名、打字簽名、圖片簽名、文字覆蓋。全程本機處理，不上傳任何檔案。',
    path: '/pdf-editor/', color: 'rose', external: true,
  },
  {
    id: 'hihi', name: '問安圖產生器', category: 'media',
    description: '早安圖、午安圖、晚安圖線上製作。7 種字體、配件貼紙，3 步驟免費下載。',
    path: '/hihi/', color: 'sage', external: true,
  },
  {
    id: 'card-maker', name: 'Card Maker 卡片製造機', category: 'media',
    description: '社群貼文圖片產生器，4 款質感模板 + IG/FB 多尺寸切換，填文字選配色一鍵下載 PNG。',
    path: '/card-maker/', color: 'rose', external: true,
  },
  {
    id: 'find-color', name: '2026 數位色票庫', category: 'media',
    description: '收錄 Pantone 2026 與 8 大設計美學圈流行色，設計師必備色彩靈感工具。',
    path: '/find-color/', color: 'lavender', external: true,
  },
  {
    id: 'reader-quiz', name: '電子書閱讀器測驗', category: 'discover',
    description: '8 題精準推薦最適合你的電子書閱讀器，涵蓋 34 款機型比較。',
    path: '/reader-quiz/', color: 'rose', external: true,
  },
  {
    id: 'cosmetics', name: '色號試色搜尋', category: 'discover',
    description: '美妝色號搜尋引擎，快速找到試色文章與真人試色照片。',
    path: '/cosmetics-for-you/', color: 'rose', external: true,
  },
  {
    id: 'lyric-player', name: 'Lyric Player 歌詞播放器', category: 'media',
    description: '上傳 MP3 即可 AI 辨識歌詞並同步播放。支援 LRC 上傳、歌詞編輯、時間微調、匯出下載，中英日韓多語言。',
    path: '/lyric-player/', color: 'lavender', external: true,
  },
  {
    id: 'spotify-goods', name: 'Spotify Goods 歌曲整理', category: 'media',
    description: '貼上 YouTube 網址自動抓歌，一鍵建立 Spotify 歌單或匯入現有歌單，支援封面上傳。',
    path: '/spotify-goods/', color: 'sage', external: true,
  },
  {
    id: 'book-manager', name: '電子書書櫃管理', category: 'reading',
    description: '登入讀墨、Kobo，一鍵撈出全部藏書，跨平台自動比對重複書籍，匯出 CSV。',
    path: '/book-manager/', color: 'lavender', external: true,
  },
  {
    id: 'ebook-deals', name: '每日好書推薦', category: 'reading',
    description: '三平台電子書每日特價一覽，Readmoo、博客來、Kobo 搜尋比價。',
    path: '/ebook-deals/', color: 'rose', external: true,
  },
  {
    id: 'library-search', name: '圖書館新書探測器', category: 'reading',
    description: '追蹤全台 23 間 HyRead 公共圖書館新書上架與熱門排行，搜尋免費借閱。',
    path: '/library-search/', color: 'sage', external: true, badge: 'New',
  },
  {
    id: 'labor-report', name: '勞務報酬單產生器', category: 'text',
    description: '輸入基本資料，自動計算扣繳稅額，產生 115 年度勞務報酬單 PDF。',
    path: '/labor-report/', color: 'rose', external: true,
  },
  {
    id: 'tankdrum-music', name: '空靈鼓簡譜集', category: 'media',
    description: '空靈鼓數字簡譜瀏覽與播放工具。',
    path: '/tankdrum-music/', color: 'sage', external: true,
  },
]

// ── Color Helpers ──────────────────────────────────

const accentGradients = {
  rose: 'linear-gradient(90deg, #D4A5A5, #F5D0C5)',
  lavender: 'linear-gradient(90deg, #B8A9C9, #C9C1DC)',
  sage: 'linear-gradient(90deg, #A8B5A0, #C5D4BD)',
}

const iconColors = {
  rose: 'var(--rose)',
  lavender: 'var(--lavender)',
  sage: 'var(--sage)',
}

const iconBgs = {
  rose: 'linear-gradient(135deg, rgba(212, 165, 165, 0.22), rgba(245, 208, 197, 0.15))',
  lavender: 'linear-gradient(135deg, rgba(184, 169, 201, 0.22), rgba(201, 193, 220, 0.15))',
  sage: 'linear-gradient(135deg, rgba(168, 181, 160, 0.22), rgba(184, 201, 176, 0.15))',
}

// ── SVG Icons ──────────────────────────────────────

const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    <path d="M8 7h8"/><path d="M8 11h6"/>
  </svg>
)

const ConvertIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M8 14l4 4 4-4"/>
    <circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
)

const ScissorsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
    <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
    <line x1="8.12" y1="8.12" x2="12" y2="12"/>
  </svg>
)

const PostWriterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/><path d="M10 9H8"/>
  </svg>
)

const PdfEditIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/>
  </svg>
)

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const PaletteIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
)

const CardMakerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18"/><path d="M9 21V9"/>
  </svg>
)

const MusicIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
  </svg>
)

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
    <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>
  </svg>
)

const BookOpenIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)

const WrenchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="white">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
)

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)

const LabIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M9 3h6v5l4 9a2 2 0 0 1-1.8 2.9H6.8A2 2 0 0 1 5 17l4-9V3z"/><path d="M9 3h6"/><path d="M7 15h10"/>
  </svg>
)

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
  </svg>
)

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
  </svg>
)

// Brand five-petal flower
const BrandFlower = ({ size = 36 }) => (
  <svg viewBox="0 0 100 120" width={size} height={size * 1.2} className="animate-float">
    <g transform="translate(50,50)">
      <ellipse cx="0" cy="-22" rx="12" ry="19" fill="#E6B8C3" opacity="0.85"/>
      <ellipse cx="0" cy="-22" rx="12" ry="19" fill="#D4A5A5" opacity="0.85" transform="rotate(72)"/>
      <ellipse cx="0" cy="-22" rx="12" ry="19" fill="#C9C1DC" opacity="0.85" transform="rotate(144)"/>
      <ellipse cx="0" cy="-22" rx="12" ry="19" fill="#E6B8C3" opacity="0.85" transform="rotate(216)"/>
      <ellipse cx="0" cy="-22" rx="12" ry="19" fill="#B8A9C9" opacity="0.85" transform="rotate(288)"/>
      <circle cx="0" cy="0" r="8" fill="#D4A5A5"/>
    </g>
    <line x1="50" y1="58" x2="50" y2="85" stroke="#8FA88C" strokeWidth="3" strokeLinecap="round"/>
    <ellipse cx="42" cy="72" rx="8" ry="4" fill="#8FA88C" opacity="0.6" transform="rotate(-30, 42, 72)"/>
  </svg>
)

const getIcon = (id) => {
  switch (id) {
    case 'epub': return <BookIcon />
    case 'epub-editor': return <ConvertIcon />
    case 'bg-removal': return <ScissorsIcon />
    case 'post-writer': return <PostWriterIcon />
    case 'pdf-editor': return <PdfEditIcon />
    case 'hihi': return <SunIcon />
    case 'find-color': return <PaletteIcon />
    case 'reader-quiz': return <BookOpenIcon />
    case 'cosmetics': return <PaletteIcon />
    case 'card-maker': return <CardMakerIcon />
    case 'spell': return <SparklesIcon />
    case 'lyric-player': return <MusicIcon />
    case 'spotify-goods': return <MusicIcon />
    case 'book-manager': return <BookOpenIcon />
    case 'ebook-deals': return <BookIcon />
    case 'library-search': return <BookOpenIcon />
    case 'labor-report': return <PdfEditIcon />
    case 'tankdrum-music': return <MusicIcon />
    default: return <BookIcon />
  }
}

// ── Tool Card ──────────────────────────────────────

function ToolCard({ tool, index }) {
  const CardTag = tool.external ? 'a' : Link
  const cardProps = tool.external ? { href: tool.path } : { to: tool.path }

  return (
    <CardTag
      {...cardProps}
      className="tool-card group relative flex flex-col p-7 pb-16 rounded-3xl overflow-hidden animate-fadeInUp"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(212,165,165,0.15)',
        boxShadow: 'var(--shadow-sm)',
        animationDelay: `${index * 0.08}s`,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {/* Top accent bar — always visible */}
      <div
        className="top-bar absolute top-0 left-0 right-0 h-[3px] rounded-t-3xl transition-opacity duration-300"
        style={{ background: accentGradients[tool.color], opacity: 0.5 }}
      />

      {/* Icon */}
      <div
        className="tool-icon w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-500"
        style={{ background: iconBgs[tool.color], color: iconColors[tool.color] }}
      >
        {getIcon(tool.id)}
      </div>

      {/* Content */}
      <h3 className="font-serif text-lg font-semibold mb-2 tracking-wide">{tool.name}</h3>
      <p
        className="font-serif text-sm leading-relaxed flex-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {tool.description}
      </p>

      {/* Arrow */}
      <div
        className="card-arrow absolute bottom-6 right-6 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg-secondary)', color: 'var(--accent-primary)' }}
      >
        <ArrowIcon />
      </div>
    </CardTag>
  )
}

// ── Home Page ──────────────────────────────────────

export default function Home() {
  const { isDark } = useTheme()

  const startYear = 2026
  const currentYear = new Date().getFullYear()
  const yearDisplay = currentYear > startYear ? `${startYear}–${currentYear}` : `${startYear}`

  return (
    <div
      className="min-h-screen py-12 px-6 transition-colors duration-500 relative"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex justify-between items-center mb-16">
          <a href="https://lab.helloruru.com" className="flex items-center gap-4 group">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 ease-out group-hover:rotate-[-3deg] group-hover:scale-110"
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                boxShadow: '0 4px 20px rgba(212, 165, 165, 0.3)',
              }}
            >
              <WrenchIcon />
            </div>
            <div>
              <div className="font-serif text-3xl font-semibold tracking-wide">Tools</div>
              <div
                className="text-xs font-medium tracking-widest uppercase mt-0.5"
                style={{ color: 'var(--accent-primary)' }}
              >
                HelloRuru
              </div>
            </div>
          </a>
          <ThemeToggle />
        </header>

        {/* Hero */}
        <section className="text-center mb-16 relative">
          <div className="flex justify-center mb-4">
            <BrandFlower size={40} />
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold tracking-wide mb-5">
            <span
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 50%, var(--accent-tertiary) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Tools
            </span>
          </h1>
          <p
            className="font-serif text-base leading-relaxed mb-5"
            style={{ color: 'var(--text-secondary)', letterSpacing: '0.02em' }}
          >
            簡單好用的線上小工具。<br />全程本機處理，保護你的隱私。
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(184,169,201,0.2)',
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}
            >
              <ShieldIcon style={{ color: 'var(--accent-primary)' }} />
              檔案不會上傳到任何伺服器
            </span>
            <span
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium"
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: 'white',
                boxShadow: '0 4px 16px rgba(212, 165, 165, 0.25)',
              }}
            >
              {tools.length} 款免費工具
            </span>
          </div>
          <img
            src="/rabbit-watermark.png"
            alt=""
            aria-hidden="true"
            className="absolute right-0 bottom-0 w-12 h-12 opacity-[0.18] pointer-events-none select-none"
          />
        </section>

        {/* Categorized Tool Grid */}
        {categories.map((cat) => {
          const catTools = tools.filter((t) => t.category === cat.id)
          return (
            <section key={cat.id} className="mb-12">
              {/* Section Header */}
              <div className="flex items-center gap-4 mb-6">
                <h2
                  className="font-serif text-lg font-semibold whitespace-nowrap"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  {cat.label}
                </h2>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />
                <span
                  className="hidden sm:inline text-xs whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {cat.desc}
                </span>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {catTools.map((tool, i) => (
                  <ToolCard key={tool.id} tool={tool} index={i} />
                ))}
              </div>
            </section>
          )
        })}

        {/* ohruru 推薦卡片 */}
        <section className="mt-12 mx-auto" style={{ maxWidth: 640, padding: '0 20px' }}>
          <a
            href="https://ohruru.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl border transition-all hover:-translate-y-0.5"
            style={{
              padding: '24px 24px 20px',
              background: 'var(--bg-card, #fff)',
              borderColor: 'rgba(212,165,165,0.25)',
              boxShadow: '0 2px 12px rgba(212,165,165,0.08)',
              textDecoration: 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg, #D4A5A5, #B8A9C9)', opacity: 0.7,
            }} />
            <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: '#D4A5A5' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4A5A5', display: 'inline-block' }} />
              RECOMMENDED SERVICE
            </div>
            <div className="mb-1.5" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #333)' }}>
              工具生素材，社群靠策略
            </div>
            <div className="mb-3" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-muted, #888)' }}>
              問安圖做好了、咒語跑出來了，但固定發文、企劃排程這件事，工具幫不了。社群代操整包處理，公開報價不用先加 LINE。
            </div>
            <div className="flex items-center gap-1" style={{ fontSize: 14, fontWeight: 500, color: '#D4A5A5' }}>
              ohruru.com
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>
          </a>
        </section>

        {/* Footer — DS 2.0 漸層淡線 */}
        <footer
          className="mt-10 pt-12 text-center footer-gradient-line"
        >
          <p
            className="font-serif text-sm flex items-center justify-center gap-2 mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ShieldIcon style={{ color: 'var(--accent-primary)' }} />
            所有檔案處理皆在瀏覽器本機完成
          </p>
          <p className="font-serif text-sm" style={{ color: 'var(--text-muted)' }}>
            &copy; {yearDisplay} Kaoru Tsai. All Rights Reserved. |{' '}
            <a
              href="mailto:hello@helloruru.com"
              className="transition-colors hover:opacity-80"
              style={{ color: 'var(--accent-primary)' }}
            >
              hello@helloruru.com
            </a>
          </p>
          <div className="flex justify-center gap-8 mt-5">
            <a
              href="https://lab.helloruru.com"
              className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <LabIcon /> Lab
            </a>
            <a
              href="https://helloruru.com"
              className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <GlobeIcon /> HelloRuru
            </a>
            <a
              href="https://github.com/HelloRuru"
              className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <GitHubIcon /> GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
