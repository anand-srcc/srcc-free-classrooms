import re
import sys

def main():
    file_path = 'c:\\Users\\anand_fua08yg\\.gemini\\antigravity-ide\\scratch\\srcc_timetable_scraper\\web_app\\admin.html'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the style block
    style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    if not style_match:
        print("Style block not found")
        return
        
    style_block = style_match.group(1)
    
    # Perform replacements on style block
    replacements = [
        # Nav background
        (r'rgba\(11, 20, 36, 0\.95\)', 'rgba(255, 255, 255, 0.95)'),
        # Card backgrounds
        (r'rgba\(14, 24, 42, 0\.85\)', '#ffffff'),
        (r'rgba\(14, 24, 42, 0\.5\)', '#f8fafc'),
        (r'rgba\(14, 24, 42, 0\.8\)', '#ffffff'),
        # Inputs and sub-cards
        (r'rgba\(7, 13, 24, 0\.8\)', '#f8fafc'),
        (r'rgba\(7, 13, 24, 0\.6\)', '#f8fafc'),
        (r'#060B14', '#f1f5f9'),
        
        # Text colors
        (r'color: #FFFFFF;', 'color: var(--text-primary);'),
        
        # Borders
        (r'rgba\(255, 255, 255, 0\.15\)', 'var(--border-color)'),
        (r'rgba\(255, 255, 255, 0\.1\)', 'var(--border-color)'),
        (r'rgba\(255, 255, 255, 0\.08\)', 'var(--border-subtle)'),
        (r'rgba\(255, 255, 255, 0\.05\)', 'var(--border-subtle)'),
        
        # Shadows
        (r'rgba\(0, 0, 0, 0\.6\)', 'rgba(0, 0, 0, 0.08)'),
        (r'rgba\(0, 0, 0, 0\.5\)', 'rgba(0, 0, 0, 0.05)'),
        (r'rgba\(0, 0, 0, 0\.4\)', 'rgba(0, 0, 0, 0.05)'),
        
        # General background (var(--bg-main) to base)
        (r'var\(--bg-main\)', 'var(--bg-base)'),
        
        # Specific overrides
        (r'background: rgba\(16, 185, 129, 0\.1\);', 'background: var(--accent-green-bg);'),
        (r'color: #10B981;', 'color: var(--accent-green);'),
        (r'border-color: rgba\(16, 185, 129, 0\.3\);', 'border-color: var(--accent-green-light);')
    ]
    
    for old, new in replacements:
        style_block = re.sub(old, new, style_block)
        
    # Replace in content
    new_content = content[:style_match.start(1)] + style_block + content[style_match.end(1):]
    
    # Also we need to check inline styles in HTML body
    # E.g. style="... color: #FFF; background: rgba(14, 24, 42, 0.8);"
    inline_replacements = [
        (r'background: rgba\(14, 24, 42, 0\.8\);', 'background: #ffffff;'),
        (r'color: #FFF;', 'color: var(--text-primary);'),
        (r'color: #FFF', 'color: var(--text-primary)'),
        (r'color:#FFF', 'color:var(--text-primary)'),
    ]
    
    for old, new in inline_replacements:
        new_content = re.sub(old, new, new_content)
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Done rewriting admin.html to light theme.")

if __name__ == "__main__":
    main()
