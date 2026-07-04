#!/usr/bin/env python3
"""Optimise les logos des compagnies stockes dans le bucket Supabase `logos`.

Pour chaque compagnie ayant un logo_url (fichier du bucket, non-URL, non-SVG) :
  - telecharge le fichier depuis l'URL publique
  - si trop lourd (> THRESH) : redimensionne a MAX_H px de haut et ré-encode
    (JPEG q82 pour les .jpg, PNG optimise pour les .png, BMP -> JPEG)
  - ré-uploade dans le bucket (upsert, meme nom) via la service key
  - si l'extension change (bmp -> jpg), met a jour compagnies.logo_url

Env requis : SUPABASE_SERVICE_KEY. Optionnels : SUPABASE_URL, MAX_H, THRESH_BYTES.
"""
import os, sys, io, requests
from PIL import Image

SUPA_URL = os.environ.get("SUPABASE_URL", "https://tndwonqdbeszkcztkzqe.supabase.co")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not KEY:
    sys.exit("::error::SUPABASE_SERVICE_KEY manquant")
BUCKET = "logos"
PUB = f"{SUPA_URL}/storage/v1/object/public/{BUCKET}/"
OBJ = f"{SUPA_URL}/storage/v1/object/{BUCKET}/"
MAX_H = int(os.environ.get("MAX_H", "128"))
THRESH = int(os.environ.get("THRESH_BYTES", "40000"))
HDR = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def ctype(name):
    n = name.lower()
    if n.endswith(".png"):
        return "image/png"
    if n.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if n.endswith(".bmp"):
        return "image/bmp"
    return "application/octet-stream"


r = requests.get(f"{SUPA_URL}/rest/v1/compagnies?select=id,nom,logo_url", headers=HDR, timeout=30)
r.raise_for_status()
cies = r.json()

tb = ta = 0
for c in cies:
    lu = (c.get("logo_url") or "").strip()
    if not lu or lu.startswith("http"):
        continue
    ext = lu.lower().rsplit(".", 1)[-1] if "." in lu else ""
    if ext == "svg":
        continue
    resp = requests.get(PUB + lu, timeout=60)
    if resp.status_code != 200:
        print(f"SKIP {c['nom']}: download {resp.status_code} ({lu})")
        continue
    raw = resp.content
    before = len(raw)
    if before <= THRESH and ext != "bmp":
        print(f"keep {lu} ({before // 1024}k, deja leger)")
        tb += before
        ta += before
        continue
    try:
        im = Image.open(io.BytesIO(raw))
    except Exception as e:
        print(f"SKIP {c['nom']}: open err {e}")
        continue
    if im.height > MAX_H:
        im = im.resize((max(1, round(im.width * MAX_H / im.height)), MAX_H), Image.LANCZOS)
    out = lu
    buf = io.BytesIO()
    if ext == "png":
        im.save(buf, "PNG", optimize=True)
    elif ext == "bmp":
        out = lu.rsplit(".", 1)[0] + ".jpg"
        im.convert("RGB").save(buf, "JPEG", quality=82, optimize=True, progressive=True)
    else:
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
    data = buf.getvalue()
    after = len(data)
    up = requests.post(OBJ + out, headers={**HDR, "x-upsert": "true", "Content-Type": ctype(out)}, data=data, timeout=60)
    if up.status_code not in (200, 201):
        print(f"FAIL upload {out}: {up.status_code} {up.text[:120]}")
        continue
    if out != lu:
        pa = requests.patch(
            f"{SUPA_URL}/rest/v1/compagnies?id=eq.{c['id']}",
            headers={**HDR, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={"logo_url": out}, timeout=30)
        print(f"  logo_url {c['nom']}: {lu} -> {out} (patch {pa.status_code})")
    tb += before
    ta += after
    print(f"OK {c['nom']:24} {before // 1024:>4}k -> {after // 1024:>3}k  {out}")

print(f"\nTOTAL optimise: {tb // 1024} Ko -> {ta // 1024} Ko")
