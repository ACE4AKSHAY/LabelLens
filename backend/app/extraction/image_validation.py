from __future__ import annotations

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


def payload_matches_mime_type(data: bytes, mime_type: str) -> bool:
    if mime_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if mime_type in {"image/heic", "image/heif"}:
        if len(data) < 12 or data[4:8] != b"ftyp":
            return False
        brand = data[8:12]
        heic_brands = {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"}
        return brand in heic_brands
    return False
