import * as nbt from "."

const unquotedRegExp = /^[0-9A-Za-z.+_-]+$/

export interface StringifyOptions {
    pretty?: boolean
    breakLength?: number
    quote?: "single" | "double"
    skipComma?: boolean
    useBoolean?: boolean
    tab?: string
    newline?: string

    /**
     * Add 'd' postfix for TAG_Double.  
     * By default, JS uses doubles for numbers.
     */
    strictDouble?: boolean
    
    /**
     * Not add spaces at start of line in TAG_List (list of tags).  
     * Also, join list opening brackets with object brackets.  
     * @example ```
     * `[{a:1},{b:2}]` // input
     * // Output:
     * `[{
     *     a: 1
     * },
     * {
     *     b: 2
     * }]`
     * ```
     */
    noTagListTab?: boolean
}

export function stringify(tag: nbt.Tag, options: StringifyOptions = {}): string {
    const pretty = !!options.pretty, breakLength = options.breakLength ?? 70
    const skipComma = pretty && !!options.skipComma, useBoolean = !!options.useBoolean
    const quoteChar = options.quote == "single" ? "'" : options.quote == "double" ? '"' : null
    const spaces = options.tab || " ".repeat(4)
    const nl = options.newline || "\n"

    function escapeString(text: string) {
        let q = quoteChar ?? '"'
        if (quoteChar == null) {
            for (let i = 0; i < text.length && i < 8; i++) {
                switch (text[i]) {
                    case "'": q = '"'; break
                    case '"': q = "'"; break
                    default: continue
                }
                break
            }
        }
        return `${q}${text.replace(RegExp(`[${q}\\\\]`, "g"), x => `\\${x}`)}${q}`
    }

    function stringify(tag: nbt.Tag, depth: number): string {
        const space = pretty ? " " : "", sep = pretty ? ", " : ","
        const sep2 = skipComma ? nl : `,${nl}`
        if (tag instanceof nbt.Byte) return `${tag.value}b`
        else if (tag instanceof nbt.Short) return `${tag.value}s`
        else if (tag instanceof nbt.Int) return `${tag.value | 0}`
        else if (typeof tag == "bigint") return `${tag}l`
        else if (tag instanceof nbt.Float) return `${tag.value}f`
        else if (typeof tag == "number")
            return (Number.isInteger(tag) ? `${tag}.0` : tag.toString()) + (options.strictDouble ? 'd' : '')
        else if (typeof tag == "string") return escapeString(tag)
        else if (typeof tag == "boolean") return useBoolean ? `${tag}` : escapeString(tag.toString())
        else if (tag instanceof Buffer
            || tag instanceof Int8Array) return `[B;${space}${[...tag].join(sep)}]`
        else if (tag instanceof Int32Array) return `[I;${space}${[...tag].join(sep)}]`
        else if (tag instanceof BigInt64Array) return `[L;${space}${[...tag].join(sep)}]`
        else if (tag instanceof Array) {
            const skipTab = options.noTagListTab === true && typeof tag[0] === 'object'
            const list = tag.map(tag => stringify(tag, depth + +!skipTab))
            if (list.reduce((acc, x) => acc + x.length, 0) > breakLength
                || list.some(text => text.includes("\n"))
            ) {
                const sList = list.map(text => spaces.repeat(depth - +skipTab) + text).join(sep2)
                return skipTab 
                    ? `[${sList.trim()}]`
                    : `[${nl}${sList}${nl}${spaces.repeat(depth - 1)}]`
            } else {
                return `[${list.join(sep)}]`
            }
        } else {
            const pairs = (tag instanceof Map ? [...tag] : Object.entries(tag)
                .filter(([_, v]) => v != null))
                .map(([key, tag]) => {
                    if (!unquotedRegExp.test(key)) key = escapeString(key)
                    return `${key}:${space}${stringify(tag!, depth + 1)}`
                })
            if (pretty && pairs.reduce((acc, x) => acc + x.length, 0) > breakLength) {
                return `{${nl}${pairs.map(text => spaces.repeat(depth)
                    + text).join(sep2)}${nl}${spaces.repeat(depth - 1)}}`
            } else {
                return pairs.length ? `{${space}${pairs.join(sep)}${space}}` : '{}'
            }
        }
    }
    return stringify(tag, 1)
}

export interface ParseOptions {
    useMaps?: boolean
    skipComma?: boolean
    useBoolean?: boolean
}

export function parse(text: string, options: ParseOptions = {}) {
    let index = 0, i = 0, char = ""

    const unexpectedEnd = () => new Error("Unexpected end")
    const unexpectedChar = (i?: number) => {
        if (i == null) i = index
        return new Error(`Unexpected character ${text[index]} at position ${index}`)
    }

    function skipWhitespace() {
        while (index < text.length) {
            if (text[index] != " " && text[index] != "\t" && text[index] != "\n" && text[index] != "\r") return
            index += 1
        }
    }

    function readNumber() {
        if (!"-0123456789".includes(text[index])) return null
        i = index++
        let hasFloatingPoint = false
        while (index < text.length) {
            char = text[index++]
            if ("0123456789".includes(char)) {
                continue
            } else if (char == ".") {
                if (hasFloatingPoint) return (index-- , null)
                hasFloatingPoint = true
            } else if (char == "f" || char == "F") {
                return new nbt.Float(+text.slice(i, index - 1))
            } else if (char == "d" || char == "D") {
                return +text.slice(i, index - 1)
            } else if (char == "b" || char == "B") {
                return new nbt.Byte(+text.slice(i, index - 1))
            } else if (char == "s" || char == "S") {
                return new nbt.Short(+text.slice(i, index - 1))
            } else if (char == "l" || char == "L") {
                return BigInt(text.slice(i, index - 1))
            } else if (hasFloatingPoint) {
                return +text.slice(i, --index)
            } else return new nbt.Int(+text.slice(i, --index))
        }
        if (hasFloatingPoint) return +text.slice(i, index)
        else return new nbt.Int(+text.slice(i, index))
    }

    function readUnquotedString(useBoolean = false) {
        i = index
        while (index < text.length) {
            if (!unquotedRegExp.test(text[index])) break
            index++
        }
        if (index - i == 0) throw index == text.length ? unexpectedEnd() : unexpectedChar()
        const str = text.slice(i, index)
        if (useBoolean) {
            if (str === "true") return true
            else if (str === "false") return false
        }
        return str
    }

    function readQuotedString() {
        const quoteChar = text[index]
        i = ++index
        let string = ""
        while (index < text.length) {
            char = text[index++]
            if (char == "\\") {
                string += text.slice(i, index - 1) + text[index]
                i = ++index
            } else if (char == quoteChar) return string + text.slice(i, index - 1)
        }
        throw unexpectedEnd()
    }

    function readString() {
        if (text[index] == '"' || text[index] == "'") return readQuotedString()
        else return readUnquotedString() as string
    }

    function skipCommas(isFirst: boolean, end: string) {
        skipWhitespace()
        if (text[index] == ",") {
            if (isFirst) throw unexpectedChar()
            else index++ , skipWhitespace()
        } else if (!isFirst && text[index] != end) {
            if (!options.skipComma) throw unexpectedChar()
        }
    }

    function readCompound(): nbt.TagObject | nbt.TagMap {
        const entries: [string, nbt.Tag][] = []
        let first = true
        while (true) {
            skipCommas(first, "}"), first = false
            if (text[index] == "}") {
                index++
                return options.useMaps
                    ? new Map(entries)
                    : entries.reduce<nbt.TagObject>((obj, [k, v]) => (obj[k] = v, obj), {})
            }
            const key = readString() as string
            skipWhitespace()
            if (text[index++] != ":") throw unexpectedChar()
            entries.push([key, parse()])
        }
    }

    function readArray(type: string) {
        const array: string[] = []
        while (index < text.length) {
            skipCommas(array.length == 0, "]")
            if (text[index] == "]") {
                index++
                if (type == "B") return Buffer.from(array.map(v => +v))
                else if (type == "I") return Int32Array.from(array.map(v => +v))
                else if (type == "L") return BigInt64Array.from(array.map(v => BigInt(v)))
            }
            i = index
            if (text[index] == "-") index++
            while (index < text.length) {
                if (!"0123456789".includes(text[index])) break
                index++
            }
            if (index - i == 0) throw unexpectedChar()
            if (unquotedRegExp.test(text[index])) throw unexpectedChar()
            array.push(text.slice(i, index))
        }
        throw unexpectedEnd()
    }

    function readList() {
        if ("BILbil".includes(text[index]) && text[index + 1] == ";") {
            return readArray(text[(index += 2) - 2].toUpperCase())
        }
        const array: nbt.TagArray = []
        while (index < text.length) {
            skipWhitespace()
            skipCommas(array.length == 0, "]")
            if (text[index] == "]") return (index++ , array)
            array.push(parse())
        }
        throw unexpectedEnd()
    }

    function parse(): nbt.Tag {
        skipWhitespace()

        i = index, char = text[index]
        if (char == "{") return (index++ , readCompound())
        else if (char == "[") return (index++ , readList())
        else if (char == '"' || char == "'") return readQuotedString()

        const value = readNumber()
        if (value != null && (index == text.length || !unquotedRegExp.test(text[index]))) {
            return value
        }
        index = i
        return readUnquotedString(options.useBoolean)
    }

    const value = parse()
    return value
}
