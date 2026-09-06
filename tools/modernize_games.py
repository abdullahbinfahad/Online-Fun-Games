from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'Tetris-Game', 'Flappy-Bird-Game', 'Crossy-Road-Game'}

def inject(path: Path, folder: str) -> bool:
    text = path.read_text(encoding='utf-8')
    if 'arcade-enhancer.js' in text:
        return False
    rel = '../arcade-enhancer'
    css = f'<link rel="stylesheet" href="{rel}.css">'
    script = f'<script src="{rel}.js" defer></script>'
    if '</head>' in text:
        text = text.replace('</head>', f'    {css}\n  </head>', 1)
    else:
        text = css + '\n' + text
    if '</body>' in text:
        text = text.replace('</body>', f'    {script}\n  </body>', 1)
    else:
        text += '\n' + script + '\n'
    path.write_text(text, encoding='utf-8')
    return True

changed = []
for folder in sorted(ROOT.iterdir()):
    if not folder.is_dir() or folder.name.startswith('.') or folder.name in EXCLUDED:
        continue
    page = folder / 'index.html'
    if page.exists() and inject(page, folder.name):
        changed.append(folder.name)
print(f'Updated {len(changed)} game pages:')
print('\n'.join(changed))
print('Excluded unchanged:', ', '.join(sorted(EXCLUDED)))
