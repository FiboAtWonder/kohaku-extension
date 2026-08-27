#!/usr/bin/env python3
"""Build the Recovery Journeys demo page.

Usage:
  python3 build-demo.py --screens <dir-with-webp-exports> [--out recovery-persona-demo.html]

Inputs (this directory): demo-template.html, journeys.json (steps + hotspots + sizes),
persona-docs.json (verbatim Notion persona descriptions).
Screens: one <screen-name>.webp per screen named in journeys.json, exported from
social-wireframes.pen at scale 1 (see README.md).
"""
import argparse, base64, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--screens', required=True)
    ap.add_argument('--out', default='recovery-persona-demo.html')
    args = ap.parse_args()

    data = json.load(open(os.path.join(HERE, 'journeys.json'), encoding='utf-8'))
    docs = json.load(open(os.path.join(HERE, 'persona-docs.json'), encoding='utf-8'))
    tpl = open(os.path.join(HERE, 'demo-template.html'), encoding='utf-8').read()

    sizes = data['sizes']
    needed = sorted({s['screen'] for p in data['personas'] for s in p['steps']})
    missing = [n for n in needed if not os.path.exists(os.path.join(args.screens, n + '.webp'))]
    if missing:
        sys.exit('missing screen exports: %s' % ', '.join(missing))

    imgs = {}
    for name in needed:
        with open(os.path.join(args.screens, name + '.webp'), 'rb') as f:
            imgs[name] = 'data:image/webp;base64,' + base64.b64encode(f.read()).decode()

    blob = {
        'sizes': {k: sizes[k] for k in needed},
        'personas': data['personas'],
        'imgs': imgs,
        'personaDocs': docs['docs'],
        'personaDocsNote': docs['note'],
    }
    out = tpl.replace('__DATA__', json.dumps(blob, ensure_ascii=False))
    open(args.out, 'w', encoding='utf-8').write(out)
    print('built %s (%.2f MB, %d screens)' % (args.out, os.path.getsize(args.out) / 1048576, len(needed)))

if __name__ == '__main__':
    main()
