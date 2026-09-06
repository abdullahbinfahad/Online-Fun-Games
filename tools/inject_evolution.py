from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXCLUDED={'Tetris-Game','Flappy-Bird-Game','Crossy-Road-Game'}
for folder in ROOT.iterdir():
    if not folder.is_dir() or folder.name in EXCLUDED or folder.name.startswith('.'):
        continue
    p=folder/'index.html'
    if not p.exists():
        continue
    b=p.read_bytes()
    if b'arcade-evolution-game.js' in b:
        continue
    b=b.replace(b'</head>', b'  <link rel="stylesheet" href="../arcade-evolution.css">\n</head>', 1)
    b=b.replace(b'</body>', b'  <script src="../arcade-evolution-game.js" defer></script>\n</body>', 1)
    p.write_bytes(b)
    print(folder.name)
