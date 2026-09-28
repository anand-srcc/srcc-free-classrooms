# -*- coding: utf-8 -*-
import os

style_path = r'C:\Users\anand_fua08yg\.gemini\antigravity-ide\scratch\srcc_timetable_scraper\preview_web_app\style.css'

with open(style_path, 'r', encoding='utf-8') as f:
    css = f.read()

m1 = '/* Category Badges with High-Contrast Colors */'
m2 = '/* Card Body - Free slots list */'

new_themes = """/* Category Badges with Subtle Dark Colors */
.badge-cat-r {
  background: rgba(59, 130, 246, 0.12);
  color: #93C5FD;
  border: 1px solid rgba(59, 130, 246, 0.35);
  font-weight: 600;
}
.badge-cat-pb {
  background: rgba(245, 158, 11, 0.12);
  color: #FDE68A;
  border: 1px solid rgba(245, 158, 11, 0.35);
  font-weight: 600;
}
.badge-cat-tut {
  background: rgba(16, 185, 129, 0.12);
  color: #6EE7B7;
  border: 1px solid rgba(16, 185, 129, 0.35);
  font-weight: 600;
}
.badge-cat-scr {
  background: rgba(239, 68, 68, 0.12);
  color: #FCA5A5;
  border: 1px solid rgba(239, 68, 68, 0.35);
  font-weight: 600;
}
.badge-cat-cl {
  background: rgba(139, 92, 246, 0.12);
  color: #C4B5FD;
  border: 1px solid rgba(139, 92, 246, 0.35);
  font-weight: 600;
}
.badge-cat-other {
  background: rgba(6, 182, 212, 0.12);
  color: #67E8F9;
  border: 1px solid rgba(6, 182, 212, 0.35);
  font-weight: 600;
}

/* Distinct Subtle Dark Category Themes for Room Cards */
/* 1. Classrooms (R): Clean Blue Accent */
.room-card.card-theme-r {
  border-left: 4px solid #3B82F6 !important;
}
.room-card.card-theme-r .card-room-code {
  color: #93C5FD !important;
}
.room-card.card-theme-r .card-room-code::before {
  content: '🏫 ';
  font-size: 1.05rem;
}

/* 2. Principal Bungalow (PB): Warm Centenary Gold Accent */
.room-card.card-theme-pb {
  border-left: 4px solid #F59E0B !important;
}
.room-card.card-theme-pb .card-room-code {
  color: #FDE68A !important;
}
.room-card.card-theme-pb .card-room-code::before {
  content: '🏡 ';
  font-size: 1.05rem;
}

/* 3. Tutorial Rooms (T): Mint Emerald Green Accent */
.room-card.card-theme-t {
  border-left: 4px solid #10B981 !important;
}
.room-card.card-theme-t .card-room-code {
  color: #6EE7B7 !important;
}
.room-card.card-theme-t .card-room-code::before {
  content: '📚 ';
  font-size: 1.05rem;
}

/* 4. Sports Complex (SCR): Coral Crimson Red Accent */
.room-card.card-theme-scr {
  border-left: 4px solid #EF4444 !important;
}
.room-card.card-theme-scr .card-room-code {
  color: #FCA5A5 !important;
}
.room-card.card-theme-scr .card-room-code::before {
  content: '⚽ ';
  font-size: 1.05rem;
}

/* 5. Computer Labs (CL / CLIB): Cyber Violet Accent */
.room-card.card-theme-cl {
  border-left: 4px solid #8B5CF6 !important;
}
.room-card.card-theme-cl .card-room-code {
  color: #C4B5FD !important;
}
.room-card.card-theme-cl .card-room-code::before {
  content: '💻 ';
  font-size: 1.05rem;
}

/* 6. Library & Others: Soft Teal Accent */
.room-card.card-theme-other {
  border-left: 4px solid #06B6D4 !important;
}
.room-card.card-theme-other .card-room-code {
  color: #67E8F9 !important;
}
.room-card.card-theme-other .card-room-code::before {
  content: '📖 ';
  font-size: 1.05rem;
}
"""

if m1 in css and m2 in css:
    p1 = css.split(m1)[0]
    p2 = css.split(m2)[1]
    css = p1 + new_themes + '\n' + m2 + p2
    with open(style_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print("Success: Refined dark color themes applied to style.css!")
else:
    print("Error: Markers not found in style.css")
