/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", "[data-theme='dark']"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          start: "var(--brand-start)",
          end: "var(--brand-end)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        burn: "var(--burn)",
        success: "var(--success)",
        "msg-in": "var(--msg-in)",
        "msg-out": "var(--msg-out)",
        "msg-reply-bar": "var(--msg-reply-bar)",
        "msg-reply-bg": "var(--msg-reply-bg)",
        "search-bg": "var(--search-bg)",
        "page-background": "var(--page-background)",
        "sidebar-background": "var(--sidebar-background)",
        "chat-background": "var(--chat-background)",
        "call-overlay": "var(--call-overlay)",
        "call-card": "var(--call-card)",
        "file-in-icon": "var(--file-in-icon)",
        "file-out-icon": "var(--file-out-icon)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        lg: "0 10px 15px -3px var(--shadow-lg), 0 4px 6px -4px var(--shadow-lg)",
      },
    },
  },
  plugins: [],
}
