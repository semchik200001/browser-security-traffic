"""«Подслушивающий» HTTP-прокси для демонстрации: видит всё, что идёт по сети.

Моделирует атакующего на пути трафика (владелец публичного Wi-Fi, провайдер):
- обычный HTTP-запрос приходит к прокси целиком, его сохраняем как есть;
- HTTPS идёт через CONNECT-туннель: прокси пересылает байты TLS, но расшифровать их не может.

Все байты от браузера к серверу пишутся в tmp/sniff/<n>-<host>-<kind>.bin.
Запуск: python3 tools/sniff_proxy.py [порт]   (по умолчанию 8899, только 127.0.0.1)
"""
import os
import socket
import sys
import threading
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "tmp" / "sniff"
OUT.mkdir(parents=True, exist_ok=True)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
counter = 0
lock = threading.Lock()


def next_id():
    global counter
    with lock:
        counter += 1
        return counter


def read_head(sock):
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = sock.recv(65536)
        if not chunk:
            return None, b""
        data += chunk
    head, rest = data.split(b"\r\n\r\n", 1)
    return head, rest


def log(line):
    with lock, open(OUT / "log.txt", "a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line, flush=True)


def pipe(src, dst, sink):
    try:
        while True:
            chunk = src.recv(65536)
            if not chunk:
                break
            if sink is not None:
                sink.write(chunk)
            dst.sendall(chunk)
    except OSError:
        pass
    finally:
        for s in (src, dst):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def handle(client):
    head, rest = read_head(client)
    if not head:
        client.close()
        return
    first = head.split(b"\r\n", 1)[0].decode("latin-1")
    method, target, _ = first.split(" ", 2)
    n = next_id()

    if method == "CONNECT":  # HTTPS: только туннель с зашифрованными байтами
        host, port = target.rsplit(":", 1)
        upstream = socket.create_connection((host, int(port)), timeout=20)
        client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        path = OUT / f"{n:03d}-{host}-tls-c2s.bin"
        log(f"[{n}] CONNECT {target}  -> {path.name}")
        with open(path, "wb") as sink:
            t = threading.Thread(target=pipe, args=(upstream, client, None), daemon=True)
            t.start()
            pipe(client, upstream, sink)
            t.join(timeout=5)
        return

    # Обычный HTTP: запрос целиком в открытом виде
    lines = head.split(b"\r\n")
    headers = {}
    for h in lines[1:]:
        k, _, v = h.partition(b":")
        headers[k.strip().lower()] = v.strip()
    body = rest
    need = int(headers.get(b"content-length", b"0"))
    while len(body) < need:
        body += client.recv(65536)
    host_hdr = headers.get(b"host", b"").decode()
    host, _, port = host_hdr.partition(":")
    path = OUT / f"{n:03d}-{host}-http-c2s.bin"
    with open(path, "wb") as f:
        f.write(head + b"\r\n\r\n" + body)
    log(f"[{n}] {method} {target}  -> {path.name}")

    # переписываем на origin-form и закрываем соединение после ответа
    origin_target = "/" + target.split("/", 3)[3] if target.startswith("http://") else target
    new_lines = [f"{method} {origin_target} HTTP/1.1".encode()]
    for h in lines[1:]:
        if h.lower().startswith((b"proxy-connection:", b"connection:", b"keep-alive:")):
            continue
        new_lines.append(h)
    new_lines.append(b"Connection: close")
    upstream = socket.create_connection((host, int(port or 80)), timeout=20)
    upstream.sendall(b"\r\n".join(new_lines) + b"\r\n\r\n" + body)
    rhead, rrest = read_head(upstream)
    if rhead:
        rlines = [h for h in rhead.split(b"\r\n")
                  if not h.lower().startswith((b"connection:", b"keep-alive:"))]
        rlines.append(b"Connection: close")
        client.sendall(b"\r\n".join(rlines) + b"\r\n\r\n" + rrest)
        pipe(upstream, client, None)
    client.close()


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", PORT))
    srv.listen(64)
    log(f"sniff proxy on 127.0.0.1:{PORT}, dumps -> {OUT}")
    while True:
        c, _ = srv.accept()
        threading.Thread(target=lambda: _safe(handle, c), daemon=True).start()


def _safe(fn, c):
    try:
        fn(c)
    except Exception as e:  # noqa: BLE001 — демонстрационный прокси, ошибки только логируем
        log(f"error: {e!r}")
        try:
            c.close()
        except OSError:
            pass


if __name__ == "__main__":
    os.chdir(OUT)
    main()
