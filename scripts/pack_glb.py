"""Pack a glTF model (.gltf + .bin + texture files) into one .glb, so the
site ships one file per shelf prop. Used once per Poly Haven download:

    python scripts/pack_glb.py path/to/model_1k.gltf site/src/models/model.glb
"""
import json
import struct
import sys
from pathlib import Path

MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * (-len(data) % 4)


def pack(src: Path, out: Path) -> None:
    gltf = json.loads(src.read_text(encoding="utf-8"))
    assert len(gltf["buffers"]) == 1, "one .bin buffer expected"
    blob = bytearray(pad((src.parent / gltf["buffers"][0]["uri"]).read_bytes(), b"\0"))
    # Every image becomes a slice of the one binary buffer.
    for image in gltf.get("images", []):
        path = src.parent / image.pop("uri")
        data = path.read_bytes()
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)})
        image["bufferView"] = len(gltf["bufferViews"]) - 1
        image["mimeType"] = MIME[path.suffix.lower()]
        blob += pad(data, b"\0")
    gltf["buffers"] = [{"byteLength": len(blob)}]
    text = pad(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
    body = struct.pack("<I4s", len(text), b"JSON") + text + struct.pack("<I4s", len(blob), b"BIN\0") + bytes(blob)
    out.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body)


if __name__ == "__main__":
    pack(Path(sys.argv[1]), Path(sys.argv[2]))
