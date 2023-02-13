// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/** Returns true if the etags match. Weak etag comparisons are handled. */ export function compareEtag(a, b) {
    if (a === b) {
        return true;
    }
    if (a.startsWith("W/") && !b.startsWith("W/")) {
        return a.slice(2) === b;
    }
    if (!a.startsWith("W/") && b.startsWith("W/")) {
        return a === b.slice(2);
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MS4wL2h0dHAvdXRpbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLyoqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZXRhZ3MgbWF0Y2guIFdlYWsgZXRhZyBjb21wYXJpc29ucyBhcmUgaGFuZGxlZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wYXJlRXRhZyhhOiBzdHJpbmcsIGI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAoYSA9PT0gYikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChhLnN0YXJ0c1dpdGgoXCJXL1wiKSAmJiAhYi5zdGFydHNXaXRoKFwiVy9cIikpIHtcbiAgICByZXR1cm4gYS5zbGljZSgyKSA9PT0gYjtcbiAgfVxuICBpZiAoIWEuc3RhcnRzV2l0aChcIlcvXCIpICYmIGIuc3RhcnRzV2l0aChcIlcvXCIpKSB7XG4gICAgcmV0dXJuIGEgPT09IGIuc2xpY2UoMik7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSx3RUFBd0UsR0FDeEUsT0FBTyxTQUFTLFlBQVksQ0FBUyxFQUFFLENBQVMsRUFBVztJQUN6RCxJQUFJLE1BQU0sR0FBRztRQUNYLE9BQU8sSUFBSTtJQUNiLENBQUM7SUFDRCxJQUFJLEVBQUUsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxPQUFPO1FBQzdDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTztJQUN4QixDQUFDO0lBQ0QsSUFBSSxDQUFDLEVBQUUsVUFBVSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsT0FBTztRQUM3QyxPQUFPLE1BQU0sRUFBRSxLQUFLLENBQUM7SUFDdkIsQ0FBQztJQUNELE9BQU8sS0FBSztBQUNkLENBQUMifQ==