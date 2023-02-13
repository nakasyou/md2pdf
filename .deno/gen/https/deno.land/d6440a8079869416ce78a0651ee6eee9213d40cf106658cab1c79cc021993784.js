// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Structured similarly to Go's cookie.go
// https://github.com/golang/go/blob/master/src/net/http/cookie.go
// This module is browser compatible.
import { assert } from "../_util/assert.ts";
import { toIMF } from "../datetime/mod.ts";
const FIELD_CONTENT_REGEXP = /^(?=[\x20-\x7E]*$)[^()@<>,;:\\"\[\]?={}\s]+$/;
function toString(cookie) {
    if (!cookie.name) {
        return "";
    }
    const out = [];
    validateName(cookie.name);
    validateValue(cookie.name, cookie.value);
    out.push(`${cookie.name}=${cookie.value}`);
    // Fallback for invalid Set-Cookie
    // ref: https://tools.ietf.org/html/draft-ietf-httpbis-cookie-prefixes-00#section-3.1
    if (cookie.name.startsWith("__Secure")) {
        cookie.secure = true;
    }
    if (cookie.name.startsWith("__Host")) {
        cookie.path = "/";
        cookie.secure = true;
        delete cookie.domain;
    }
    if (cookie.secure) {
        out.push("Secure");
    }
    if (cookie.httpOnly) {
        out.push("HttpOnly");
    }
    if (typeof cookie.maxAge === "number" && Number.isInteger(cookie.maxAge)) {
        assert(cookie.maxAge >= 0, "Max-Age must be an integer superior or equal to 0");
        out.push(`Max-Age=${cookie.maxAge}`);
    }
    if (cookie.domain) {
        validateDomain(cookie.domain);
        out.push(`Domain=${cookie.domain}`);
    }
    if (cookie.sameSite) {
        out.push(`SameSite=${cookie.sameSite}`);
    }
    if (cookie.path) {
        validatePath(cookie.path);
        out.push(`Path=${cookie.path}`);
    }
    if (cookie.expires) {
        const dateString = toIMF(cookie.expires);
        out.push(`Expires=${dateString}`);
    }
    if (cookie.unparsed) {
        out.push(cookie.unparsed.join("; "));
    }
    return out.join("; ");
}
/**
 * Validate Cookie Name.
 * @param name Cookie name.
 */ function validateName(name) {
    if (name && !FIELD_CONTENT_REGEXP.test(name)) {
        throw new TypeError(`Invalid cookie name: "${name}".`);
    }
}
/**
 * Validate Path Value.
 * See {@link https://tools.ietf.org/html/rfc6265#section-4.1.2.4}.
 * @param path Path value.
 */ function validatePath(path) {
    if (path == null) {
        return;
    }
    for(let i = 0; i < path.length; i++){
        const c = path.charAt(i);
        if (c < String.fromCharCode(0x20) || c > String.fromCharCode(0x7E) || c == ";") {
            throw new Error(path + ": Invalid cookie path char '" + c + "'");
        }
    }
}
/**
 * Validate Cookie Value.
 * See {@link https://tools.ietf.org/html/rfc6265#section-4.1}.
 * @param value Cookie value.
 */ function validateValue(name, value) {
    if (value == null || name == null) return;
    for(let i = 0; i < value.length; i++){
        const c = value.charAt(i);
        if (c < String.fromCharCode(0x21) || c == String.fromCharCode(0x22) || c == String.fromCharCode(0x2c) || c == String.fromCharCode(0x3b) || c == String.fromCharCode(0x5c) || c == String.fromCharCode(0x7f)) {
            throw new Error("RFC2616 cookie '" + name + "' cannot have '" + c + "' as value");
        }
        if (c > String.fromCharCode(0x80)) {
            throw new Error("RFC2616 cookie '" + name + "' can only have US-ASCII chars as value" + c.charCodeAt(0).toString(16));
        }
    }
}
/**
 * Validate Cookie Domain.
 * See {@link https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.2.3}.
 * @param domain Cookie domain.
 */ function validateDomain(domain) {
    if (domain == null) {
        return;
    }
    const char1 = domain.charAt(0);
    const charN = domain.charAt(domain.length - 1);
    if (char1 == "-" || charN == "." || charN == "-") {
        throw new Error("Invalid first/last char in cookie domain: " + domain);
    }
}
/**
 * Parse cookies of a header
 * @param {Headers} headers The headers instance to get cookies from
 * @return {Object} Object with cookie names as keys
 */ export function getCookies(headers) {
    const cookie = headers.get("Cookie");
    if (cookie != null) {
        const out = {};
        const c = cookie.split(";");
        for (const kv of c){
            const [cookieKey, ...cookieVal] = kv.split("=");
            assert(cookieKey != null);
            const key = cookieKey.trim();
            out[key] = cookieVal.join("=");
        }
        return out;
    }
    return {};
}
/**
 * Set the cookie header properly in the headers
 * @param {Headers} headers The headers instance to set the cookie to
 * @param {Object} cookie Cookie to set
 */ export function setCookie(headers, cookie) {
    // TODO(zekth) : Add proper parsing of Set-Cookie headers
    // Parsing cookie headers to make consistent set-cookie header
    // ref: https://tools.ietf.org/html/rfc6265#section-4.1.1
    const v = toString(cookie);
    if (v) {
        headers.append("Set-Cookie", v);
    }
}
/**
 * Set the cookie header with empty value in the headers to delete it
 * @param {Headers} headers The headers instance to delete the cookie from
 * @param {string} name Name of cookie
 * @param {Object} attributes Additional cookie attributes
 */ export function deleteCookie(headers, name, attributes) {
    setCookie(headers, {
        name: name,
        value: "",
        expires: new Date(0),
        ...attributes
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MS4wL2h0dHAvY29va2llLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBTdHJ1Y3R1cmVkIHNpbWlsYXJseSB0byBHbydzIGNvb2tpZS5nb1xuLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvbGFuZy9nby9ibG9iL21hc3Rlci9zcmMvbmV0L2h0dHAvY29va2llLmdvXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCIuLi9fdXRpbC9hc3NlcnQudHNcIjtcbmltcG9ydCB7IHRvSU1GIH0gZnJvbSBcIi4uL2RhdGV0aW1lL21vZC50c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvb2tpZSB7XG4gIC8qKiBOYW1lIG9mIHRoZSBjb29raWUuICovXG4gIG5hbWU6IHN0cmluZztcbiAgLyoqIFZhbHVlIG9mIHRoZSBjb29raWUuICovXG4gIHZhbHVlOiBzdHJpbmc7XG4gIC8qKiBFeHBpcmF0aW9uIGRhdGUgb2YgdGhlIGNvb2tpZS4gKi9cbiAgZXhwaXJlcz86IERhdGU7XG4gIC8qKiBNYXgtQWdlIG9mIHRoZSBDb29raWUuIE1heC1BZ2UgbXVzdCBiZSBhbiBpbnRlZ2VyIHN1cGVyaW9yIG9yIGVxdWFsIHRvIDAuICovXG4gIG1heEFnZT86IG51bWJlcjtcbiAgLyoqIFNwZWNpZmllcyB0aG9zZSBob3N0cyB0byB3aGljaCB0aGUgY29va2llIHdpbGwgYmUgc2VudC4gKi9cbiAgZG9tYWluPzogc3RyaW5nO1xuICAvKiogSW5kaWNhdGVzIGEgVVJMIHBhdGggdGhhdCBtdXN0IGV4aXN0IGluIHRoZSByZXF1ZXN0LiAqL1xuICBwYXRoPzogc3RyaW5nO1xuICAvKiogSW5kaWNhdGVzIGlmIHRoZSBjb29raWUgaXMgbWFkZSB1c2luZyBTU0wgJiBIVFRQUy4gKi9cbiAgc2VjdXJlPzogYm9vbGVhbjtcbiAgLyoqIEluZGljYXRlcyB0aGF0IGNvb2tpZSBpcyBub3QgYWNjZXNzaWJsZSB2aWEgSmF2YVNjcmlwdC4gKi9cbiAgaHR0cE9ubHk/OiBib29sZWFuO1xuICAvKipcbiAgICogQWxsb3dzIHNlcnZlcnMgdG8gYXNzZXJ0IHRoYXQgYSBjb29raWUgb3VnaHQgbm90IHRvXG4gICAqIGJlIHNlbnQgYWxvbmcgd2l0aCBjcm9zcy1zaXRlIHJlcXVlc3RzLlxuICAgKi9cbiAgc2FtZVNpdGU/OiBcIlN0cmljdFwiIHwgXCJMYXhcIiB8IFwiTm9uZVwiO1xuICAvKiogQWRkaXRpb25hbCBrZXkgdmFsdWUgcGFpcnMgd2l0aCB0aGUgZm9ybSBcImtleT12YWx1ZVwiICovXG4gIHVucGFyc2VkPzogc3RyaW5nW107XG59XG5cbmNvbnN0IEZJRUxEX0NPTlRFTlRfUkVHRVhQID0gL14oPz1bXFx4MjAtXFx4N0VdKiQpW14oKUA8Piw7OlxcXFxcIlxcW1xcXT89e31cXHNdKyQvO1xuXG5mdW5jdGlvbiB0b1N0cmluZyhjb29raWU6IENvb2tpZSk6IHN0cmluZyB7XG4gIGlmICghY29va2llLm5hbWUpIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG4gIHZhbGlkYXRlTmFtZShjb29raWUubmFtZSk7XG4gIHZhbGlkYXRlVmFsdWUoY29va2llLm5hbWUsIGNvb2tpZS52YWx1ZSk7XG4gIG91dC5wdXNoKGAke2Nvb2tpZS5uYW1lfT0ke2Nvb2tpZS52YWx1ZX1gKTtcblxuICAvLyBGYWxsYmFjayBmb3IgaW52YWxpZCBTZXQtQ29va2llXG4gIC8vIHJlZjogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL2RyYWZ0LWlldGYtaHR0cGJpcy1jb29raWUtcHJlZml4ZXMtMDAjc2VjdGlvbi0zLjFcbiAgaWYgKGNvb2tpZS5uYW1lLnN0YXJ0c1dpdGgoXCJfX1NlY3VyZVwiKSkge1xuICAgIGNvb2tpZS5zZWN1cmUgPSB0cnVlO1xuICB9XG4gIGlmIChjb29raWUubmFtZS5zdGFydHNXaXRoKFwiX19Ib3N0XCIpKSB7XG4gICAgY29va2llLnBhdGggPSBcIi9cIjtcbiAgICBjb29raWUuc2VjdXJlID0gdHJ1ZTtcbiAgICBkZWxldGUgY29va2llLmRvbWFpbjtcbiAgfVxuXG4gIGlmIChjb29raWUuc2VjdXJlKSB7XG4gICAgb3V0LnB1c2goXCJTZWN1cmVcIik7XG4gIH1cbiAgaWYgKGNvb2tpZS5odHRwT25seSkge1xuICAgIG91dC5wdXNoKFwiSHR0cE9ubHlcIik7XG4gIH1cbiAgaWYgKHR5cGVvZiBjb29raWUubWF4QWdlID09PSBcIm51bWJlclwiICYmIE51bWJlci5pc0ludGVnZXIoY29va2llLm1heEFnZSkpIHtcbiAgICBhc3NlcnQoXG4gICAgICBjb29raWUubWF4QWdlID49IDAsXG4gICAgICBcIk1heC1BZ2UgbXVzdCBiZSBhbiBpbnRlZ2VyIHN1cGVyaW9yIG9yIGVxdWFsIHRvIDBcIixcbiAgICApO1xuICAgIG91dC5wdXNoKGBNYXgtQWdlPSR7Y29va2llLm1heEFnZX1gKTtcbiAgfVxuICBpZiAoY29va2llLmRvbWFpbikge1xuICAgIHZhbGlkYXRlRG9tYWluKGNvb2tpZS5kb21haW4pO1xuICAgIG91dC5wdXNoKGBEb21haW49JHtjb29raWUuZG9tYWlufWApO1xuICB9XG4gIGlmIChjb29raWUuc2FtZVNpdGUpIHtcbiAgICBvdXQucHVzaChgU2FtZVNpdGU9JHtjb29raWUuc2FtZVNpdGV9YCk7XG4gIH1cbiAgaWYgKGNvb2tpZS5wYXRoKSB7XG4gICAgdmFsaWRhdGVQYXRoKGNvb2tpZS5wYXRoKTtcbiAgICBvdXQucHVzaChgUGF0aD0ke2Nvb2tpZS5wYXRofWApO1xuICB9XG4gIGlmIChjb29raWUuZXhwaXJlcykge1xuICAgIGNvbnN0IGRhdGVTdHJpbmcgPSB0b0lNRihjb29raWUuZXhwaXJlcyk7XG4gICAgb3V0LnB1c2goYEV4cGlyZXM9JHtkYXRlU3RyaW5nfWApO1xuICB9XG4gIGlmIChjb29raWUudW5wYXJzZWQpIHtcbiAgICBvdXQucHVzaChjb29raWUudW5wYXJzZWQuam9pbihcIjsgXCIpKTtcbiAgfVxuICByZXR1cm4gb3V0LmpvaW4oXCI7IFwiKTtcbn1cblxuLyoqXG4gKiBWYWxpZGF0ZSBDb29raWUgTmFtZS5cbiAqIEBwYXJhbSBuYW1lIENvb2tpZSBuYW1lLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZU5hbWUobmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCk6IHZvaWQge1xuICBpZiAobmFtZSAmJiAhRklFTERfQ09OVEVOVF9SRUdFWFAudGVzdChuYW1lKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEludmFsaWQgY29va2llIG5hbWU6IFwiJHtuYW1lfVwiLmApO1xuICB9XG59XG5cbi8qKlxuICogVmFsaWRhdGUgUGF0aCBWYWx1ZS5cbiAqIFNlZSB7QGxpbmsgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzYyNjUjc2VjdGlvbi00LjEuMi40fS5cbiAqIEBwYXJhbSBwYXRoIFBhdGggdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aChwYXRoOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gIGlmIChwYXRoID09IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYyA9IHBhdGguY2hhckF0KGkpO1xuICAgIGlmIChcbiAgICAgIGMgPCBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4MjApIHx8IGMgPiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4N0UpIHx8IGMgPT0gXCI7XCJcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgcGF0aCArIFwiOiBJbnZhbGlkIGNvb2tpZSBwYXRoIGNoYXIgJ1wiICsgYyArIFwiJ1wiLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBWYWxpZGF0ZSBDb29raWUgVmFsdWUuXG4gKiBTZWUge0BsaW5rIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM2MjY1I3NlY3Rpb24tNC4xfS5cbiAqIEBwYXJhbSB2YWx1ZSBDb29raWUgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlVmFsdWUobmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICBpZiAodmFsdWUgPT0gbnVsbCB8fCBuYW1lID09IG51bGwpIHJldHVybjtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGMgPSB2YWx1ZS5jaGFyQXQoaSk7XG4gICAgaWYgKFxuICAgICAgYyA8IFN0cmluZy5mcm9tQ2hhckNvZGUoMHgyMSkgfHwgYyA9PSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4MjIpIHx8XG4gICAgICBjID09IFN0cmluZy5mcm9tQ2hhckNvZGUoMHgyYykgfHwgYyA9PSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4M2IpIHx8XG4gICAgICBjID09IFN0cmluZy5mcm9tQ2hhckNvZGUoMHg1YykgfHwgYyA9PSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4N2YpXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiUkZDMjYxNiBjb29raWUgJ1wiICsgbmFtZSArIFwiJyBjYW5ub3QgaGF2ZSAnXCIgKyBjICsgXCInIGFzIHZhbHVlXCIsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAoYyA+IFN0cmluZy5mcm9tQ2hhckNvZGUoMHg4MCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJSRkMyNjE2IGNvb2tpZSAnXCIgKyBuYW1lICsgXCInIGNhbiBvbmx5IGhhdmUgVVMtQVNDSUkgY2hhcnMgYXMgdmFsdWVcIiArXG4gICAgICAgICAgYy5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KSxcbiAgICAgICk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogVmFsaWRhdGUgQ29va2llIERvbWFpbi5cbiAqIFNlZSB7QGxpbmsgaHR0cHM6Ly9kYXRhdHJhY2tlci5pZXRmLm9yZy9kb2MvaHRtbC9yZmM2MjY1I3NlY3Rpb24tNC4xLjIuM30uXG4gKiBAcGFyYW0gZG9tYWluIENvb2tpZSBkb21haW4uXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlRG9tYWluKGRvbWFpbjogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChkb21haW4gPT0gbnVsbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBjaGFyMSA9IGRvbWFpbi5jaGFyQXQoMCk7XG4gIGNvbnN0IGNoYXJOID0gZG9tYWluLmNoYXJBdChkb21haW4ubGVuZ3RoIC0gMSk7XG4gIGlmIChjaGFyMSA9PSBcIi1cIiB8fCBjaGFyTiA9PSBcIi5cIiB8fCBjaGFyTiA9PSBcIi1cIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiSW52YWxpZCBmaXJzdC9sYXN0IGNoYXIgaW4gY29va2llIGRvbWFpbjogXCIgKyBkb21haW4sXG4gICAgKTtcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlIGNvb2tpZXMgb2YgYSBoZWFkZXJcbiAqIEBwYXJhbSB7SGVhZGVyc30gaGVhZGVycyBUaGUgaGVhZGVycyBpbnN0YW5jZSB0byBnZXQgY29va2llcyBmcm9tXG4gKiBAcmV0dXJuIHtPYmplY3R9IE9iamVjdCB3aXRoIGNvb2tpZSBuYW1lcyBhcyBrZXlzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb29raWVzKGhlYWRlcnM6IEhlYWRlcnMpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgY29uc3QgY29va2llID0gaGVhZGVycy5nZXQoXCJDb29raWVcIik7XG4gIGlmIChjb29raWUgIT0gbnVsbCkge1xuICAgIGNvbnN0IG91dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGNvbnN0IGMgPSBjb29raWUuc3BsaXQoXCI7XCIpO1xuICAgIGZvciAoY29uc3Qga3Ygb2YgYykge1xuICAgICAgY29uc3QgW2Nvb2tpZUtleSwgLi4uY29va2llVmFsXSA9IGt2LnNwbGl0KFwiPVwiKTtcbiAgICAgIGFzc2VydChjb29raWVLZXkgIT0gbnVsbCk7XG4gICAgICBjb25zdCBrZXkgPSBjb29raWVLZXkudHJpbSgpO1xuICAgICAgb3V0W2tleV0gPSBjb29raWVWYWwuam9pbihcIj1cIik7XG4gICAgfVxuICAgIHJldHVybiBvdXQ7XG4gIH1cbiAgcmV0dXJuIHt9O1xufVxuXG4vKipcbiAqIFNldCB0aGUgY29va2llIGhlYWRlciBwcm9wZXJseSBpbiB0aGUgaGVhZGVyc1xuICogQHBhcmFtIHtIZWFkZXJzfSBoZWFkZXJzIFRoZSBoZWFkZXJzIGluc3RhbmNlIHRvIHNldCB0aGUgY29va2llIHRvXG4gKiBAcGFyYW0ge09iamVjdH0gY29va2llIENvb2tpZSB0byBzZXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldENvb2tpZShoZWFkZXJzOiBIZWFkZXJzLCBjb29raWU6IENvb2tpZSk6IHZvaWQge1xuICAvLyBUT0RPKHpla3RoKSA6IEFkZCBwcm9wZXIgcGFyc2luZyBvZiBTZXQtQ29va2llIGhlYWRlcnNcbiAgLy8gUGFyc2luZyBjb29raWUgaGVhZGVycyB0byBtYWtlIGNvbnNpc3RlbnQgc2V0LWNvb2tpZSBoZWFkZXJcbiAgLy8gcmVmOiBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjNjI2NSNzZWN0aW9uLTQuMS4xXG4gIGNvbnN0IHYgPSB0b1N0cmluZyhjb29raWUpO1xuICBpZiAodikge1xuICAgIGhlYWRlcnMuYXBwZW5kKFwiU2V0LUNvb2tpZVwiLCB2KTtcbiAgfVxufVxuXG4vKipcbiAqIFNldCB0aGUgY29va2llIGhlYWRlciB3aXRoIGVtcHR5IHZhbHVlIGluIHRoZSBoZWFkZXJzIHRvIGRlbGV0ZSBpdFxuICogQHBhcmFtIHtIZWFkZXJzfSBoZWFkZXJzIFRoZSBoZWFkZXJzIGluc3RhbmNlIHRvIGRlbGV0ZSB0aGUgY29va2llIGZyb21cbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIE5hbWUgb2YgY29va2llXG4gKiBAcGFyYW0ge09iamVjdH0gYXR0cmlidXRlcyBBZGRpdGlvbmFsIGNvb2tpZSBhdHRyaWJ1dGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWxldGVDb29raWUoXG4gIGhlYWRlcnM6IEhlYWRlcnMsXG4gIG5hbWU6IHN0cmluZyxcbiAgYXR0cmlidXRlcz86IHsgcGF0aD86IHN0cmluZzsgZG9tYWluPzogc3RyaW5nIH0sXG4pOiB2b2lkIHtcbiAgc2V0Q29va2llKGhlYWRlcnMsIHtcbiAgICBuYW1lOiBuYW1lLFxuICAgIHZhbHVlOiBcIlwiLFxuICAgIGV4cGlyZXM6IG5ldyBEYXRlKDApLFxuICAgIC4uLmF0dHJpYnV0ZXMsXG4gIH0pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSx5Q0FBeUM7QUFDekMsa0VBQWtFO0FBQ2xFLHFDQUFxQztBQUVyQyxTQUFTLE1BQU0sUUFBUSxxQkFBcUI7QUFDNUMsU0FBUyxLQUFLLFFBQVEscUJBQXFCO0FBNEIzQyxNQUFNLHVCQUF1QjtBQUU3QixTQUFTLFNBQVMsTUFBYyxFQUFVO0lBQ3hDLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRTtRQUNoQixPQUFPO0lBQ1QsQ0FBQztJQUNELE1BQU0sTUFBZ0IsRUFBRTtJQUN4QixhQUFhLE9BQU8sSUFBSTtJQUN4QixjQUFjLE9BQU8sSUFBSSxFQUFFLE9BQU8sS0FBSztJQUN2QyxJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUUsT0FBTyxJQUFJLENBQUMsQ0FBQyxFQUFFLE9BQU8sS0FBSyxDQUFDLENBQUM7SUFFekMsa0NBQWtDO0lBQ2xDLHFGQUFxRjtJQUNyRixJQUFJLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhO1FBQ3RDLE9BQU8sTUFBTSxHQUFHLElBQUk7SUFDdEIsQ0FBQztJQUNELElBQUksT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVc7UUFDcEMsT0FBTyxJQUFJLEdB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