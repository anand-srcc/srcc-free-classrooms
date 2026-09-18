# -*- coding: utf-8 -*-
import os

style_path = r'C:\Users\anand_fua08yg\.gemini\antigravity-ide\scratch\srcc_timetable_scraper\preview_web_app\style.css'

with open(style_path, 'r', encoding='utf-8', errors='replace') as f:
    css = f.read()

# 1. Desktop Header WhatsApp Button
if '.btn-community-header' not in css:
    header_btn_css = """
/* WhatsApp Community Button in Header */
.btn-community-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(37, 211, 102, 0.12);
  border: 1px solid rgba(37, 211, 102, 0.35);
  color: #25D366;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
  transition: all var(--transition-fast);
  cursor: pointer;
}

.btn-community-header:hover {
  background: rgba(37, 211, 102, 0.22);
  border-color: #25D366;
  box-shadow: 0 0 14px rgba(37, 211, 102, 0.3);
  transform: translateY(-1px);
  color: #FFFFFF;
}

.whatsapp-header-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
"""
    # Insert right before /* Main Content Layout */
    if '/* Main Content Layout' in css:
        css = css.replace('/* Main Content Layout', header_btn_css + '\n/* Main Content Layout')
    else:
        css += header_btn_css

# 2. Add Category Pill Active Color Palettes
cat_pills_active_css = """
/* Category Pills Distinct Active Colors */
.cat-pill[data-cat="ALL"].active {
  background: rgba(252, 235, 10, 0.18);
  border-color: #FCEB0A;
  color: #FCEB0A;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(252, 235, 10, 0.25);
}
.cat-pill[data-cat="R"].active {
  background: rgba(37, 99, 235, 0.28);
  border-color: #3B82F6;
  color: #93C5FD;
  font-weight: 700;
  box-shadow: 0 0 14px rgba(37, 99, 235, 0.35);
}
.cat-pill[data-cat="T"].active {
  background: rgba(5, 150, 105, 0.28);
  border-color: #10B981;
  color: #6EE7B7;
  font-weight: 700;
  box-shadow: 0 0 14px rgba(5, 150, 105, 0.35);
}
.cat-pill[data-cat="PB"].active {
  background: rgba(252, 235, 10, 0.2);
  border-color: #FCEB0A;
  color: #FCEB0A;
  font-weight: 700;
  box-shadow: 0 0 14px rgba(252, 235, 10, 0.3);
}
.cat-pill[data-cat="SCR"].active {
  background: rgba(239, 68, 68, 0.25);
  border-color: #EF4444;
  color: #FCA5A5;
  font-weight: 700;
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.35);
}
.cat-pill[data-cat="CL"].active {
  background: rgba(139, 92, 246, 0.25);
  border-color: #8B5CF6;
  color: #C4B5FD;
  font-weight: 700;
  box-shadow: 0 0 14px rgba(139, 92, 246, 0.35);
}
.cat-pill[data-cat="OTHER"].active {
  background: rgba(245, 158, 11, 0.25);
  border-color: #F59E0B;
  color: #FDE68A;
  font-weight: 700;
  box-shadow: 0 0 14px rgba(245, 158, 11, 0.35);
}
"""

if '.cat-pill[data-cat="R"].active' not in css:
    if '.filter-bar {' in css:
        css = css.replace('.filter-bar {', cat_pills_active_css + '\n.filter-bar {')
    else:
        css += cat_pills_active_css

# 3. Replace card themes with Full Dark Gradients & Distinct Colors
dark_card_themes = """
/* Distinct High-Contrast Category Themes for Room Cards */
/* 1. Classrooms (R): Deep Midnight Cobalt / Royal Blue */
.room-card.card-theme-r {
  border-left: 6px solid #2563EB !important;
  border-color: rgba(37, 99, 235, 0.45) !important;
  background: linear-gradient(160deg, #0e234e 0%, #08142c 100%) !important;
  box-shadow: 0 6px 24px rgba(14, 35, 78, 0.4);
}
.room-card.card-theme-r .card-room-code {
  color: #93C5FD !important;
  text-shadow: 0 0 14px rgba(59, 130, 246, 0.45);
}
.room-card.card-theme-r .card-room-code::before {
  content: '🏫 ';
  font-size: 1.1rem;
}
.room-card.card-theme-r .free-summary-bar {
  background: rgba(37, 99, 235, 0.18) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
  color: #BFDBFE !important;
}
.room-card.card-theme-r .slot-chip.slot-free {
  background: rgba(37, 99, 235, 0.22) !important;
  border-color: rgba(59, 130, 246, 0.45) !important;
  color: #DBEAFE !important;
}
.room-card.card-theme-r .p-block.free {
  background: #2563EB !important;
  color: #FFFFFF !important;
  border-color: #3B82F6 !important;
}

/* 2. Tutorial Rooms (T): Deep Forest Jade / Mint Emerald Green */
.room-card.card-theme-t {
  border-left: 6px solid #059669 !important;
  border-color: rgba(5, 150, 105, 0.45) !important;
  background: linear-gradient(160deg, #073b28 0%, #041f15 100%) !important;
  box-shadow: 0 6px 24px rgba(5, 59, 40, 0.4);
}
.room-card.card-theme-t .card-room-code {
  color: #6EE7B7 !important;
  text-shadow: 0 0 14px rgba(16, 185, 129, 0.45);
}
.room-card.card-theme-t .card-room-code::before {
  content: '📚 ';
  font-size: 1.1rem;
}
.room-card.card-theme-t .free-summary-bar {
  background: rgba(5, 150, 105, 0.18) !important;
  border-color: rgba(16, 185, 129, 0.4) !important;
  color: #A7F3D0 !important;
}
.room-card.card-theme-t .slot-chip.slot-free {
  background: rgba(5, 150, 105, 0.22) !important;
  border-color: rgba(16, 185, 129, 0.45) !important;
  color: #D1FAE5 !important;
}
.room-card.card-theme-t .p-block.free {
  background: #059669 !important;
  color: #FFFFFF !important;
  border-color: #10B981 !important;
}

/* 3. Principal Bungalow (PB): Royal Centenary Gold / Amber */
.room-card.card-theme-pb {
  border-left: 6px solid #FCEB0A !important;
  border-color: rgba(252, 235, 10, 0.45) !important;
  background: linear-gradient(160deg, #3d3004 0%, #1f1802 100%) !important;
  box-shadow: 0 6px 24px rgba(61, 48, 4, 0.4);
}
.room-card.card-theme-pb .card-room-code {
  color: #FCEB0A !important;
  text-shadow: 0 0 14px rgba(252, 235, 10, 0.45);
}
.room-card.card-theme-pb .card-room-code::before {
  content: '🏡 ';
  font-size: 1.1rem;
}
.room-card.card-theme-pb .free-summary-bar {
  background: rgba(252, 235, 10, 0.15) !important;
  border-color: rgba(252, 235, 10, 0.4) !important;
  color: #FEF08A !important;
}
.room-card.card-theme-pb .slot-chip.slot-free {
  background: rgba(252, 235, 10, 0.18) !important;
  border-color: rgba(252, 235, 10, 0.45) !important;
  color: #FEF9C3 !important;
}
.room-card.card-theme-pb .p-block.free {
  background: #EAB308 !important;
  color: #1C1502 !important;
  border-color: #FCEB0A !important;
  font-weight: 800;
}

/* 4. Sports Complex (SCR): Fiery Crimson / Hot Orange */
.room-card.card-theme-scr {
  border-left: 6px solid #EF4444 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
  background: linear-gradient(160deg, #440c0c 0%, #220606 100%) !important;
  box-shadow: 0 6px 24px rgba(68, 12, 12, 0.4);
}
.room-card.card-theme-scr .card-room-code {
  color: #FCA5A5 !important;
  text-shadow: 0 0 14px rgba(239, 68, 68, 0.45);
}
.room-card.card-theme-scr .card-room-code::before {
  content: '⚽ ';
  font-size: 1.1rem;
}
.room-card.card-theme-scr .free-summary-bar {
  background: rgba(239, 68, 68, 0.18) !important;
  border-color: rgba(239, 68, 68, 0.4) !important;
  color: #FECACA !important;
}
.room-card.card-theme-scr .slot-chip.slot-free {
  background: rgba(239, 68, 68, 0.22) !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
  color: #FEE2E2 !important;
}
.room-card.card-theme-scr .p-block.free {
  background: #DC2626 !important;
  color: #FFFFFF !important;
  border-color: #EF4444 !important;
}

/* 5. Computer Labs (CL): Cyber Tech Violet / Indigo */
.room-card.card-theme-cl {
  border-left: 6px solid #8B5CF6 !important;
  border-color: rgba(139, 92, 246, 0.45) !important;
  background: linear-gradient(160deg, #301350 0%, #180929 100%) !important;
  box-shadow: 0 6px 24px rgba(48, 19, 80, 0.4);
}
.room-card.card-theme-cl .card-room-code {
  color: #C4B5FD !important;
  text-shadow: 0 0 14px rgba(139, 92, 246, 0.45);
}
.room-card.card-theme-cl .card-room-code::before {
  content: '💻 ';
  font-size: 1.1rem;
}
.room-card.card-theme-cl .free-summary-bar {
  background: rgba(139, 92, 246, 0.18) !important;
  border-color: rgba(139, 92, 246, 0.4) !important;
  color: #DDD6FE !important;
}
.room-card.card-theme-cl .slot-chip.slot-free {
  background: rgba(139, 92, 246, 0.22) !important;
  border-color: rgba(139, 92, 246, 0.45) !important;
  color: #EDE9FE !important;
}
.room-card.card-theme-cl .p-block.free {
  background: #7C3AED !important;
  color: #FFFFFF !important;
  border-color: #8B5CF6 !important;
}

/* 6. Library & Others: Warm Terracotta Bronze */
.room-card.card-theme-other {
  border-left: 6px solid #F59E0B !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
  background: linear-gradient(160deg, #3d2406 0%, #1f1203 100%) !important;
  box-shadow: 0 6px 24px rgba(61, 36, 6, 0.4);
}
.room-card.card-theme-other .card-room-code {
  color: #FDE68A !important;
  text-shadow: 0 0 14px rgba(245, 158, 11, 0.45);
}
.room-card.card-theme-other .card-room-code::before {
  content: '📖 ';
  font-size: 1.1rem;
}
.room-card.card-theme-other .free-summary-bar {
  background: rgba(245, 158, 11, 0.18) !important;
  border-color: rgba(245, 158, 11, 0.4) !important;
  color: #FEF08A !important;
}
.room-card.card-theme-other .slot-chip.slot-free {
  background: rgba(245, 158, 11, 0.22) !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
  color: #FEF9C3 !important;
}
.room-card.card-theme-other .p-block.free {
  background: #D97706 !important;
  color: #FFFFFF !important;
  border-color: #F59E0B !important;
}
"""

# Replace the block from /* Distinct High-Contrast Category Themes for Room Cards */ to /* Card Body - Free slots list */
start_marker = "/* Distinct High-Contrast Category Themes for Room Cards */"
end_marker = "/* Card Body - Free slots list */"

if start_marker in css and end_marker in css:
    p1 = css.split(start_marker)[0]
    p2 = css.split(end_marker)[1]
    css = p1 + dark_card_themes + "\n" + end_marker + p2

# 4. Enhance Wings Bottom Sheet styles
wings_sheet_enhanced_css = """
/* Quick Wings / Category Selection Bottom Sheet with SRCC Crest */
.wings-bottom-sheet {
  max-width: 520px;
  margin: 0 auto;
  padding: 16px 20px 32px;
}

.sheet-brand-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sheet-logos-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.45);
  padding: 5px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.5);
}

.sheet-brand-crest {
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}

.sheet-brand-separator {
  color: rgba(255, 255, 255, 0.25);
  font-size: 0.85rem;
}

.sheet-title-text h3 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 800;
  color: #FFFFFF;
  margin: 0;
  line-height: 1.2;
}

.sheet-subtitle-mini {
  font-size: 0.72rem;
  color: var(--srcc-gold);
  font-weight: 500;
  display: block;
}

.sheet-wings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 58vh;
  overflow-y: auto;
  padding-right: 4px;
}

.sheet-wing-item {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(14, 24, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: all var(--transition-fast);
}

.sheet-wing-item:hover {
  background: rgba(26, 41, 71, 0.95);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.sheet-wing-item:active {
  transform: scale(0.98);
}

.sheet-wing-item.active {
  background: rgba(252, 235, 10, 0.12);
  border-color: var(--srcc-gold);
  box-shadow: 0 0 16px rgba(252, 235, 10, 0.15);
}

.wing-img-badge {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  font-size: 1.35rem;
}

.wing-badge-all {
  background: radial-gradient(circle, rgba(252, 235, 10, 0.3) 0%, rgba(26, 20, 3, 0.95) 100%);
  border: 1.5px solid #FCEB0A;
  box-shadow: 0 0 10px rgba(252, 235, 10, 0.3);
}

.wing-centenary-logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.wing-badge-r {
  background: radial-gradient(circle, rgba(37, 99, 235, 0.35) 0%, rgba(8, 18, 42, 0.95) 100%);
  border: 1.5px solid #3B82F6;
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.35);
}

.wing-crest-badge-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.wing-badge-pb {
  background: radial-gradient(circle, rgba(252, 235, 10, 0.3) 0%, rgba(35, 26, 4, 0.95) 100%);
  border: 1.5px solid #FCEB0A;
}

.wing-badge-t {
  background: radial-gradient(circle, rgba(5, 150, 105, 0.35) 0%, rgba(4, 30, 20, 0.95) 100%);
  border: 1.5px solid #10B981;
}

.wing-badge-scr {
  background: radial-gradient(circle, rgba(239, 68, 68, 0.35) 0%, rgba(38, 10, 10, 0.95) 100%);
  border: 1.5px solid #EF4444;
}

.wing-badge-cl {
  background: radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, rgba(26, 12, 48, 0.95) 100%);
  border: 1.5px solid #8B5CF6;
}

.wing-badge-other {
  background: radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(36, 20, 6, 0.95) 100%);
  border: 1.5px solid #F59E0B;
}

.wing-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.wing-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.sheet-wing-item.active .wing-title {
  color: var(--srcc-gold);
}

.wing-sub {
  font-size: 0.74rem;
  color: var(--text-secondary);
  margin-top: 1px;
}

.wing-count-pill {
  font-size: 0.76rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.sheet-wing-item.active .wing-count-pill {
  background: rgba(252, 235, 10, 0.25);
  color: var(--srcc-gold);
}
"""

# Replace old wings sheet list section
old_wings_marker = "/* Wings / Categories Mobile Bottom Sheet */"
share_modal_marker = "/* Social Media Direct Share Modal */"

if old_wings_marker in css and share_modal_marker in css:
    p1 = css.split(old_wings_marker)[0]
    p2 = css.split(share_modal_marker)[1]
    css = p1 + wings_sheet_enhanced_css + "\n" + share_modal_marker + p2

# 5. Make sure share app icon SVG styling is exact
if '.share-app-icon svg' not in css:
    share_svg_extra = """
.share-app-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}
.share-app-icon svg {
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
  transition: transform var(--transition-fast);
}
.share-app-btn:hover .share-app-icon svg {
  transform: scale(1.1);
}
"""
    css = css.replace('.share-app-icon {', share_svg_extra + '\n.share-app-icon_old {')

# Write back as clean UTF-8
with open(style_path, 'w', encoding='utf-8') as f:
    f.write(css)

print("Successfully updated style.css!")
