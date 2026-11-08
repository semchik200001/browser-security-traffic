"""Анализ дампов «подслушивающего» прокси: виден ли пароль в байтах, ушедших в сеть.

Запуск: python3 tools/analyze_sniff.py <пароль> --all              (сводка по всем дампам)
        python3 tools/analyze_sniff.py <пароль> <номер> <номер> ...   (подробно по записям)
"""
import sys
import urllib.parse
from pathlib import Path

DUMPS = Path(__file__).resolve().parent.parent / "tmp" / "sniff"
TLS_TYPES = {20: "ChangeCipherSpec", 21: "Alert", 22: "Handshake", 23: "ApplicationData"}


def find(n):
    hits = sorted(DUMPS.glob(f"{int(n):03d}-*.bin"))
    return hits[0] if hits else None


def tls_records(data):
    i, out = 0, []
    while i + 5 <= len(data):
        ctype, ver, ln = data[i], data[i + 1:i + 3], int.from_bytes(data[i + 3:i + 5], "big")
        out.append((ctype, ver.hex(), ln, data[i + 5:i + 5 + ln]))
        i += 5 + ln
    return out


def client_hello_info(body):
    """SNI и наличие ECH (extension 0xfe0d) из ClientHello."""
    if not body or body[0] != 1:
        return None, False
    p = 4 + 2 + 32
    p += 1 + body[p]                                   # session id
    p += 2 + int.from_bytes(body[p:p + 2], "big")      # cipher suites
    p += 1 + body[p]                                   # compression
    end = p + 2 + int.from_bytes(body[p:p + 2], "big")
    p += 2
    sni, ech = None, False
    while p + 4 <= end:
        et, el = int.from_bytes(body[p:p + 2], "big"), int.from_bytes(body[p + 2:p + 4], "big")
        ev = body[p + 4:p + 4 + el]
        if et == 0 and len(ev) > 5:
            sni = ev[5:5 + int.from_bytes(ev[3:5], "big")].decode()
        if et == 0xFE0D:
            ech = True
        p += 4 + el
    return sni, ech


def summary(variants):
    """--all: одна строка на каждое перехваченное соединение."""
    print(f"{'дамп':55} {'байт':>7}  пароль")
    for f in sorted(DUMPS.glob("*.bin")):
        data = f.read_bytes()
        found = any(v in data for v in variants)
        print(f"{f.name:55} {len(data):>7}  {'НАЙДЕН' if found else '-'}")


def main():
    password = sys.argv[1].encode()
    variants = {password, urllib.parse.quote_plus(sys.argv[1]).encode()}
    if sys.argv[2:] == ["--all"]:
        summary(variants)
        return
    for n in sys.argv[2:]:
        f = find(n)
        data = f.read_bytes()
        found = any(v in data for v in variants)
        print(f"=== [{n}] {f.name}: {len(data)} байт, пароль в байтах: {'НАЙДЕН' if found else 'не найден'}")
        if "-http-" in f.name:
            print(data.decode("latin-1"))
            continue
        recs = tls_records(data)
        counts = {}
        for r in recs:
            counts[TLS_TYPES.get(r[0], r[0])] = counts.get(TLS_TYPES.get(r[0], r[0]), 0) + 1
        sni, ech = client_hello_info(recs[0][3]) if recs else (None, False)
        print(f"TLS-записей: {len(recs)} {counts}")
        print(f"ClientHello: SNI = {sni!r}, ECH = {'да' if ech else 'нет'}")
        app = [r for r in recs if r[0] == 23]
        if app:
            first = app[0]
            raw = bytes([first[0]]) + bytes.fromhex(first[1]) + first[2].to_bytes(2, "big") + first[3]
            print("первая запись ApplicationData (первые 48 байт):")
            for k in range(0, 48, 16):
                chunk = raw[k:k + 16]
                print(f"  {k:04x}: {chunk.hex(' ')}  {''.join(chr(c) if 32 <= c < 127 else '.' for c in chunk)}")
        print()


if __name__ == "__main__":
    main()
