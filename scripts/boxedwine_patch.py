"""Reproduce the bounded-return lookahead patch for BoxedWine build 125.

The corresponding GPL source change and CPU regression are distributed in
web-boxedwine/third-party/boxedwine-bounded-lookahead.patch. Only one WASM
function changes; imports, function indices, data and the JavaScript stay intact.
"""
import hashlib

UPSTREAM_SHA = "251d50875af37e4a7b24c7acc4aaa92dc6df728184b91fccd817145ce8455d5e"
PATCHED_SHA = "b2f133be3a57bad25133114050c6f5d486ed86433bd3b97a0cd73ab8a983ac0c"
FUNCTION_SHA = "a79ce03b7dcbe4c24d1e8c282a487a743a3582036eaf6cf5b4c6252fc5fd4674"


def read_uleb(data, offset):
    value = shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, offset
        shift += 7


def uleb(value):
    data = bytearray()
    while True:
        byte = value & 127
        value >>= 7
        data.append(byte | (128 if value else 0))
        if not value:
            return bytes(data)


def patch_engine(data):
    checksum = hashlib.sha256(data).hexdigest()
    if checksum == PATCHED_SHA:
        return data
    if checksum != UPSTREAM_SHA:
        raise ValueError("Cannot patch an unknown BoxedWine WASM; expected build 125.")
    offset = 8
    while offset < len(data):
        section_start = offset
        section_id = data[offset]
        size, section_data = read_uleb(data, offset + 1)
        section_end = section_data + size
        offset = section_end
        if section_id != 10:
            continue
        count, cursor = read_uleb(data, section_data)
        if count != 12265:
            raise ValueError("Unexpected BoxedWine function count.")
        for index in range(count):
            function_start = cursor
            length, body_start = read_uleb(data, cursor)
            body_end = body_start + length
            cursor = body_end
            if index != 2362:
                continue
            body = data[body_start:body_end]
            if hashlib.sha256(body).hexdigest() != FUNCTION_SHA:
                raise ValueError("BoxedWine lookahead function does not match.")
            # Existing skip-return predicate: furthestJump >= eip + op->len.
            needle = bytes.fromhex("200c200620012f0118410c766a22034f0d004101210a")
            if body.count(needle) != 1:
                raise ValueError("BoxedWine return predicate does not match.")
            insertion = needle.index(bytes([0x4f])) + 1
            # Add && (eip - this->startingEip < 1024) before br_if.
            # local.get 6; local.get 0; i32.load offset=52; i32.sub;
            # i32.const 1024; i32.lt_u; i32.and.
            predicate = bytes.fromhex("200620002802346b4180084971")
            body = body.replace(needle, needle[:insertion] + predicate + needle[insertion:])
            payload = (data[section_data:function_start] + uleb(len(body)) + body
                       + data[body_end:section_end])
            result = (data[:section_start] + bytes([10]) + uleb(len(payload))
                      + payload + data[section_end:])
            if hashlib.sha256(result).hexdigest() != PATCHED_SHA:
                raise ValueError("Patched BoxedWine SHA-256 mismatch.")
            return result
    raise ValueError("BoxedWine code section was not found.")
