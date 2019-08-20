import { Tag, TagType, Byte, Float, Int, Short, getTagType, TagObject } from "./tag"

/** Doubles the size of the buffer until the required amount is reached. */
function accommodate(buffer: Buffer, offset: number, size: number) {
    while (buffer.length < offset + size) {
        buffer = Buffer.concat([buffer, Buffer.alloc(buffer.length)])
    }
    return buffer
}

export function decodeTag(buffer: Buffer, offset: number, type: number) {
    let value: Tag
    switch (type) {
        case TagType.End: value = null; break
        case TagType.Byte: value = new Byte(buffer.readInt8((offset += 1) - 1)); break
        case TagType.Short: value = new Short(buffer.readInt16BE((offset += 2) - 2)); break
        case TagType.Int: value = new Int(buffer.readInt32BE((offset += 4) - 4)); break
        case TagType.Long: {
            value = (BigInt(buffer.readUInt32BE(offset)) << 32n) | BigInt(buffer.readUInt32BE(offset + 4))
            offset += 8
            break
        }
        case TagType.Float: value = new Float(buffer.readFloatBE((offset += 4) - 4)); break
        case TagType.Double: value = buffer.readDoubleBE((offset += 8) - 8); break
        case TagType.ByteArray: {
            const len = buffer.readUInt32BE(offset)
            offset += 4
            value = buffer.slice(offset, offset += len)
            break
        }
        case TagType.String: {
            const len = buffer.readUInt16BE(offset)
            value = (offset += 2, buffer.toString("utf-8", offset, offset += len))
            break
        }
        case TagType.List: {
            const type = buffer.readUInt8(offset)
            const len = buffer.readUInt32BE(offset + 1)
            offset += 5
            const items: Tag[] = []
            for (let i = 0; i < len; i++) {
                ({ value, offset } = decodeTag(buffer, offset, type))
                items.push(value)
            }
            value = items
            break
        }
        case TagType.Compound: {
            let object: TagObject = {}
            while (true) {
                const type = buffer.readUInt8(offset)
                offset += 1
                if (type == TagType.End) break
                const len = buffer.readUInt16BE(offset)
                offset += 2
                const name = buffer.toString("utf-8", offset, offset += len)
                ;({ value, offset } = decodeTag(buffer, offset, type))
                object[name] = value
            }
            value = object
            break
        }
        case TagType.IntArray: {
            const len = buffer.readUInt32BE(offset)
            offset += 4
            if (offset + len * 4 > buffer.length) throw new RangeError("Out of bounds")
            const dataview = new DataView(buffer.buffer, offset + buffer.byteOffset)
            const array = new Int32Array(len)
            for (let i = 0; i < len; i++) {
                array[i] = dataview.getInt32(i * 4, false)
            }
            offset += array.buffer.byteLength
            value = array
            break
        }
        case TagType.LongArray: {
            const len = buffer.readUInt32BE(offset)
            offset += 4
            if (offset + len * 8 > buffer.length) throw new RangeError("Out of bounds")
            const dataview = new DataView(buffer.buffer, offset + buffer.byteOffset)
            const array = new BigInt64Array(len)
            for (let i = 0; i < len; i++) {
                array[i] = dataview.getBigInt64(i * 8, false)
            }
            offset += array.buffer.byteLength
            value = array
            break
        }
        default: throw new Error(`Tag type ${type} not implemented`)
    }
    return { value: <Tag>value, offset }
}

interface DecodeResult {
    name: string | null
    value: Tag
    offset: number
}

/**
 * Decodes a nbt tag
 *
 * @param hasName Determine whether the nbt tag has a name.
 * Minecraft uses unnamed tags in slots for example.
 * @param offset Start decoding at this offset in the buffer
*/
export function decode(buffer: Buffer, hasName = true, offset = 0): DecodeResult {
    const type = buffer.readUInt8(offset)
    offset += 1

    let name: string | null = null
    if (hasName) {
        const len = buffer.readUInt16BE(offset)
        offset += 2
        name = buffer.toString("utf-8", offset, offset += len)
    }

    return { name, ...decodeTag(buffer, offset, type) }
}

/** Encodes a string with it's length prefixed as unsigned 16 bit integer */
function writeString(text: string, buffer: Buffer, offset: number) {
    const data = Buffer.from(text)
    buffer = accommodate(buffer, offset, data.length + 2)
    offset = buffer.writeUInt16BE(data.length, offset)
    data.copy(buffer, offset), offset += data.length
    return { buffer, offset }
}

export function encodeTag(tag: Tag, buffer = Buffer.alloc(1024), offset = 0) {
    // since most of the data types are smaller than 8 bytes, allocate this amount
    buffer = accommodate(buffer, offset, 8)

    if (tag instanceof Byte) {
        offset = buffer.writeInt8(tag.value, offset)
    } else if (tag instanceof Short) {
        offset = buffer.writeInt16BE(tag.value, offset)
    } else if (tag instanceof Int) {
        offset = buffer.writeInt32BE(tag.value, offset)
    } else if (typeof tag == "bigint") {
        offset = buffer.writeUInt32BE(Number(tag >> 32n), offset)
        offset = buffer.writeUInt32BE(Number(tag & 0xffffffffn), offset)
    } else if (tag instanceof Float) {
        offset = buffer.writeFloatBE(tag.value, offset)
    } else if (typeof tag == "number") {
        offset = buffer.writeDoubleBE(tag, offset)
    } else if (tag instanceof Buffer) {
        offset = buffer.writeUInt32BE(tag.length, offset)
        buffer = accommodate(buffer, offset, tag.length)
        tag.copy(buffer, offset), offset += tag.length
    } else if (tag instanceof Array) {
        const type = tag.length > 0 ? getTagType(tag[0]) : TagType.End
        offset = buffer.writeUInt8(type, offset)
        offset = buffer.writeUInt32BE(tag.length, offset)
        for (const item of tag) {
            if (getTagType(item) != type) throw new Error("Odd tag type in list");
            ({ buffer, offset } = encodeTag(item, buffer, offset))
        }
    } else if (typeof tag == "string") {
        ({ buffer, offset } = writeString(tag, buffer, offset))
    } else if (tag instanceof Int32Array) {
        offset = buffer.writeUInt32BE(tag.length, offset)
        buffer = accommodate(buffer, offset, tag.byteLength)
        const dataview = new DataView(buffer.buffer, offset + buffer.byteOffset)
        for (let i = 0; i < tag.length; i++) {
            dataview.setInt32(i * 4, tag[i], false)
        }
        offset += tag.byteLength
    } else if (tag instanceof BigInt64Array) {
        offset = buffer.writeUInt32BE(tag.length, offset)
        buffer = accommodate(buffer, offset, tag.byteLength)
        const dataview = new DataView(buffer.buffer, offset + buffer.byteOffset)
        for (let i = 0; i < tag.length; i++) {
            dataview.setBigInt64(i * 8, tag[i], false)
        }
        offset += tag.byteLength
    } else if (tag != null) {
        for (const [key, value] of Object.entries(tag)) {
            offset = buffer.writeUInt8(getTagType(value), offset);
            ({ buffer, offset } = writeString(key, buffer, offset));
            ({ buffer, offset } = encodeTag(value, buffer, offset))
        }
        buffer = accommodate(buffer, offset, 1)
        offset = buffer.writeUInt8(0, offset)
    }

    return { buffer, offset }
}

/** Encodes a nbt tag. If the name is `null` the nbt tag will be unnamed. */
export function encode(name: string | null = "", tag: Tag) {
    let buffer = Buffer.alloc(1024), offset = 0

    // write tag type
    offset = buffer.writeUInt8(getTagType(tag), offset);

    // write tag name
    if (name != null) ({ buffer, offset } = writeString(name, buffer, offset));

    ({ buffer, offset } = encodeTag(tag, buffer, offset))

    return buffer.slice(0, offset)
}

export { Tag, TagObject, TagType, Byte, Short, Int, Float, getTagType }
