// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * This module is browser compatible.
 *
 * @module
 */ import { assert } from "../_util/assert.ts";
const { hasOwn  } = Object;
function get(obj, key) {
    if (hasOwn(obj, key)) {
        return obj[key];
    }
}
function getForce(obj, key) {
    const v = get(obj, key);
    assert(v != null);
    return v;
}
function isNumber(x) {
    if (typeof x === "number") return true;
    if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}
function hasKey(obj, keys) {
    let o = obj;
    keys.slice(0, -1).forEach((key)=>{
        o = get(o, key) ?? {};
    });
    const key = keys[keys.length - 1];
    return key in o;
}
/** Take a set of command line arguments, optionally with a set of options, and
 * return an object representing the flags found in the passed arguments.
 *
 * By default any arguments starting with `-` or `--` are considered boolean
 * flags. If the argument name is followed by an equal sign (`=`) it is
 * considered a key-value pair. Any arguments which could not be parsed are
 * available in the `_` property of the returned object.
 *
 * ```ts
 * import { parse } from "./mod.ts";
 * const parsedArgs = parse(Deno.args);
 * ```
 *
 * ```ts
 * import { parse } from "./mod.ts";
 * const parsedArgs = parse(["--foo", "--bar=baz", "--no-qux", "./quux.txt"]);
 * // parsedArgs: { foo: true, bar: "baz", qux: false, _: ["./quux.txt"] }
 * ```
 */ export function parse(args, { "--": doubleDash = false , alias ={} , boolean =false , default: defaults = {} , stopEarly =false , string =[] , collect =[] , unknown =(i)=>i  } = {}) {
    const flags = {
        bools: {},
        strings: {},
        unknownFn: unknown,
        allBools: false,
        collect: {}
    };
    if (boolean !== undefined) {
        if (typeof boolean === "boolean") {
            flags.allBools = !!boolean;
        } else {
            const booleanArgs = typeof boolean === "string" ? [
                boolean
            ] : boolean;
            for (const key of booleanArgs.filter(Boolean)){
                flags.bools[key] = true;
            }
        }
    }
    const aliases = {};
    if (alias !== undefined) {
        for(const key1 in alias){
            const val = getForce(alias, key1);
            if (typeof val === "string") {
                aliases[key1] = [
                    val
                ];
            } else {
                aliases[key1] = val;
            }
            for (const alias1 of getForce(aliases, key1)){
                aliases[alias1] = [
                    key1
                ].concat(aliases[key1].filter((y)=>alias1 !== y));
            }
        }
    }
    if (string !== undefined) {
        const stringArgs = typeof string === "string" ? [
            string
        ] : string;
        for (const key2 of stringArgs.filter(Boolean)){
            flags.strings[key2] = true;
            const alias2 = get(aliases, key2);
            if (alias2) {
                for (const al of alias2){
                    flags.strings[al] = true;
                }
            }
        }
    }
    if (collect !== undefined) {
        const collectArgs = typeof collect === "string" ? [
            collect
        ] : collect;
        for (const key3 of collectArgs.filter(Boolean)){
            flags.collect[key3] = true;
            const alias3 = get(aliases, key3);
            if (alias3) {
                for (const al1 of alias3){
                    flags.collect[al1] = true;
                }
            }
        }
    }
    const argv = {
        _: []
    };
    function argDefined(key, arg) {
        return flags.allBools && /^--[^=]+$/.test(arg) || get(flags.bools, key) || !!get(flags.strings, key) || !!get(aliases, key);
    }
    function setKey(obj, name, value, collect = true) {
        let o = obj;
        const keys = name.split(".");
        keys.slice(0, -1).forEach(function(key) {
            if (get(o, key) === undefined) {
                o[key] = {};
            }
            o = get(o, key);
        });
        const key = keys[keys.length - 1];
        const collectable = collect && !!get(flags.collect, name);
        if (!collectable) {
            o[key] = value;
        } else if (get(o, key) === undefined) {
            o[key] = [
                value
            ];
        } else if (Array.isArray(get(o, key))) {
            o[key].push(value);
        } else {
            o[key] = [
                get(o, key),
                value
            ];
        }
    }
    function setArg(key, val, arg = undefined, collect) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg, key, val) === false) return;
        }
        const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
        setKey(argv, key, value, collect);
        const alias = get(aliases, key);
        if (alias) {
            for (const x of alias){
                setKey(argv, x, value, collect);
            }
        }
    }
    function aliasIsBoolean(key) {
        return getForce(aliases, key).some((x)=>typeof get(flags.bools, x) === "boolean");
    }
    let notFlags = [];
    // all args after "--" are not parsed
    if (args.includes("--")) {
        notFlags = args.slice(args.indexOf("--") + 1);
        args = args.slice(0, args.indexOf("--"));
    }
    for(let i = 0; i < args.length; i++){
        const arg = args[i];
        if (/^--.+=/.test(arg)) {
            const m = arg.match(/^--([^=]+)=(.*)$/s);
            assert(m != null);
            const [, key4, value] = m;
            if (flags.bools[key4]) {
                const booleanValue = value !== "false";
                setArg(key4, booleanValue, arg);
            } else {
                setArg(key4, value, arg);
            }
        } else if (/^--no-.+/.test(arg)) {
            const m1 = arg.match(/^--no-(.+)/);
            assert(m1 != null);
            setArg(m1[1], false, arg, false);
        } else if (/^--.+/.test(arg)) {
            const m2 = arg.match(/^--(.+)/);
            assert(m2 != null);
            const [, key5] = m2;
            const next = args[i + 1];
            if (next !== undefined && !/^-/.test(next) && !get(flags.bools, key5) && !flags.allBools && (get(aliases, key5) ? !aliasIsBoolean(key5) : true)) {
                setArg(key5, next, arg);
                i++;
            } else if (/^(true|false)$/.test(next)) {
                setArg(key5, next === "true", arg);
                i++;
            } else {
                setArg(key5, get(flags.strings, key5) ? "" : true, arg);
            }
        } else if (/^-[^-]+/.test(arg)) {
            const letters = arg.slice(1, -1).split("");
            let broken = false;
            for(let j = 0; j < letters.length; j++){
                const next1 = arg.slice(j + 2);
                if (next1 === "-") {
                    setArg(letters[j], next1, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next1)) {
                    setArg(letters[j], next1.split(/=(.+)/)[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next1)) {
                    setArg(letters[j], next1, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                } else {
                    setArg(letters[j], get(flags.strings, letters[j]) ? "" : true, arg);
                }
            }
            const [key6] = arg.slice(-1);
            if (!broken && key6 !== "-") {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !get(flags.bools, key6) && (get(aliases, key6) ? !aliasIsBoolean(key6) : true)) {
                    setArg(key6, args[i + 1], arg);
                    i++;
                } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key6, args[i + 1] === "true", arg);
                    i++;
                } else {
                    setArg(key6, get(flags.strings, key6) ? "" : true, arg);
                }
            }
        } else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings["_"] ?? !isNumber(arg) ? arg : Number(arg));
            }
            if (stopEarly) {
                argv._.push(...args.slice(i + 1));
                break;
            }
        }
    }
    for (const [key7, value1] of Object.entries(defaults)){
        if (!hasKey(argv, key7.split("."))) {
            setKey(argv, key7, value1);
            if (aliases[key7]) {
                for (const x of aliases[key7]){
                    setKey(argv, x, value1);
                }
            }
        }
    }
    for (const key8 of Object.keys(flags.bools)){
        if (!hasKey(argv, key8.split("."))) {
            const value2 = get(flags.collect, key8) ? [] : false;
            setKey(argv, key8, value2, false);
        }
    }
    for (const key9 of Object.keys(flags.strings)){
        if (!hasKey(argv, key9.split(".")) && get(flags.collect, key9)) {
            setKey(argv, key9, [], false);
        }
    }
    if (doubleDash) {
        argv["--"] = [];
        for (const key10 of notFlags){
            argv["--"].push(key10);
        }
    } else {
        for (const key11 of notFlags){
            argv._.push(key11);
        }
    }
    return argv;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MS4wL2ZsYWdzL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLyoqXG4gKiBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG4gKlxuICogQG1vZHVsZVxuICovXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vX3V0aWwvYXNzZXJ0LnRzXCI7XG5cbi8qKiBUaGUgdmFsdWUgcmV0dXJuZWQgZnJvbSBgcGFyc2VgLiAqL1xuZXhwb3J0IGludGVyZmFjZSBBcmdzIHtcbiAgLyoqIENvbnRhaW5zIGFsbCB0aGUgYXJndW1lbnRzIHRoYXQgZGlkbid0IGhhdmUgYW4gb3B0aW9uIGFzc29jaWF0ZWQgd2l0aFxuICAgKiB0aGVtLiAqL1xuICBfOiBBcnJheTxzdHJpbmcgfCBudW1iZXI+O1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBba2V5OiBzdHJpbmddOiBhbnk7XG59XG5cbi8qKiBUaGUgb3B0aW9ucyBmb3IgdGhlIGBwYXJzZWAgY2FsbC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VPcHRpb25zIHtcbiAgLyoqIFdoZW4gYHRydWVgLCBwb3B1bGF0ZSB0aGUgcmVzdWx0IGBfYCB3aXRoIGV2ZXJ5dGhpbmcgYmVmb3JlIHRoZSBgLS1gIGFuZFxuICAgKiB0aGUgcmVzdWx0IGBbJy0tJ11gIHdpdGggZXZlcnl0aGluZyBhZnRlciB0aGUgYC0tYC4gSGVyZSdzIGFuIGV4YW1wbGU6XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIC8vICQgZGVubyBydW4gZXhhbXBsZS50cyAtLSBhIGFyZzFcbiAgICogaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAgICogY29uc29sZS5kaXIocGFyc2UoRGVuby5hcmdzLCB7IFwiLS1cIjogZmFsc2UgfSkpO1xuICAgKiAvLyBvdXRwdXQ6IHsgXzogWyBcImFcIiwgXCJhcmcxXCIgXSB9XG4gICAqIGNvbnNvbGUuZGlyKHBhcnNlKERlbm8uYXJncywgeyBcIi0tXCI6IHRydWUgfSkpO1xuICAgKiAvLyBvdXRwdXQ6IHsgXzogW10sIC0tOiBbIFwiYVwiLCBcImFyZzFcIiBdIH1cbiAgICogYGBgXG4gICAqXG4gICAqIERlZmF1bHRzIHRvIGBmYWxzZWAuXG4gICAqL1xuICBcIi0tXCI/OiBib29sZWFuO1xuXG4gIC8qKiBBbiBvYmplY3QgbWFwcGluZyBzdHJpbmcgbmFtZXMgdG8gc3RyaW5ncyBvciBhcnJheXMgb2Ygc3RyaW5nIGFyZ3VtZW50XG4gICAqIG5hbWVzIHRvIHVzZSBhcyBhbGlhc2VzLiAqL1xuICBhbGlhcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHN0cmluZ1tdPjtcblxuICAvKiogQSBib29sZWFuLCBzdHJpbmcgb3IgYXJyYXkgb2Ygc3RyaW5ncyB0byBhbHdheXMgdHJlYXQgYXMgYm9vbGVhbnMuIElmXG4gICAqIGB0cnVlYCB3aWxsIHRyZWF0IGFsbCBkb3VibGUgaHlwaGVuYXRlZCBhcmd1bWVudHMgd2l0aG91dCBlcXVhbCBzaWducyBhc1xuICAgKiBgYm9vbGVhbmAgKGUuZy4gYWZmZWN0cyBgLS1mb29gLCBub3QgYC1mYCBvciBgLS1mb289YmFyYCkgKi9cbiAgYm9vbGVhbj86IGJvb2xlYW4gfCBzdHJpbmcgfCBzdHJpbmdbXTtcblxuICAvKiogQW4gb2JqZWN0IG1hcHBpbmcgc3RyaW5nIGFyZ3VtZW50IG5hbWVzIHRvIGRlZmF1bHQgdmFsdWVzLiAqL1xuICBkZWZhdWx0PzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbiAgLyoqIFdoZW4gYHRydWVgLCBwb3B1bGF0ZSB0aGUgcmVzdWx0IGBfYCB3aXRoIGV2ZXJ5dGhpbmcgYWZ0ZXIgdGhlIGZpcnN0XG4gICAqIG5vbi1vcHRpb24uICovXG4gIHN0b3BFYXJseT86IGJvb2xlYW47XG5cbiAgLyoqIEEgc3RyaW5nIG9yIGFycmF5IG9mIHN0cmluZ3MgYXJndW1lbnQgbmFtZXMgdG8gYWx3YXlzIHRyZWF0IGFzIHN0cmluZ3MuICovXG4gIHN0cmluZz86IHN0cmluZyB8IHN0cmluZ1tdO1xuXG4gIC8qKiBBIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzIGFyZ3VtZW50IG5hbWVzIHRvIGFsd2F5cyB0cmVhdCBhcyBhcnJheXMuXG4gICAqIENvbGxlY3RhYmxlIG9wdGlvbnMgY2FuIGJlIHVzZWQgbXVsdGlwbGUgdGltZXMuIEFsbCB2YWx1ZXMgd2lsbCBiZVxuICAgKiBjb2xlbGN0ZWQgaW50byBvbmUgYXJyYXkuIElmIGEgbm9uLWNvbGxlY3RhYmxlIG9wdGlvbiBpcyB1c2VkIG11bHRpcGxlXG4gICAqIHRpbWVzLCB0aGUgbGFzdCB2YWx1ZSBpcyB1c2VkLiAqL1xuICBjb2xsZWN0Pzogc3RyaW5nIHwgc3RyaW5nW107XG5cbiAgLyoqIEEgZnVuY3Rpb24gd2hpY2ggaXMgaW52b2tlZCB3aXRoIGEgY29tbWFuZCBsaW5lIHBhcmFtZXRlciBub3QgZGVmaW5lZCBpblxuICAgKiB0aGUgYG9wdGlvbnNgIGNvbmZpZ3VyYXRpb24gb2JqZWN0LiBJZiB0aGUgZnVuY3Rpb24gcmV0dXJucyBgZmFsc2VgLCB0aGVcbiAgICogdW5rbm93biBvcHRpb24gaXMgbm90IGFkZGVkIHRvIGBwYXJzZWRBcmdzYC4gKi9cbiAgdW5rbm93bj86IChhcmc6IHN0cmluZywga2V5Pzogc3RyaW5nLCB2YWx1ZT86IHVua25vd24pID0+IHVua25vd247XG59XG5cbmludGVyZmFjZSBGbGFncyB7XG4gIGJvb2xzOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgc3RyaW5nczogUmVjb3JkPHN0cmluZywgYm9vbGVhbj47XG4gIGNvbGxlY3Q6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICB1bmtub3duRm46IChhcmc6IHN0cmluZywga2V5Pzogc3RyaW5nLCB2YWx1ZT86IHVua25vd24pID0+IHVua25vd247XG4gIGFsbEJvb2xzOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgTmVzdGVkTWFwcGluZyB7XG4gIFtrZXk6IHN0cmluZ106IE5lc3RlZE1hcHBpbmcgfCB1bmtub3duO1xufVxuXG5jb25zdCB7IGhhc093biB9ID0gT2JqZWN0O1xuXG5mdW5jdGlvbiBnZXQ8VD4ob2JqOiBSZWNvcmQ8c3RyaW5nLCBUPiwga2V5OiBzdHJpbmcpOiBUIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGhhc093bihvYmosIGtleSkpIHtcbiAgICByZXR1cm4gb2JqW2tleV07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0Rm9yY2U8VD4ob2JqOiBSZWNvcmQ8c3RyaW5nLCBUPiwga2V5OiBzdHJpbmcpOiBUIHtcbiAgY29uc3QgdiA9IGdldChvYmosIGtleSk7XG4gIGFzc2VydCh2ICE9IG51bGwpO1xuICByZXR1cm4gdjtcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoeDogdW5rbm93bik6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHggPT09IFwibnVtYmVyXCIpIHJldHVybiB0cnVlO1xuICBpZiAoL14weFswLTlhLWZdKyQvaS50ZXN0KFN0cmluZyh4KSkpIHJldHVybiB0cnVlO1xuICByZXR1cm4gL15bLStdPyg/OlxcZCsoPzpcXC5cXGQqKT98XFwuXFxkKykoZVstK10/XFxkKyk/JC8udGVzdChTdHJpbmcoeCkpO1xufVxuXG5mdW5jdGlvbiBoYXNLZXkob2JqOiBOZXN0ZWRNYXBwaW5nLCBrZXlzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICBsZXQgbyA9IG9iajtcbiAga2V5cy5zbGljZSgwLCAtMSkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgbyA9IChnZXQobywga2V5KSA/PyB7fSkgYXMgTmVzdGVkTWFwcGluZztcbiAgfSk7XG5cbiAgY29uc3Qga2V5ID0ga2V5c1trZXlzLmxlbmd0aCAtIDFdO1xuICByZXR1cm4ga2V5IGluIG87XG59XG5cbi8qKiBUYWtlIGEgc2V0IG9mIGNvbW1hbmQgbGluZSBhcmd1bWVudHMsIG9wdGlvbmFsbHkgd2l0aCBhIHNldCBvZiBvcHRpb25zLCBhbmRcbiAqIHJldHVybiBhbiBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSBmbGFncyBmb3VuZCBpbiB0aGUgcGFzc2VkIGFyZ3VtZW50cy5cbiAqXG4gKiBCeSBkZWZhdWx0IGFueSBhcmd1bWVudHMgc3RhcnRpbmcgd2l0aCBgLWAgb3IgYC0tYCBhcmUgY29uc2lkZXJlZCBib29sZWFuXG4gKiBmbGFncy4gSWYgdGhlIGFyZ3VtZW50IG5hbWUgaXMgZm9sbG93ZWQgYnkgYW4gZXF1YWwgc2lnbiAoYD1gKSBpdCBpc1xuICogY29uc2lkZXJlZCBhIGtleS12YWx1ZSBwYWlyLiBBbnkgYXJndW1lbnRzIHdoaWNoIGNvdWxkIG5vdCBiZSBwYXJzZWQgYXJlXG4gKiBhdmFpbGFibGUgaW4gdGhlIGBfYCBwcm9wZXJ0eSBvZiB0aGUgcmV0dXJuZWQgb2JqZWN0LlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBwYXJzZSB9IGZyb20gXCIuL21vZC50c1wiO1xuICogY29uc3QgcGFyc2VkQXJncyA9IHBhcnNlKERlbm8uYXJncyk7XG4gKiBgYGBcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAqIGNvbnN0IHBhcnNlZEFyZ3MgPSBwYXJzZShbXCItLWZvb1wiLCBcIi0tYmFyPWJhelwiLCBcIi0tbm8tcXV4XCIsIFwiLi9xdXV4LnR4dFwiXSk7XG4gKiAvLyBwYXJzZWRBcmdzOiB7IGZvbzogdHJ1ZSwgYmFyOiBcImJhelwiLCBxdXg6IGZhbHNlLCBfOiBbXCIuL3F1dXgudHh0XCJdIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2UoXG4gIGFyZ3M6IHN0cmluZ1tdLFxuICB7XG4gICAgXCItLVwiOiBkb3VibGVEYXNoID0gZmFsc2UsXG4gICAgYWxpYXMgPSB7fSxcbiAgICBib29sZWFuID0gZmFsc2UsXG4gICAgZGVmYXVsdDogZGVmYXVsdHMgPSB7fSxcbiAgICBzdG9wRWFybHkgPSBmYWxzZSxcbiAgICBzdHJpbmcgPSBbXSxcbiAgICBjb2xsZWN0ID0gW10sXG4gICAgdW5rbm93biA9IChpOiBzdHJpbmcpOiB1bmtub3duID0+IGksXG4gIH06IFBhcnNlT3B0aW9ucyA9IHt9LFxuKTogQXJncyB7XG4gIGNvbnN0IGZsYWdzOiBGbGFncyA9IHtcbiAgICBib29sczoge30sXG4gICAgc3RyaW5nczoge30sXG4gICAgdW5rbm93bkZuOiB1bmtub3duLFxuICAgIGFsbEJvb2xzOiBmYWxzZSxcbiAgICBjb2xsZWN0OiB7fSxcbiAgfTtcblxuICBpZiAoYm9vbGVhbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiBib29sZWFuID09PSBcImJvb2xlYW5cIikge1xuICAgICAgZmxhZ3MuYWxsQm9vbHMgPSAhIWJvb2xlYW47XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGJvb2xlYW5BcmdzID0gdHlwZW9mIGJvb2xlYW4gPT09IFwic3RyaW5nXCIgPyBbYm9vbGVhbl0gOiBib29sZWFuO1xuXG4gICAgICBmb3IgKGNvbnN0IGtleSBvZiBib29sZWFuQXJncy5maWx0ZXIoQm9vbGVhbikpIHtcbiAgICAgICAgZmxhZ3MuYm9vbHNba2V5XSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYWxpYXNlczogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG4gIGlmIChhbGlhcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZm9yIChjb25zdCBrZXkgaW4gYWxpYXMpIHtcbiAgICAgIGNvbnN0IHZhbCA9IGdldEZvcmNlKGFsaWFzLCBrZXkpO1xuICAgICAgaWYgKHR5cGVvZiB2YWwgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgYWxpYXNlc1trZXldID0gW3ZhbF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhbGlhc2VzW2tleV0gPSB2YWw7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGFsaWFzIG9mIGdldEZvcmNlKGFsaWFzZXMsIGtleSkpIHtcbiAgICAgICAgYWxpYXNlc1thbGlhc10gPSBba2V5XS5jb25jYXQoYWxpYXNlc1trZXldLmZpbHRlcigoeSkgPT4gYWxpYXMgIT09IHkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoc3RyaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBzdHJpbmdBcmdzID0gdHlwZW9mIHN0cmluZyA9PT0gXCJzdHJpbmdcIiA/IFtzdHJpbmddIDogc3RyaW5nO1xuXG4gICAgZm9yIChjb25zdCBrZXkgb2Ygc3RyaW5nQXJncy5maWx0ZXIoQm9vbGVhbikpIHtcbiAgICAgIGZsYWdzLnN0cmluZ3Nba2V5XSA9IHRydWU7XG4gICAgICBjb25zdCBhbGlhcyA9IGdldChhbGlhc2VzLCBrZXkpO1xuICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgIGZvciAoY29uc3QgYWwgb2YgYWxpYXMpIHtcbiAgICAgICAgICBmbGFncy5zdHJpbmdzW2FsXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoY29sbGVjdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgY29sbGVjdEFyZ3MgPSB0eXBlb2YgY29sbGVjdCA9PT0gXCJzdHJpbmdcIiA/IFtjb2xsZWN0XSA6IGNvbGxlY3Q7XG5cbiAgICBmb3IgKGNvbnN0IGtleSBvZiBjb2xsZWN0QXJncy5maWx0ZXIoQm9vbGVhbikpIHtcbiAgICAgIGZsYWdzLmNvbGxlY3Rba2V5XSA9IHRydWU7XG4gICAgICBjb25zdCBhbGlhcyA9IGdldChhbGlhc2VzLCBrZXkpO1xuICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgIGZvciAoY29uc3QgYWwgb2YgYWxpYXMpIHtcbiAgICAgICAgICBmbGFncy5jb2xsZWN0W2FsXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBhcmd2OiBBcmdzID0geyBfOiBbXSB9O1xuXG4gIGZ1bmN0aW9uIGFyZ0RlZmluZWQoa2V5OiBzdHJpbmcsIGFyZzogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgIChmbGFncy5hbGxCb29scyAmJiAvXi0tW149XSskLy50ZXN0KGFyZykpIHx8XG4gICAgICBnZXQoZmxhZ3MuYm9vbHMsIGtleSkgfHxcbiAgICAgICEhZ2V0KGZsYWdzLnN0cmluZ3MsIGtleSkgfHxcbiAgICAgICEhZ2V0KGFsaWFzZXMsIGtleSlcbiAgICApO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0S2V5KFxuICAgIG9iajogTmVzdGVkTWFwcGluZyxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgdmFsdWU6IHVua25vd24sXG4gICAgY29sbGVjdCA9IHRydWUsXG4gICk6IHZvaWQge1xuICAgIGxldCBvID0gb2JqO1xuICAgIGNvbnN0IGtleXMgPSBuYW1lLnNwbGl0KFwiLlwiKTtcbiAgICBrZXlzLnNsaWNlKDAsIC0xKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpOiB2b2lkIHtcbiAgICAgIGlmIChnZXQobywga2V5KSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9ba2V5XSA9IHt9O1xuICAgICAgfVxuICAgICAgbyA9IGdldChvLCBrZXkpIGFzIE5lc3RlZE1hcHBpbmc7XG4gICAgfSk7XG5cbiAgICBjb25zdCBrZXkgPSBrZXlzW2tleXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgY29sbGVjdGFibGUgPSBjb2xsZWN0ICYmICEhZ2V0KGZsYWdzLmNvbGxlY3QsIG5hbWUpO1xuXG4gICAgaWYgKCFjb2xsZWN0YWJsZSkge1xuICAgICAgb1trZXldID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChnZXQobywga2V5KSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBvW2tleV0gPSBbdmFsdWVdO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShnZXQobywga2V5KSkpIHtcbiAgICAgIChvW2tleV0gYXMgdW5rbm93bltdKS5wdXNoKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb1trZXldID0gW2dldChvLCBrZXkpLCB2YWx1ZV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0QXJnKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHZhbDogdW5rbm93bixcbiAgICBhcmc6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcbiAgICBjb2xsZWN0PzogYm9vbGVhbixcbiAgKTogdm9pZCB7XG4gICAgaWYgKGFyZyAmJiBmbGFncy51bmtub3duRm4gJiYgIWFyZ0RlZmluZWQoa2V5LCBhcmcpKSB7XG4gICAgICBpZiAoZmxhZ3MudW5rbm93bkZuKGFyZywga2V5LCB2YWwpID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlID0gIWdldChmbGFncy5zdHJpbmdzLCBrZXkpICYmIGlzTnVtYmVyKHZhbCkgPyBOdW1iZXIodmFsKSA6IHZhbDtcbiAgICBzZXRLZXkoYXJndiwga2V5LCB2YWx1ZSwgY29sbGVjdCk7XG5cbiAgICBjb25zdCBhbGlhcyA9IGdldChhbGlhc2VzLCBrZXkpO1xuICAgIGlmIChhbGlhcykge1xuICAgICAgZm9yIChjb25zdCB4IG9mIGFsaWFzKSB7XG4gICAgICAgIHNldEtleShhcmd2LCB4LCB2YWx1ZSwgY29sbGVjdCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYWxpYXNJc0Jvb2xlYW4oa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZ2V0Rm9yY2UoYWxpYXNlcywga2V5KS5zb21lKFxuICAgICAgKHgpID0+IHR5cGVvZiBnZXQoZmxhZ3MuYm9vbHMsIHgpID09PSBcImJvb2xlYW5cIixcbiAgICApO1xuICB9XG5cbiAgbGV0IG5vdEZsYWdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIGFsbCBhcmdzIGFmdGVyIFwiLS1cIiBhcmUgbm90IHBhcnNlZFxuICBpZiAoYXJncy5pbmNsdWRlcyhcIi0tXCIpKSB7XG4gICAgbm90RmxhZ3MgPSBhcmdzLnNsaWNlKGFyZ3MuaW5kZXhPZihcIi0tXCIpICsgMSk7XG4gICAgYXJncyA9IGFyZ3Muc2xpY2UoMCwgYXJncy5pbmRleE9mKFwiLS1cIikpO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYXJnID0gYXJnc1tpXTtcblxuICAgIGlmICgvXi0tLis9Ly50ZXN0KGFyZykpIHtcbiAgICAgIGNvbnN0IG0gPSBhcmcubWF0Y2goL14tLShbXj1dKyk9KC4qKSQvcyk7XG4gICAgICBhc3NlcnQobSAhPSBudWxsKTtcbiAgICAgIGNvbnN0IFssIGtleSwgdmFsdWVdID0gbTtcblxuICAgICAgaWYgKGZsYWdzLmJvb2xzW2tleV0pIHtcbiAgICAgICAgY29uc3QgYm9vbGVhblZhbHVlID0gdmFsdWUgIT09IFwiZmFsc2VcIjtcbiAgICAgICAgc2V0QXJnKGtleSwgYm9vbGVhblZhbHVlLCBhcmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0QXJnKGtleSwgdmFsdWUsIGFyZyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICgvXi0tbm8tLisvLnRlc3QoYXJnKSkge1xuICAgICAgY29uc3QgbSA9IGFyZy5tYXRjaCgvXi0tbm8tKC4rKS8pO1xuICAgICAgYXNzZXJ0KG0gIT0gbnVsbCk7XG4gICAgICBzZXRBcmcobVsxXSwgZmFsc2UsIGFyZywgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoL14tLS4rLy50ZXN0KGFyZykpIHtcbiAgICAgIGNvbnN0IG0gPSBhcmcubWF0Y2goL14tLSguKykvKTtcbiAgICAgIGFzc2VydChtICE9IG51bGwpO1xuICAgICAgY29uc3QgWywga2V5XSA9IG07XG4gICAgICBjb25zdCBuZXh0ID0gYXJnc1tpICsgMV07XG4gICAgICBpZiAoXG4gICAgICAgIG5leHQgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhL14tLy50ZXN0KG5leHQpICYmXG4gICAgICAgICFnZXQoZmxhZ3MuYm9vbHMsIGtleSkgJiZcbiAgICAgICAgIWZsYWdzLmFsbEJvb2xzICYmXG4gICAgICAgIChnZXQoYWxpYXNlcywga2V5KSA/ICFhbGlhc0lzQm9vbGVhbihrZXkpIDogdHJ1ZSlcbiAgICAgICkge1xuICAgICAgICBzZXRBcmcoa2V5LCBuZXh0LCBhcmcpO1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYgKC9eKHRydWV8ZmFsc2UpJC8udGVzdChuZXh0KSkge1xuICAgICAgICBzZXRBcmcoa2V5LCBuZXh0ID09PSBcInRydWVcIiwgYXJnKTtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0QXJnKGtleSwgZ2V0KGZsYWdzLnN0cmluZ3MsIGtleSkgPyBcIlwiIDogdHJ1ZSwgYXJnKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKC9eLVteLV0rLy50ZXN0KGFyZykpIHtcbiAgICAgIGNvbnN0IGxldHRlcnMgPSBhcmcuc2xpY2UoMSwgLTEpLnNwbGl0KFwiXCIpO1xuXG4gICAgICBsZXQgYnJva2VuID0gZmFsc2U7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxldHRlcnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgY29uc3QgbmV4dCA9IGFyZy5zbGljZShqICsgMik7XG5cbiAgICAgICAgaWYgKG5leHQgPT09IFwiLVwiKSB7XG4gICAgICAgICAgc2V0QXJnKGxldHRlcnNbal0sIG5leHQsIGFyZyk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoL1tBLVphLXpdLy50ZXN0KGxldHRlcnNbal0pICYmIC89Ly50ZXN0KG5leHQpKSB7XG4gICAgICAgICAgc2V0QXJnKGxldHRlcnNbal0sIG5leHQuc3BsaXQoLz0oLispLylbMV0sIGFyZyk7XG4gICAgICAgICAgYnJva2VuID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAvW0EtWmEtel0vLnRlc3QobGV0dGVyc1tqXSkgJiZcbiAgICAgICAgICAvLT9cXGQrKFxcLlxcZCopPyhlLT9cXGQrKT8kLy50ZXN0KG5leHQpXG4gICAgICAgICkge1xuICAgICAgICAgIHNldEFyZyhsZXR0ZXJzW2pdLCBuZXh0LCBhcmcpO1xuICAgICAgICAgIGJyb2tlbiA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGV0dGVyc1tqICsgMV0gJiYgbGV0dGVyc1tqICsgMV0ubWF0Y2goL1xcVy8pKSB7XG4gICAgICAgICAgc2V0QXJnKGxldHRlcnNbal0sIGFyZy5zbGljZShqICsgMiksIGFyZyk7XG4gICAgICAgICAgYnJva2VuID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZXRBcmcobGV0dGVyc1tqXSwgZ2V0KGZsYWdzLnN0cmluZ3MsIGxldHRlcnNbal0pID8gXCJcIiA6IHRydWUsIGFyZyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgW2tleV0gPSBhcmcuc2xpY2UoLTEpO1xuICAgICAgaWYgKCFicm9rZW4gJiYga2V5ICE9PSBcIi1cIikge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgYXJnc1tpICsgMV0gJiZcbiAgICAgICAgICAhL14oLXwtLSlbXi1dLy50ZXN0KGFyZ3NbaSArIDFdKSAmJlxuICAgICAgICAgICFnZXQoZmxhZ3MuYm9vbHMsIGtleSkgJiZcbiAgICAgICAgICAoZ2V0KGFsaWFzZXMsIGtleSkgPyAhYWxpYXNJc0Jvb2xlYW4oa2V5KSA6IHRydWUpXG4gICAgICAgICkge1xuICAgICAgICAgIHNldEFyZyhrZXksIGFyZ3NbaSArIDFdLCBhcmcpO1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfSBlbHNlIGlmIChhcmdzW2kgKyAxXSAmJiAvXih0cnVlfGZhbHNlKSQvLnRlc3QoYXJnc1tpICsgMV0pKSB7XG4gICAgICAgICAgc2V0QXJnKGtleSwgYXJnc1tpICsgMV0gPT09IFwidHJ1ZVwiLCBhcmcpO1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZXRBcmcoa2V5LCBnZXQoZmxhZ3Muc3RyaW5ncywga2V5KSA/IFwiXCIgOiB0cnVlLCBhcmcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghZmxhZ3MudW5rbm93bkZuIHx8IGZsYWdzLnVua25vd25GbihhcmcpICE9PSBmYWxzZSkge1xuICAgICAgICBhcmd2Ll8ucHVzaChmbGFncy5zdHJpbmdzW1wiX1wiXSA/PyAhaXNOdW1iZXIoYXJnKSA/IGFyZyA6IE51bWJlcihhcmcpKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdG9wRWFybHkpIHtcbiAgICAgICAgYXJndi5fLnB1c2goLi4uYXJncy5zbGljZShpICsgMSkpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhkZWZhdWx0cykpIHtcbiAgICBpZiAoIWhhc0tleShhcmd2LCBrZXkuc3BsaXQoXCIuXCIpKSkge1xuICAgICAgc2V0S2V5KGFyZ3YsIGtleSwgdmFsdWUpO1xuXG4gICAgICBpZiAoYWxpYXNlc1trZXldKSB7XG4gICAgICAgIGZvciAoY29uc3QgeCBvZiBhbGlhc2VzW2tleV0pIHtcbiAgICAgICAgICBzZXRLZXkoYXJndiwgeCwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoZmxhZ3MuYm9vbHMpKSB7XG4gICAgaWYgKCFoYXNLZXkoYXJndiwga2V5LnNwbGl0KFwiLlwiKSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gZ2V0KGZsYWdzLmNvbGxlY3QsIGtleSkgPyBbXSA6IGZhbHNlO1xuICAgICAgc2V0S2V5KFxuICAgICAgICBhcmd2LFxuICAgICAgICBrZXksXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBmYWxzZSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoZmxhZ3Muc3RyaW5ncykpIHtcbiAgICBpZiAoIWhhc0tleShhcmd2LCBrZXkuc3BsaXQoXCIuXCIpKSAmJiBnZXQoZmxhZ3MuY29sbGVjdCwga2V5KSkge1xuICAgICAgc2V0S2V5KFxuICAgICAgICBhcmd2LFxuICAgICAgICBrZXksXG4gICAgICAgIFtdLFxuICAgICAgICBmYWxzZSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGRvdWJsZURhc2gpIHtcbiAgICBhcmd2W1wiLS1cIl0gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBub3RGbGFncykge1xuICAgICAgYXJndltcIi0tXCJdLnB1c2goa2V5KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBrZXkgb2Ygbm90RmxhZ3MpIHtcbiAgICAgIGFyZ3YuXy5wdXNoKGtleSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFyZ3Y7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFOzs7O0NBSUMsR0FDRCxTQUFTLE1BQU0sUUFBUSxxQkFBcUI7QUF3RTVDLE1BQU0sRUFBRSxPQUFNLEVBQUUsR0FBRztBQUVuQixTQUFTLElBQU8sR0FBc0IsRUFBRSxHQUFXLEVBQWlCO0lBQ2xFLElBQUksT0FBTyxLQUFLLE1BQU07UUFDcEIsT0FBTyxHQUFHLENBQUMsSUFBSTtJQUNqQixDQUFDO0FBQ0g7QUFFQSxTQUFTLFNBQVksR0FBc0IsRUFBRSxHQUFXLEVBQUs7SUFDM0QsTUFBTSxJQUFJLElBQUksS0FBSztJQUNuQixPQUFPLEtBQUssSUFBSTtJQUNoQixPQUFPO0FBQ1Q7QUFFQSxTQUFTLFNBQVMsQ0FBVSxFQUFXO0lBQ3JDLElBQUksT0FBTyxNQUFNLFVBQVUsT0FBTyxJQUFJO0lBQ3RDLElBQUksaUJBQWlCLElBQUksQ0FBQyxPQUFPLEtBQUssT0FBTyxJQUFJO0lBQ2pELE9BQU8sNkNB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