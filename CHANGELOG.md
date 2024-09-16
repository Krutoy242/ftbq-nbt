# Changelog

All notable changes to this library will be documented here.

## 1.4.0

- Allow using tabs & CRLF for SNBT
- Allow booleans & skipping commas in SNBT
- Add `options.noTagListTab` changing TAG_List format
  > Needed for wothking with FTBQuests formatter
- Empty TAG_Compound - remove spaces
  > There always should be {} when map is empty. Beore this change it was { }
- `options.breakLength` now accept `0` as value
- Split number arrays in lines same manner as tag lists (when pretty and length bigger than `breakLength`)
- Add new options required for working with FTBQuests:
  > * `strictList` add type postfix for each list element.
  > * `typePostfix` what letter should be added at the end of each typed value
  > * `arrayPostfix` letter to add after each list value

## 1.2.5

- Fixed bug with encoding and decoding `null` tags.

## 1.2.1

- Fixed a few bugs with SNBT parsing and serialization.

## 1.2.0

- Added support for stringified NBT tags.

## 1.1.0

- Added support for `Int8Array`s in encode function.
- Switched to using node's buffer bigint methods with temporary shim until
node 12 reaches _active LTS_ stage.

## 1.0.5

- Fixed bug with dataview in array conversion.

## 1.0.4

- Added basic tests for encoding and decoding.

## 1.0.0

- First major release since the API is mostly stable.
- Allow `null` as tag value in encode function.

## 0.1.2

- Added support for int arrays and long arrays.

## 0.1.0

- Initial release
