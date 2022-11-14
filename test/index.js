const { unzipSync } = require("zlib")
const assert = require("assert")
const fs = require("fs")
const nbt = require("..")

const bigtestBuffer = unzipSync(fs.readFileSync("examples/bigtest.nbt"))

// NBT

const { name, value } = nbt.decode(bigtestBuffer)

assert(nbt.encode(name, value).equals(bigtestBuffer))

assert.throws(() => nbt.encode(null, [1, "a"]))
assert.throws(() => nbt.decode(Buffer.from("99", "hex"), { unnamed: true }))
assert.throws(() => nbt.decode(Buffer.from("00000b00000001", "hex").slice(2), { unnamed: true }))

nbt.decode(Buffer.from([0]), false)

// SNBT

assert.deepStrictEqual(value, nbt.parse(nbt.stringify(value)))
assert.deepStrictEqual(value, nbt.parse(nbt.stringify(value, { pretty: true })))

assert.doesNotThrow(() => {
    nbt.parse("{ a: 1f, b: 2.0, }")
    nbt.parse("[1, 2,]")
}, "trailing comma")

assert.doesNotThrow(() => {
    nbt.parse(`'"'`)
    nbt.parse(`{'a': 1, "b": 'c'}`)
}, "single quotes")

assert.throws(() => nbt.parse(`{a: `))
assert.throws(() => nbt.parse(`{,a: 1}`))
assert.throws(() => nbt.parse(`[1,,]`))
assert.throws(() => nbt.parse(`[,""]`))

assert.strictEqual(typeof nbt.parse("1bb"), "string")
assert.strictEqual(typeof nbt.parse("1.0.0"), "string")

assert.strictEqual(nbt.parse('"\\\\"'), "\\", "escape backslash")
assert.strictEqual(nbt.stringify(nbt.parse('"\\\\"')), '"\\\\"', "escape backslash")

assert.strictEqual(nbt.parse(`"'\\"'\\""`), `'"'"`, "escape quote")
assert.strictEqual(nbt.stringify(nbt.parse(`"'\\"'\\""`)), `"'\\"'\\""`, "escape quote")

assert.doesNotThrow(() => {
    nbt.parse(fs.readFileSync("examples/test_tabs.snbt", "utf8"))
}, "tabs as whitespaces")

assert.doesNotThrow(() => {
    nbt.parse(fs.readFileSync("examples/test_crlf.snbt", "utf8"))
}, "CR LF as new lines")

assert.strictEqual(nbt.parse("false"), "false")
assert.strictEqual(nbt.parse("true"), "true")
assert.strictEqual(nbt.parse("false", { useBoolean: true }), false)
assert.strictEqual(nbt.parse("true", { useBoolean: true }), true)
assert.strictEqual(nbt.parse("'false'", { useBoolean: true }), "false")
assert.strictEqual(nbt.parse("'true'", { useBoolean: true }), "true")

assert.doesNotThrow(() => {
    nbt.parse(`
        {
            a: 1
            b: 2
        }
    `, { skipComma: true })
}, "without commas")

assert.strictEqual(nbt.stringify(nbt.parse("{a:1,b:2}"), { pretty: true, skipComma: true, breakLength: 1 }), `{
    a: 1
    b: 2
}`)

assert.strictEqual(nbt.stringify(nbt.parse("0.1d")), '0.1')
assert.strictEqual(nbt.stringify(nbt.parse("0.1"), { strictDouble: true }), '0.1d')

assert.strictEqual(nbt.stringify(nbt.parse("[{a:1},{b:2}]"), { pretty: true, noTagListTab: true, breakLength: 1 }), `[{
    a: 1
},
{
    b: 2
}]`)

assert.strictEqual(nbt.stringify(nbt.parse("[B;0,1]"), { pretty: true, strictList: true, breakLength: 0 }),
`[B;
    0b,
    1b
]`)
