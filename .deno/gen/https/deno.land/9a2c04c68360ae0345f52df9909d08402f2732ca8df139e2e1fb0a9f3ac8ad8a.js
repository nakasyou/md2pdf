#!/usr/bin/env -S deno run --allow-net --allow-read
// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This program serves files in the current directory over HTTP.
// TODO(bartlomieju): Add tests like these:
// https://github.com/indexzero/http-server/blob/master/test/http-server-test.js
import { extname, posix } from "../path/mod.ts";
import { encode } from "../encoding/hex.ts";
import { serve, serveTls } from "./server.ts";
import { Status, STATUS_TEXT } from "./http_status.ts";
import { parse } from "../flags/mod.ts";
import { assert } from "../_util/assert.ts";
import { red } from "../fmt/colors.ts";
import { compareEtag } from "./util.ts";
const DEFAULT_CHUNK_SIZE = 16_640;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MEDIA_TYPES = {
    ".md": "text/markdown",
    ".html": "text/html",
    ".htm": "text/html",
    ".json": "application/json",
    ".map": "application/json",
    ".txt": "text/plain",
    ".ts": "text/typescript",
    ".tsx": "text/tsx",
    ".js": "application/javascript",
    ".jsx": "text/jsx",
    ".gz": "application/gzip",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".mjs": "application/javascript",
    ".otf": "font/otf",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".conf": "text/plain",
    ".list": "text/plain",
    ".log": "text/plain",
    ".ini": "text/plain",
    ".vtt": "text/vtt",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".mp3": "audio/mp3",
    ".mp4a": "audio/mp4",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".spx": "audio/ogg",
    ".opus": "audio/ogg",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".aac": "audio/x-aac",
    ".flac": "audio/x-flac",
    ".mp4": "video/mp4",
    ".mp4v": "video/mp4",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".tiff": "image/tiff",
    ".psd": "image/vnd.adobe.photoshop",
    ".ico": "image/vnd.microsoft.icon",
    ".webp": "image/webp",
    ".es": "application/ecmascript",
    ".epub": "application/epub+zip",
    ".jar": "application/java-archive",
    ".war": "application/java-archive",
    ".webmanifest": "application/manifest+json",
    ".doc": "application/msword",
    ".dot": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
    ".cjs": "application/node",
    ".bin": "application/octet-stream",
    ".pkg": "application/octet-stream",
    ".dump": "application/octet-stream",
    ".exe": "application/octet-stream",
    ".deploy": "application/octet-stream",
    ".img": "application/octet-stream",
    ".msi": "application/octet-stream",
    ".pdf": "application/pdf",
    ".pgp": "application/pgp-encrypted",
    ".asc": "application/pgp-signature",
    ".sig": "application/pgp-signature",
    ".ai": "application/postscript",
    ".eps": "application/postscript",
    ".ps": "application/postscript",
    ".rdf": "application/rdf+xml",
    ".rss": "application/rss+xml",
    ".rtf": "application/rtf",
    ".apk": "application/vnd.android.package-archive",
    ".key": "application/vnd.apple.keynote",
    ".numbers": "application/vnd.apple.keynote",
    ".pages": "application/vnd.apple.pages",
    ".geo": "application/vnd.dynageo",
    ".gdoc": "application/vnd.google-apps.document",
    ".gslides": "application/vnd.google-apps.presentation",
    ".gsheet": "application/vnd.google-apps.spreadsheet",
    ".kml": "application/vnd.google-earth.kml+xml",
    ".mkz": "application/vnd.google-earth.kmz",
    ".icc": "application/vnd.iccprofile",
    ".icm": "application/vnd.iccprofile",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlm": "application/vnd.ms-excel",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pot": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".potx": "application/vnd.openxmlformats-officedocument.presentationml.template",
    ".xps": "application/vnd.ms-xpsdocument",
    ".odc": "application/vnd.oasis.opendocument.chart",
    ".odb": "application/vnd.oasis.opendocument.database",
    ".odf": "application/vnd.oasis.opendocument.formula",
    ".odg": "application/vnd.oasis.opendocument.graphics",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".rar": "application/vnd.rar",
    ".unityweb": "application/vnd.unity",
    ".dmg": "application/x-apple-diskimage",
    ".bz": "application/x-bzip",
    ".crx": "application/x-chrome-extension",
    ".deb": "application/x-debian-package",
    ".php": "application/x-httpd-php",
    ".iso": "application/x-iso9660-image",
    ".sh": "application/x-sh",
    ".sql": "application/x-sql",
    ".srt": "application/x-subrip",
    ".xml": "application/xml",
    ".zip": "application/zip"
};
/** Returns the content-type based on the extension of a path. */ function contentType(path) {
    return MEDIA_TYPES[extname(path)];
}
// The fnv-1a hash function.
function fnv1a(buf) {
    let hash = 2166136261; // 32-bit FNV offset basis
    for(let i = 0; i < buf.length; i++){
        hash ^= buf.charCodeAt(i);
        // Equivalent to `hash *= 16777619` without using BigInt
        // 32-bit FNV prime
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    // 32-bit hex string
    return (hash >>> 0).toString(16);
}
// Generates a hash for the provided string
async function createEtagHash(message, algorithm = "fnv1a") {
    if (algorithm === "fnv1a") {
        return fnv1a(message);
    }
    const msgUint8 = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest(algorithm, msgUint8);
    return decoder.decode(encode(new Uint8Array(hashBuffer)));
}
function modeToString(isDir, maybeMode) {
    const modeMap = [
        "---",
        "--x",
        "-w-",
        "-wx",
        "r--",
        "r-x",
        "rw-",
        "rwx"
    ];
    if (maybeMode === null) {
        return "(unknown mode)";
    }
    const mode = maybeMode.toString(8);
    if (mode.length < 3) {
        return "(unknown mode)";
    }
    let output = "";
    mode.split("").reverse().slice(0, 3).forEach((v)=>{
        output = `${modeMap[+v]} ${output}`;
    });
    output = `${isDir ? "d" : "-"} ${output}`;
    return output;
}
function fileLenToString(len) {
    const multiplier = 1024;
    let base = 1;
    const suffix = [
        "B",
        "K",
        "M",
        "G",
        "T"
    ];
    let suffixIndex = 0;
    while(base * multiplier < len){
        if (suffixIndex >= suffix.length - 1) {
            break;
        }
        base *= multiplier;
        suffixIndex++;
    }
    return `${(len / base).toFixed(2)}${suffix[suffixIndex]}`;
}
/**
 * Returns an HTTP Response with the requested file as the body.
 * @param req The server request context used to cleanup the file handle.
 * @param filePath Path of the file to serve.
 * @param etagAlgorithm The algorithm to use for generating the ETag. Defaults to "fnv1a".
 * @param fileInfo An optional FileInfo object returned by Deno.stat. It is used
 * for optimization purposes.
 */ export async function serveFile(req, filePath, { etagAlgorithm , fileInfo  } = {}) {
    let file;
    if (fileInfo === undefined) {
        [file, fileInfo] = await Promise.all([
            Deno.open(filePath),
            Deno.stat(filePath)
        ]);
    } else {
        file = await Deno.open(filePath);
    }
    const headers = setBaseHeaders();
    // Set mime-type using the file extension in filePath
    const contentTypeValue = contentType(filePath);
    if (contentTypeValue) {
        headers.set("content-type", contentTypeValue);
    }
    // Set date header if access timestamp is available
    if (fileInfo.atime instanceof Date) {
        const date = new Date(fileInfo.atime);
        headers.set("date", date.toUTCString());
    }
    // Set last modified header if access timestamp is available
    if (fileInfo.mtime instanceof Date) {
        const lastModified = new Date(fileInfo.mtime);
        headers.set("last-modified", lastModified.toUTCString());
        // Create a simple etag that is an md5 of the last modified date and filesize concatenated
        const simpleEtag = await createEtagHash(`${lastModified.toJSON()}${fileInfo.size}`, etagAlgorithm || "fnv1a");
        headers.set("etag", simpleEtag);
        // If a `if-none-match` header is present and the value matches the tag or
        // if a `if-modified-since` header is present and the value is bigger than
        // the access timestamp value, then return 304
        const ifNoneMatch = req.headers.get("if-none-match");
        const ifModifiedSince = req.headers.get("if-modified-since");
        if (ifNoneMatch && compareEtag(ifNoneMatch, simpleEtag) || ifNoneMatch === null && ifModifiedSince && fileInfo.mtime.getTime() < new Date(ifModifiedSince).getTime() + 1000) {
            const status = Status.NotModified;
            const statusText = STATUS_TEXT.get(status);
            file.close();
            return new Response(null, {
                status,
                statusText,
                headers
            });
        }
    }
    // Get and parse the "range" header
    const range = req.headers.get("range");
    const rangeRe = /bytes=(\d+)-(\d+)?/;
    const parsed = rangeRe.exec(range);
    // Use the parsed value if available, fallback to the start and end of the entire file
    const start = parsed && parsed[1] ? +parsed[1] : 0;
    const end = parsed && parsed[2] ? +parsed[2] : fileInfo.size - 1;
    // If there is a range, set the status to 206, and set the "Content-range" header.
    if (range && parsed) {
        headers.set("content-range", `bytes ${start}-${end}/${fileInfo.size}`);
    }
    // Return 416 if `start` isn't less than or equal to `end`, or `start` or `end` are greater than the file's size
    const maxRange = fileInfo.size - 1;
    if (range && (!parsed || typeof start !== "number" || start > end || start > maxRange || end > maxRange)) {
        const status1 = Status.RequestedRangeNotSatisfiable;
        const statusText1 = STATUS_TEXT.get(status1);
        file.close();
        return new Response(statusText1, {
            status: status1,
            statusText: statusText1,
            headers
        });
    }
    // Set content length
    const contentLength = end - start + 1;
    headers.set("content-length", `${contentLength}`);
    if (range && parsed) {
        // Create a stream of the file instead of loading it into memory
        let bytesSent = 0;
        const body = new ReadableStream({
            async start () {
                if (start > 0) {
                    await file.seek(start, Deno.SeekMode.Start);
                }
            },
            async pull (controller) {
                const bytes = new Uint8Array(DEFAULT_CHUNK_SIZE);
                const bytesRead = await file.read(bytes);
                if (bytesRead === null) {
                    file.close();
                    controller.close();
                    return;
                }
                controller.enqueue(bytes.slice(0, Math.min(bytesRead, contentLength - bytesSent)));
                bytesSent += bytesRead;
                if (bytesSent > contentLength) {
                    file.close();
                    controller.close();
                }
            }
        });
        return new Response(body, {
            status: 206,
            statusText: "Partial Content",
            headers
        });
    }
    return new Response(file.readable, {
        status: 200,
        statusText: "OK",
        headers
    });
}
// TODO(bartlomieju): simplify this after deno.stat and deno.readDir are fixed
async function serveDirIndex(req, dirPath, options) {
    const showDotfiles = options.dotfiles;
    const dirUrl = `/${posix.relative(options.target, dirPath)}`;
    const listEntry = [];
    // if ".." makes sense
    if (dirUrl !== "/") {
        const prevPath = posix.join(dirPath, "..");
        const fileInfo = await Deno.stat(prevPath);
        listEntry.push({
            mode: modeToString(true, fileInfo.mode),
            size: "",
            name: "../",
            url: posix.join(dirUrl, "..")
        });
    }
    for await (const entry of Deno.readDir(dirPath)){
        if (!showDotfiles && entry.name[0] === ".") {
            continue;
        }
        const filePath = posix.join(dirPath, entry.name);
        const fileUrl = encodeURI(posix.join(dirUrl, entry.name));
        const fileInfo1 = await Deno.stat(filePath);
        if (entry.name === "index.html" && entry.isFile) {
            // in case index.html as dir...
            return serveFile(req, filePath, {
                etagAlgorithm: options.etagAlgorithm,
                fileInfo: fileInfo1
            });
        }
        listEntry.push({
            mode: modeToString(entry.isDirectory, fileInfo1.mode),
            size: entry.isFile ? fileLenToString(fileInfo1.size ?? 0) : "",
            name: `${entry.name}${entry.isDirectory ? "/" : ""}`,
            url: `${fileUrl}${entry.isDirectory ? "/" : ""}`
        });
    }
    listEntry.sort((a, b)=>a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
    const formattedDirUrl = `${dirUrl.replace(/\/$/, "")}/`;
    const page = encoder.encode(dirViewerTemplate(formattedDirUrl, listEntry));
    const headers = setBaseHeaders();
    headers.set("content-type", "text/html");
    return new Response(page, {
        status: Status.OK,
        headers
    });
}
function serveFallback(_req, e) {
    if (e instanceof URIError) {
        return Promise.resolve(new Response(STATUS_TEXT.get(Status.BadRequest), {
            status: Status.BadRequest
        }));
    } else if (e instanceof Deno.errors.NotFound) {
        return Promise.resolve(new Response(STATUS_TEXT.get(Status.NotFound), {
            status: Status.NotFound
        }));
    }
    return Promise.resolve(new Response(STATUS_TEXT.get(Status.InternalServerError), {
        status: Status.InternalServerError
    }));
}
function serverLog(req, status) {
    const d = new Date().toISOString();
    const dateFmt = `[${d.slice(0, 10)} ${d.slice(11, 19)}]`;
    const normalizedUrl = normalizeURL(req.url);
    const s = `${dateFmt} [${req.method}] ${normalizedUrl} ${status}`;
    // using console.debug instead of console.log so chrome inspect users can hide request logs
    console.debug(s);
}
function setBaseHeaders() {
    const headers = new Headers();
    headers.set("server", "deno");
    // Set "accept-ranges" so that the client knows it can make range requests on future requests
    headers.set("accept-ranges", "bytes");
    headers.set("date", new Date().toUTCString());
    return headers;
}
function dirViewerTemplate(dirname, entries) {
    const paths = dirname.split("/");
    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <title>Deno File Server</title>
        <style>
          :root {
            --background-color: #fafafa;
            --color: rgba(0, 0, 0, 0.87);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --background-color: #292929;
              --color: #fff;
            }
            thead {
              color: #7f7f7f;
            }
          }
          @media (min-width: 960px) {
            main {
              max-width: 960px;
            }
            body {
              padding-left: 32px;
              padding-right: 32px;
            }
          }
          @media (min-width: 600px) {
            main {
              padding-left: 24px;
              padding-right: 24px;
            }
          }
          body {
            background: var(--background-color);
            color: var(--color);
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            font-weight: 400;
            line-height: 1.43;
            font-size: 0.875rem;
          }
          a {
            color: #2196f3;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          thead {
            text-align: left;
          }
          thead th {
            padding-bottom: 12px;
          }
          table td {
            padding: 6px 36px 6px 0px;
          }
          .size {
            text-align: right;
            padding: 6px 12px 6px 24px;
          }
          .mode {
            font-family: monospace, monospace;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Index of
          <a href="/">home</a>${paths.map((path, index, array)=>{
        if (path === "") return "";
        const link = array.slice(0, index + 1).join("/");
        return `<a href="${link}">${path}</a>`;
    }).join("/")}
          </h1>
          <table>
            <thead>
              <tr>
                <th>Mode</th>
                <th>Size</th>
                <th>Name</th>
              </tr>
            </thead>
            ${entries.map((entry)=>`
                  <tr>
                    <td class="mode">
                      ${entry.mode}
                    </td>
                    <td class="size">
                      ${entry.size}
                    </td>
                    <td>
                      <a href="${entry.url}">${entry.name}</a>
                    </td>
                  </tr>
                `).join("")}
          </table>
        </main>
      </body>
    </html>
  `;
}
/**
 * Serves the files under the given directory root (opts.fsRoot).
 *
 * ```ts
 * import { serve } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 * import { serveDir } from "https://deno.land/std@$STD_VERSION/http/file_server.ts";
 *
 * serve((req) => {
 *   const pathname = new URL(req.url).pathname;
 *   if (pathname.startsWith("/static")) {
 *     return serveDir(req, {
 *       fsRoot: "path/to/static/files/dir",
 *     });
 *   }
 *   // Do dynamic responses
 *   return new Response();
 * });
 * ```
 *
 * Optionally you can pass `urlRoot` option. If it's specified that part is stripped from the beginning of the requested pathname.
 *
 * ```ts
 * import { serveDir } from "https://deno.land/std@$STD_VERSION/http/file_server.ts";
 *
 * // ...
 * serveDir(new Request("http://localhost/static/path/to/file"), {
 *   fsRoot: "public",
 *   urlRoot: "static",
 * });
 * ```
 *
 * The above example serves `./public/path/to/file` for the request to `/static/path/to/file`.
 *
 * @param request The request to handle
 * @param opts
 * @returns
 */ export async function serveDir(req, opts = {}) {
    let response;
    const target = opts.fsRoot || ".";
    const urlRoot = opts.urlRoot;
    try {
        let normalizedPath = normalizeURL(req.url);
        if (urlRoot) {
            if (normalizedPath.startsWith("/" + urlRoot)) {
                normalizedPath = normalizedPath.replace(urlRoot, "");
            } else {
                throw new Deno.errors.NotFound();
            }
        }
        const fsPath = posix.join(target, normalizedPath);
        const fileInfo = await Deno.stat(fsPath);
        if (fileInfo.isDirectory) {
            if (opts.showDirListing) {
                response = await serveDirIndex(req, fsPath, {
                    dotfiles: opts.showDotfiles || false,
                    target
                });
            } else {
                throw new Deno.errors.NotFound();
            }
        } else {
            response = await serveFile(req, fsPath, {
                etagAlgorithm: opts.etagAlgorithm,
                fileInfo
            });
        }
    } catch (e) {
        const err = e instanceof Error ? e : new Error("[non-error thrown]");
        console.error(red(err.message));
        response = await serveFallback(req, err);
    }
    if (opts.enableCors) {
        assert(response);
        response.headers.append("access-control-allow-origin", "*");
        response.headers.append("access-control-allow-headers", "Origin, X-Requested-With, Content-Type, Accept, Range");
    }
    if (!opts.quiet) serverLog(req, response.status);
    return response;
}
function normalizeURL(url) {
    let normalizedUrl = url;
    try {
        //allowed per https://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html
        const absoluteURI = new URL(normalizedUrl);
        normalizedUrl = absoluteURI.pathname;
    } catch (e) {
        //wasn't an absoluteURI
        if (!(e instanceof TypeError)) {
            throw e;
        }
    }
    try {
        normalizedUrl = decodeURI(normalizedUrl);
    } catch (e1) {
        if (!(e1 instanceof URIError)) {
            throw e1;
        }
    }
    if (normalizedUrl[0] !== "/") {
        throw new URIError("The request URI is malformed.");
    }
    normalizedUrl = posix.normalize(normalizedUrl);
    const startOfParams = normalizedUrl.indexOf("?");
    return startOfParams > -1 ? normalizedUrl.slice(0, startOfParams) : normalizedUrl;
}
function main() {
    const serverArgs = parse(Deno.args, {
        string: [
            "port",
            "host",
            "cert",
            "key"
        ],
        boolean: [
            "help",
            "dir-listing",
            "dotfiles",
            "cors",
            "verbose"
        ],
        default: {
            "dir-listing": true,
            dotfiles: true,
            cors: true,
            verbose: false,
            host: "0.0.0.0",
            port: "4507",
            cert: "",
            key: ""
        },
        alias: {
            p: "port",
            c: "cert",
            k: "key",
            h: "help",
            v: "verbose"
        }
    });
    const port = serverArgs.port;
    const host = serverArgs.host;
    const certFile = serverArgs.cert;
    const keyFile = serverArgs.key;
    if (serverArgs.help) {
        printUsage();
        Deno.exit();
    }
    if (keyFile || certFile) {
        if (keyFile === "" || certFile === "") {
            console.log("--key and --cert are required for TLS");
            printUsage();
            Deno.exit(1);
        }
    }
    const wild = serverArgs._;
    const target = posix.resolve(wild[0] ?? "");
    const handler = (req)=>{
        return serveDir(req, {
            fsRoot: target,
            showDirListing: serverArgs["dir-listing"],
            showDotfiles: serverArgs.dotfiles,
            enableCors: serverArgs.cors,
            quiet: !serverArgs.verbose
        });
    };
    const useTls = Boolean(keyFile || certFile);
    if (useTls) {
        serveTls(handler, {
            port: Number(port),
            hostname: host,
            certFile,
            keyFile
        });
    } else {
        serve(handler, {
            port: Number(port),
            hostname: host
        });
    }
}
function printUsage() {
    console.log(`Deno File Server
  Serves a local directory in HTTP.

INSTALL:
  deno install --allow-net --allow-read https://deno.land/std/http/file_server.ts

USAGE:
  file_server [path] [options]

OPTIONS:
  -h, --help          Prints help information
  -p, --port <PORT>   Set port
  --cors              Enable CORS via the "Access-Control-Allow-Origin" header
  --host     <HOST>   Hostname (default is 0.0.0.0)
  -c, --cert <FILE>   TLS certificate file (enables TLS)
  -k, --key  <FILE>   TLS key file (enables TLS)
  --no-dir-listing    Disable directory listing
  --no-dotfiles       Do not show dotfiles
  -v, --verbose       Print request level logs

  All TLS options are required when one is provided.`);
}
if (import.meta.main) {
    main();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MS4wL2h0dHAvZmlsZV9zZXJ2ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgLVMgZGVubyBydW4gLS1hbGxvdy1uZXQgLS1hbGxvdy1yZWFkXG4vLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vLyBUaGlzIHByb2dyYW0gc2VydmVzIGZpbGVzIGluIHRoZSBjdXJyZW50IGRpcmVjdG9yeSBvdmVyIEhUVFAuXG4vLyBUT0RPKGJhcnRsb21pZWp1KTogQWRkIHRlc3RzIGxpa2UgdGhlc2U6XG4vLyBodHRwczovL2dpdGh1Yi5jb20vaW5kZXh6ZXJvL2h0dHAtc2VydmVyL2Jsb2IvbWFzdGVyL3Rlc3QvaHR0cC1zZXJ2ZXItdGVzdC5qc1xuXG5pbXBvcnQgeyBleHRuYW1lLCBwb3NpeCB9IGZyb20gXCIuLi9wYXRoL21vZC50c1wiO1xuaW1wb3J0IHsgZW5jb2RlIH0gZnJvbSBcIi4uL2VuY29kaW5nL2hleC50c1wiO1xuaW1wb3J0IHsgc2VydmUsIHNlcnZlVGxzIH0gZnJvbSBcIi4vc2VydmVyLnRzXCI7XG5pbXBvcnQgeyBTdGF0dXMsIFNUQVRVU19URVhUIH0gZnJvbSBcIi4vaHR0cF9zdGF0dXMudHNcIjtcbmltcG9ydCB7IHBhcnNlIH0gZnJvbSBcIi4uL2ZsYWdzL21vZC50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcIi4uL191dGlsL2Fzc2VydC50c1wiO1xuaW1wb3J0IHsgcmVkIH0gZnJvbSBcIi4uL2ZtdC9jb2xvcnMudHNcIjtcbmltcG9ydCB7IGNvbXBhcmVFdGFnIH0gZnJvbSBcIi4vdXRpbC50c1wiO1xuXG5jb25zdCBERUZBVUxUX0NIVU5LX1NJWkUgPSAxNl82NDA7XG5cbmludGVyZmFjZSBFbnRyeUluZm8ge1xuICBtb2RlOiBzdHJpbmc7XG4gIHNpemU6IHN0cmluZztcbiAgdXJsOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEZpbGVTZXJ2ZXJBcmdzIHtcbiAgXzogc3RyaW5nW107XG4gIC8vIC1wIC0tcG9ydFxuICBwb3J0OiBzdHJpbmc7XG4gIC8vIC0tY29yc1xuICBjb3JzOiBib29sZWFuO1xuICAvLyAtLW5vLWRpci1saXN0aW5nXG4gIFwiZGlyLWxpc3RpbmdcIjogYm9vbGVhbjtcbiAgZG90ZmlsZXM6IGJvb2xlYW47XG4gIC8vIC0taG9zdFxuICBob3N0OiBzdHJpbmc7XG4gIC8vIC1jIC0tY2VydFxuICBjZXJ0OiBzdHJpbmc7XG4gIC8vIC1rIC0ta2V5XG4gIGtleTogc3RyaW5nO1xuICAvLyAtaCAtLWhlbHBcbiAgaGVscDogYm9vbGVhbjtcbiAgLy8gLS1xdWlldFxuICBxdWlldDogYm9vbGVhbjtcbn1cblxuY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuY29uc3QgZGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuXG5jb25zdCBNRURJQV9UWVBFUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCIubWRcIjogXCJ0ZXh0L21hcmtkb3duXCIsXG4gIFwiLmh0bWxcIjogXCJ0ZXh0L2h0bWxcIixcbiAgXCIuaHRtXCI6IFwidGV4dC9odG1sXCIsXG4gIFwiLmpzb25cIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gIFwiLm1hcFwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgXCIudHh0XCI6IFwidGV4dC9wbGFpblwiLFxuICBcIi50c1wiOiBcInRleHQvdHlwZXNjcmlwdFwiLFxuICBcIi50c3hcIjogXCJ0ZXh0L3RzeFwiLFxuICBcIi5qc1wiOiBcImFwcGxpY2F0aW9uL2phdmFzY3JpcHRcIixcbiAgXCIuanN4XCI6IFwidGV4dC9qc3hcIixcbiAgXCIuZ3pcIjogXCJhcHBsaWNhdGlvbi9nemlwXCIsXG4gIFwiLmNzc1wiOiBcInRleHQvY3NzXCIsXG4gIFwiLndhc21cIjogXCJhcHBsaWNhdGlvbi93YXNtXCIsXG4gIFwiLm1qc1wiOiBcImFwcGxpY2F0aW9uL2phdmFzY3JpcHRcIixcbiAgXCIub3RmXCI6IFwiZm9udC9vdGZcIixcbiAgXCIudHRmXCI6IFwiZm9udC90dGZcIixcbiAgXCIud29mZlwiOiBcImZvbnQvd29mZlwiLFxuICBcIi53b2ZmMlwiOiBcImZvbnQvd29mZjJcIixcbiAgXCIuY29uZlwiOiBcInRleHQvcGxhaW5cIixcbiAgXCIubGlzdFwiOiBcInRleHQvcGxhaW5cIixcbiAgXCIubG9nXCI6IFwidGV4dC9wbGFpblwiLFxuICBcIi5pbmlcIjogXCJ0ZXh0L3BsYWluXCIsXG4gIFwiLnZ0dFwiOiBcInRleHQvdnR0XCIsXG4gIFwiLnlhbWxcIjogXCJ0ZXh0L3lhbWxcIixcbiAgXCIueW1sXCI6IFwidGV4dC95YW1sXCIsXG4gIFwiLm1pZFwiOiBcImF1ZGlvL21pZGlcIixcbiAgXCIubWlkaVwiOiBcImF1ZGlvL21pZGlcIixcbiAgXCIubXAzXCI6IFwiYXVkaW8vbXAzXCIsXG4gIFwiLm1wNGFcIjogXCJhdWRpby9tcDRcIixcbiAgXCIubTRhXCI6IFwiYXVkaW8vbXA0XCIsXG4gIFwiLm9nZ1wiOiBcImF1ZGlvL29nZ1wiLFxuICBcIi5zcHhcIjogXCJhdWRpby9vZ2dcIixcbiAgXCIub3B1c1wiOiBcImF1ZGlvL29nZ1wiLFxuICBcIi53YXZcIjogXCJhdWRpby93YXZcIixcbiAgXCIud2VibVwiOiBcImF1ZGlvL3dlYm1cIixcbiAgXCIuYWFjXCI6IFwiYXVkaW8veC1hYWNcIixcbiAgXCIuZmxhY1wiOiBcImF1ZGlvL3gtZmxhY1wiLFxuICBcIi5tcDRcIjogXCJ2aWRlby9tcDRcIixcbiAgXCIubXA0dlwiOiBcInZpZGVvL21wNFwiLFxuICBcIi5ta3ZcIjogXCJ2aWRlby94LW1hdHJvc2thXCIsXG4gIFwiLm1vdlwiOiBcInZpZGVvL3F1aWNrdGltZVwiLFxuICBcIi5zdmdcIjogXCJpbWFnZS9zdmcreG1sXCIsXG4gIFwiLmF2aWZcIjogXCJpbWFnZS9hdmlmXCIsXG4gIFwiLmJtcFwiOiBcImltYWdlL2JtcFwiLFxuICBcIi5naWZcIjogXCJpbWFnZS9naWZcIixcbiAgXCIuaGVpY1wiOiBcImltYWdlL2hlaWNcIixcbiAgXCIuaGVpZlwiOiBcImltYWdlL2hlaWZcIixcbiAgXCIuanBlZ1wiOiBcImltYWdlL2pwZWdcIixcbiAgXCIuanBnXCI6IFwiaW1hZ2UvanBlZ1wiLFxuICBcIi5wbmdcIjogXCJpbWFnZS9wbmdcIixcbiAgXCIudGlmZlwiOiBcImltYWdlL3RpZmZcIixcbiAgXCIucHNkXCI6IFwiaW1hZ2Uvdm5kLmFkb2JlLnBob3Rvc2hvcFwiLFxuICBcIi5pY29cIjogXCJpbWFnZS92bmQubWljcm9zb2Z0Lmljb25cIixcbiAgXCIud2VicFwiOiBcImltYWdlL3dlYnBcIixcbiAgXCIuZXNcIjogXCJhcHBsaWNhdGlvbi9lY21hc2NyaXB0XCIsXG4gIFwiLmVwdWJcIjogXCJhcHBsaWNhdGlvbi9lcHViK3ppcFwiLFxuICBcIi5qYXJcIjogXCJhcHBsaWNhdGlvbi9qYXZhLWFyY2hpdmVcIixcbiAgXCIud2FyXCI6IFwiYXBwbGljYXRpb24vamF2YS1hcmNoaXZlXCIsXG4gIFwiLndlYm1hbmlmZXN0XCI6IFwiYXBwbGljYXRpb24vbWFuaWZlc3QranNvblwiLFxuICBcIi5kb2NcIjogXCJhcHBsaWNhdGlvbi9tc3dvcmRcIixcbiAgXCIuZG90XCI6IFwiYXBwbGljYXRpb24vbXN3b3JkXCIsXG4gIFwiLmRvY3hcIjpcbiAgICBcImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50XCIsXG4gIFwiLmRvdHhcIjpcbiAgICBcImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLnRlbXBsYXRlXCIsXG4gIFwiLmNqc1wiOiBcImFwcGxpY2F0aW9uL25vZGVcIixcbiAgXCIuYmluXCI6IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIsXG4gIFwiLnBrZ1wiOiBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLFxuICBcIi5kdW1wXCI6IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIsXG4gIFwiLmV4ZVwiOiBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLFxuICBcIi5kZXBsb3lcIjogXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIixcbiAgXCIuaW1nXCI6IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIsXG4gIFwiLm1zaVwiOiBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLFxuICBcIi5wZGZcIjogXCJhcHBsaWNhdGlvbi9wZGZcIixcbiAgXCIucGdwXCI6IFwiYXBwbGljYXRpb24vcGdwLWVuY3J5cHRlZFwiLFxuICBcIi5hc2NcIjogXCJhcHBsaWNhdGlvbi9wZ3Atc2lnbmF0dXJlXCIsXG4gIFwiLnNpZ1wiOiBcImFwcGxpY2F0aW9uL3BncC1zaWduYXR1cmVcIixcbiAgXCIuYWlcIjogXCJhcHBsaWNhdGlvbi9wb3N0c2NyaXB0XCIsXG4gIFwiLmVwc1wiOiBcImFwcGxpY2F0aW9uL3Bvc3RzY3JpcHRcIixcbiAgXCIucHNcIjogXCJhcHBsaWNhdGlvbi9wb3N0c2NyaXB0XCIsXG4gIFwiLnJkZlwiOiBcImFwcGxpY2F0aW9uL3JkZit4bWxcIixcbiAgXCIucnNzXCI6IFwiYXBwbGljYXRpb24vcnNzK3htbFwiLFxuICBcIi5ydGZcIjogXCJhcHBsaWNhdGlvbi9ydGZcIixcbiAgXCIuYXBrXCI6IFwiYXBwbGljYXRpb24vdm5kLmFuZHJvaWQucGFja2FnZS1hcmNoaXZlXCIsXG4gIFwiLmtleVwiOiBcImFwcGxpY2F0aW9uL3ZuZC5hcHBsZS5rZXlub3RlXCIsXG4gIFwiLm51bWJlcnNcIjogXCJhcHBsaWNhdGlvbi92bmQuYXBwbGUua2V5bm90ZVwiLFxuICBcIi5wYWdlc1wiOiBcImFwcGxpY2F0aW9uL3ZuZC5hcHBsZS5wYWdlc1wiLFxuICBcIi5nZW9cIjogXCJhcHBsaWNhdGlvbi92bmQuZHluYWdlb1wiLFxuICBcIi5nZG9jXCI6IFwiYXBwbGljYXRpb24vdm5kLmdvb2dsZS1hcHBzLmRvY3VtZW50XCIsXG4gIFwiLmdzbGlkZXNcIjogXCJhcHBsaWNhdGlvbi92bmQuZ29vZ2xlLWFwcHMucHJlc2VudGF0aW9uXCIsXG4gIFwiLmdzaGVldFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5zcHJlYWRzaGVldFwiLFxuICBcIi5rbWxcIjogXCJhcHBsaWNhdGlvbi92bmQuZ29vZ2xlLWVhcnRoLmttbCt4bWxcIixcbiAgXCIubWt6XCI6IFwiYXBwbGljYXRpb24vdm5kLmdvb2dsZS1lYXJ0aC5rbXpcIixcbiAgXCIuaWNjXCI6IFwiYXBwbGljYXRpb24vdm5kLmljY3Byb2ZpbGVcIixcbiAgXCIuaWNtXCI6IFwiYXBwbGljYXRpb24vdm5kLmljY3Byb2ZpbGVcIixcbiAgXCIueGxzXCI6IFwiYXBwbGljYXRpb24vdm5kLm1zLWV4Y2VsXCIsXG4gIFwiLnhsc3hcIjogXCJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldFwiLFxuICBcIi54bG1cIjogXCJhcHBsaWNhdGlvbi92bmQubXMtZXhjZWxcIixcbiAgXCIucHB0XCI6IFwiYXBwbGljYXRpb24vdm5kLm1zLXBvd2VycG9pbnRcIixcbiAgXCIucG90XCI6IFwiYXBwbGljYXRpb24vdm5kLm1zLXBvd2VycG9pbnRcIixcbiAgXCIucHB0eFwiOlxuICAgIFwiYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnByZXNlbnRhdGlvbm1sLnByZXNlbnRhdGlvblwiLFxuICBcIi5wb3R4XCI6XG4gICAgXCJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwudGVtcGxhdGVcIixcbiAgXCIueHBzXCI6IFwiYXBwbGljYXRpb24vdm5kLm1zLXhwc2RvY3VtZW50XCIsXG4gIFwiLm9kY1wiOiBcImFwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuY2hhcnRcIixcbiAgXCIub2RiXCI6IFwiYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5kYXRhYmFzZVwiLFxuICBcIi5vZGZcIjogXCJhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LmZvcm11bGFcIixcbiAgXCIub2RnXCI6IFwiYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5ncmFwaGljc1wiLFxuICBcIi5vZHBcIjogXCJhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnByZXNlbnRhdGlvblwiLFxuICBcIi5vZHNcIjogXCJhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnNwcmVhZHNoZWV0XCIsXG4gIFwiLm9kdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQudGV4dFwiLFxuICBcIi5yYXJcIjogXCJhcHBsaWNhdGlvbi92bmQucmFyXCIsXG4gIFwiLnVuaXR5d2ViXCI6IFwiYXBwbGljYXRpb24vdm5kLnVuaXR5XCIsXG4gIFwiLmRtZ1wiOiBcImFwcGxpY2F0aW9uL3gtYXBwbGUtZGlza2ltYWdlXCIsXG4gIFwiLmJ6XCI6IFwiYXBwbGljYXRpb24veC1iemlwXCIsXG4gIFwiLmNyeFwiOiBcImFwcGxpY2F0aW9uL3gtY2hyb21lLWV4dGVuc2lvblwiLFxuICBcIi5kZWJcIjogXCJhcHBsaWNhdGlvbi94LWRlYmlhbi1wYWNrYWdlXCIsXG4gIFwiLnBocFwiOiBcImFwcGxpY2F0aW9uL3gtaHR0cGQtcGhwXCIsXG4gIFwiLmlzb1wiOiBcImFwcGxpY2F0aW9uL3gtaXNvOTY2MC1pbWFnZVwiLFxuICBcIi5zaFwiOiBcImFwcGxpY2F0aW9uL3gtc2hcIixcbiAgXCIuc3FsXCI6IFwiYXBwbGljYXRpb24veC1zcWxcIixcbiAgXCIuc3J0XCI6IFwiYXBwbGljYXRpb24veC1zdWJyaXBcIixcbiAgXCIueG1sXCI6IFwiYXBwbGljYXRpb24veG1sXCIsXG4gIFwiLnppcFwiOiBcImFwcGxpY2F0aW9uL3ppcFwiLFxufTtcblxuLyoqIFJldHVybnMgdGhlIGNvbnRlbnQtdHlwZSBiYXNlZCBvbiB0aGUgZXh0ZW5zaW9uIG9mIGEgcGF0aC4gKi9cbmZ1bmN0aW9uIGNvbnRlbnRUeXBlKHBhdGg6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBNRURJQV9UWVBFU1tleHRuYW1lKHBhdGgpXTtcbn1cblxuLy8gVGhlIGZudi0xYSBoYXNoIGZ1bmN0aW9uLlxuZnVuY3Rpb24gZm52MWEoYnVmOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgaGFzaCA9IDIxNjYxMzYyNjE7IC8vIDMyLWJpdCBGTlYgb2Zmc2V0IGJhc2lzXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSsrKSB7XG4gICAgaGFzaCBePSBidWYuY2hhckNvZGVBdChpKTtcbiAgICAvLyBFcXVpdmFsZW50IHRvIGBoYXNoICo9IDE2Nzc3NjE5YCB3aXRob3V0IHVzaW5nIEJpZ0ludFxuICAgIC8vIDMyLWJpdCBGTlYgcHJpbWVcbiAgICBoYXNoICs9IChoYXNoIDw8IDEpICsgKGhhc2ggPDwgNCkgKyAoaGFzaCA8PCA3KSArIChoYXNoIDw8IDgpICtcbiAgICAgIChoYXNoIDw8IDI0KTtcbiAgfVxuICAvLyAzMi1iaXQgaGV4IHN0cmluZ1xuICByZXR1cm4gKGhhc2ggPj4+IDApLnRvU3RyaW5nKDE2KTtcbn1cblxudHlwZSBFdGFnQWxnb3JpdGhtID0gXCJmbnYxYVwiIHwgXCJzaGEtMVwiIHwgXCJzaGEtMjU2XCIgfCBcInNoYS0zODRcIiB8IFwic2hhLTUxMlwiO1xuXG4vLyBHZW5lcmF0ZXMgYSBoYXNoIGZvciB0aGUgcHJvdmlkZWQgc3RyaW5nXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVFdGFnSGFzaChcbiAgbWVzc2FnZTogc3RyaW5nLFxuICBhbGdvcml0aG06IEV0YWdBbGdvcml0aG0gPSBcImZudjFhXCIsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBpZiAoYWxnb3JpdGhtID09PSBcImZudjFhXCIpIHtcbiAgICByZXR1cm4gZm52MWEobWVzc2FnZSk7XG4gIH1cbiAgY29uc3QgbXNnVWludDggPSBlbmNvZGVyLmVuY29kZShtZXNzYWdlKTtcbiAgY29uc3QgaGFzaEJ1ZmZlciA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KGFsZ29yaXRobSwgbXNnVWludDgpO1xuICByZXR1cm4gZGVjb2Rlci5kZWNvZGUoZW5jb2RlKG5ldyBVaW50OEFycmF5KGhhc2hCdWZmZXIpKSk7XG59XG5cbmZ1bmN0aW9uIG1vZGVUb1N0cmluZyhpc0RpcjogYm9vbGVhbiwgbWF5YmVNb2RlOiBudW1iZXIgfCBudWxsKTogc3RyaW5nIHtcbiAgY29uc3QgbW9kZU1hcCA9IFtcIi0tLVwiLCBcIi0teFwiLCBcIi13LVwiLCBcIi13eFwiLCBcInItLVwiLCBcInIteFwiLCBcInJ3LVwiLCBcInJ3eFwiXTtcblxuICBpZiAobWF5YmVNb2RlID09PSBudWxsKSB7XG4gICAgcmV0dXJuIFwiKHVua25vd24gbW9kZSlcIjtcbiAgfVxuICBjb25zdCBtb2RlID0gbWF5YmVNb2RlLnRvU3RyaW5nKDgpO1xuICBpZiAobW9kZS5sZW5ndGggPCAzKSB7XG4gICAgcmV0dXJuIFwiKHVua25vd24gbW9kZSlcIjtcbiAgfVxuICBsZXQgb3V0cHV0ID0gXCJcIjtcbiAgbW9kZVxuICAgIC5zcGxpdChcIlwiKVxuICAgIC5yZXZlcnNlKClcbiAgICAuc2xpY2UoMCwgMylcbiAgICAuZm9yRWFjaCgodik6IHZvaWQgPT4ge1xuICAgICAgb3V0cHV0ID0gYCR7bW9kZU1hcFsrdl19ICR7b3V0cHV0fWA7XG4gICAgfSk7XG4gIG91dHB1dCA9IGAke2lzRGlyID8gXCJkXCIgOiBcIi1cIn0gJHtvdXRwdXR9YDtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZnVuY3Rpb24gZmlsZUxlblRvU3RyaW5nKGxlbjogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgbXVsdGlwbGllciA9IDEwMjQ7XG4gIGxldCBiYXNlID0gMTtcbiAgY29uc3Qgc3VmZml4ID0gW1wiQlwiLCBcIktcIiwgXCJNXCIsIFwiR1wiLCBcIlRcIl07XG4gIGxldCBzdWZmaXhJbmRleCA9IDA7XG5cbiAgd2hpbGUgKGJhc2UgKiBtdWx0aXBsaWVyIDwgbGVuKSB7XG4gICAgaWYgKHN1ZmZpeEluZGV4ID49IHN1ZmZpeC5sZW5ndGggLSAxKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgYmFzZSAqPSBtdWx0aXBsaWVyO1xuICAgIHN1ZmZpeEluZGV4Kys7XG4gIH1cblxuICByZXR1cm4gYCR7KGxlbiAvIGJhc2UpLnRvRml4ZWQoMil9JHtzdWZmaXhbc3VmZml4SW5kZXhdfWA7XG59XG5cbmludGVyZmFjZSBTZXJ2ZUZpbGVPcHRpb25zIHtcbiAgZXRhZ0FsZ29yaXRobT86IEV0YWdBbGdvcml0aG07XG4gIGZpbGVJbmZvPzogRGVuby5GaWxlSW5mbztcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGFuIEhUVFAgUmVzcG9uc2Ugd2l0aCB0aGUgcmVxdWVzdGVkIGZpbGUgYXMgdGhlIGJvZHkuXG4gKiBAcGFyYW0gcmVxIFRoZSBzZXJ2ZXIgcmVxdWVzdCBjb250ZXh0IHVzZWQgdG8gY2xlYW51cCB0aGUgZmlsZSBoYW5kbGUuXG4gKiBAcGFyYW0gZmlsZVBhdGggUGF0aCBvZiB0aGUgZmlsZSB0byBzZXJ2ZS5cbiAqIEBwYXJhbSBldGFnQWxnb3JpdGhtIFRoZSBhbGdvcml0aG0gdG8gdXNlIGZvciBnZW5lcmF0aW5nIHRoZSBFVGFnLiBEZWZhdWx0cyB0byBcImZudjFhXCIuXG4gKiBAcGFyYW0gZmlsZUluZm8gQW4gb3B0aW9uYWwgRmlsZUluZm8gb2JqZWN0IHJldHVybmVkIGJ5IERlbm8uc3RhdC4gSXQgaXMgdXNlZFxuICogZm9yIG9wdGltaXphdGlvbiBwdXJwb3Nlcy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlcnZlRmlsZShcbiAgcmVxOiBSZXF1ZXN0LFxuICBmaWxlUGF0aDogc3RyaW5nLFxuICB7IGV0YWdBbGdvcml0aG0sIGZpbGVJbmZvIH06IFNlcnZlRmlsZU9wdGlvbnMgPSB7fSxcbik6IFByb21pc2U8UmVzcG9uc2U+IHtcbiAgbGV0IGZpbGU6IERlbm8uRnNGaWxlO1xuICBpZiAoZmlsZUluZm8gPT09IHVuZGVmaW5lZCkge1xuICAgIFtmaWxlLCBmaWxlSW5mb10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBEZW5vLm9wZW4oZmlsZVBhdGgpLFxuICAgICAgRGVuby5zdGF0KGZpbGVQYXRoKSxcbiAgICBdKTtcbiAgfSBlbHNlIHtcbiAgICBmaWxlID0gYXdhaXQgRGVuby5vcGVuKGZpbGVQYXRoKTtcbiAgfVxuICBjb25zdCBoZWFkZXJzID0gc2V0QmFzZUhlYWRlcnMoKTtcblxuICAvLyBTZXQgbWltZS10eXBlIHVzaW5nIHRoZSBmaWxlIGV4dGVuc2lvbiBpbiBmaWxlUGF0aFxuICBjb25zdCBjb250ZW50VHlwZVZhbHVlID0gY29udGVudFR5cGUoZmlsZVBhdGgpO1xuICBpZiAoY29udGVudFR5cGVWYWx1ZSkge1xuICAgIGhlYWRlcnMuc2V0KFwiY29udGVudC10eXBlXCIsIGNvbnRlbnRUeXBlVmFsdWUpO1xuICB9XG5cbiAgLy8gU2V0IGRhdGUgaGVhZGVyIGlmIGFjY2VzcyB0aW1lc3RhbXAgaXMgYXZhaWxhYmxlXG4gIGlmIChmaWxlSW5mby5hdGltZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZmlsZUluZm8uYXRpbWUpO1xuICAgIGhlYWRlcnMuc2V0KFwiZGF0ZVwiLCBkYXRlLnRvVVRDU3RyaW5nKCkpO1xuICB9XG5cbiAgLy8gU2V0IGxhc3QgbW9kaWZpZWQgaGVhZGVyIGlmIGFjY2VzcyB0aW1lc3RhbXAgaXMgYXZhaWxhYmxlXG4gIGlmIChmaWxlSW5mby5tdGltZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICBjb25zdCBsYXN0TW9kaWZpZWQgPSBuZXcgRGF0ZShmaWxlSW5mby5tdGltZSk7XG4gICAgaGVhZGVycy5zZXQoXCJsYXN0LW1vZGlmaWVkXCIsIGxhc3RNb2RpZmllZC50b1VUQ1N0cmluZygpKTtcblxuICAgIC8vIENyZWF0ZSBhIHNpbXBsZSBldGFnIHRoYXQgaXMgYW4gbWQ1IG9mIHRoZSBsYXN0IG1vZGlmaWVkIGRhdGUgYW5kIGZpbGVzaXplIGNvbmNhdGVuYXRlZFxuICAgIGNvbnN0IHNpbXBsZUV0YWcgPSBhd2FpdCBjcmVhdGVFdGFnSGFzaChcbiAgICAgIGAke2xhc3RNb2RpZmllZC50b0pTT04oKX0ke2ZpbGVJbmZvLnNpemV9YCxcbiAgICAgIGV0YWdBbGdvcml0aG0gfHwgXCJmbnYxYVwiLFxuICAgICk7XG4gICAgaGVhZGVycy5zZXQoXCJldGFnXCIsIHNpbXBsZUV0YWcpO1xuXG4gICAgLy8gSWYgYSBgaWYtbm9uZS1tYXRjaGAgaGVhZGVyIGlzIHByZXNlbnQgYW5kIHRoZSB2YWx1ZSBtYXRjaGVzIHRoZSB0YWcgb3JcbiAgICAvLyBpZiBhIGBpZi1tb2RpZmllZC1zaW5jZWAgaGVhZGVyIGlzIHByZXNlbnQgYW5kIHRoZSB2YWx1ZSBpcyBiaWdnZXIgdGhhblxuICAgIC8vIHRoZSBhY2Nlc3MgdGltZXN0YW1wIHZhbHVlLCB0aGVuIHJldHVybiAzMDRcbiAgICBjb25zdCBpZk5vbmVNYXRjaCA9IHJlcS5oZWFkZXJzLmdldChcImlmLW5vbmUtbWF0Y2hcIik7XG4gICAgY29uc3QgaWZNb2RpZmllZFNpbmNlID0gcmVxLmhlYWRlcnMuZ2V0KFwiaWYtbW9kaWZpZWQtc2luY2VcIik7XG4gICAgaWYgKFxuICAgICAgKGlmTm9uZU1hdGNoICYmIGNvbXBhcmVFdGFnKGlmTm9uZU1hdGNoLCBzaW1wbGVFdGFnKSkgfHxcbiAgICAgIChpZk5vbmVNYXRjaCA9PT0gbnVsbCAmJlxuICAgICAgICBpZk1vZGlmaWVkU2luY2UgJiZcbiAgICAgICAgZmlsZUluZm8ubXRpbWUuZ2V0VGltZSgpIDwgbmV3IERhdGUoaWZNb2RpZmllZFNpbmNlKS5nZXRUaW1lKCkgKyAxMDAwKVxuICAgICkge1xuICAgICAgY29uc3Qgc3RhdHVzID0gU3RhdHVzLk5vdE1vZGlmaWVkO1xuICAgICAgY29uc3Qgc3RhdHVzVGV4dCA9IFNUQVRVU19URVhULmdldChzdGF0dXMpO1xuXG4gICAgICBmaWxlLmNsb3NlKCk7XG5cbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwge1xuICAgICAgICBzdGF0dXMsXG4gICAgICAgIHN0YXR1c1RleHQsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBHZXQgYW5kIHBhcnNlIHRoZSBcInJhbmdlXCIgaGVhZGVyXG4gIGNvbnN0IHJhbmdlID0gcmVxLmhlYWRlcnMuZ2V0KFwicmFuZ2VcIikgYXMgc3RyaW5nO1xuICBjb25zdCByYW5nZVJlID0gL2J5dGVzPShcXGQrKS0oXFxkKyk/LztcbiAgY29uc3QgcGFyc2VkID0gcmFuZ2VSZS5leGVjKHJhbmdlKTtcblxuICAvLyBVc2UgdGhlIHBhcnNlZCB2YWx1ZSBpZiBhdmFpbGFibGUsIGZhbGxiYWNrIHRvIHRoZSBzdGFydCBhbmQgZW5kIG9mIHRoZSBlbnRpcmUgZmlsZVxuICBjb25zdCBzdGFydCA9IHBhcnNlZCAmJiBwYXJzZWRbMV0gPyArcGFyc2VkWzFdIDogMDtcbiAgY29uc3QgZW5kID0gcGFyc2VkICYmIHBhcnNlZFsyXSA/ICtwYXJzZWRbMl0gOiBmaWxlSW5mby5zaXplIC0gMTtcblxuICAvLyBJZiB0aGVyZSBpcyBhIHJhbmdlLCBzZXQgdGhlIHN0YXR1cyB0byAyMDYsIGFuZCBzZXQgdGhlIFwiQ29udGVudC1yYW5nZVwiIGhlYWRlci5cbiAgaWYgKHJhbmdlICYmIHBhcnNlZCkge1xuICAgIGhlYWRlcnMuc2V0KFwiY29udGVudC1yYW5nZVwiLCBgYnl0ZXMgJHtzdGFydH0tJHtlbmR9LyR7ZmlsZUluZm8uc2l6ZX1gKTtcbiAgfVxuXG4gIC8vIFJldHVybiA0MTYgaWYgYHN0YXJ0YCBpc24ndCBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gYGVuZGAsIG9yIGBzdGFydGAgb3IgYGVuZGAgYXJlIGdyZWF0ZXIgdGhhbiB0aGUgZmlsZSdzIHNpemVcbiAgY29uc3QgbWF4UmFuZ2UgPSBmaWxlSW5mby5zaXplIC0gMTtcblxuICBpZiAoXG4gICAgcmFuZ2UgJiZcbiAgICAoIXBhcnNlZCB8fFxuICAgICAgdHlwZW9mIHN0YXJ0ICE9PSBcIm51bWJlclwiIHx8XG4gICAgICBzdGFydCA+IGVuZCB8fFxuICAgICAgc3RhcnQgPiBtYXhSYW5nZSB8fFxuICAgICAgZW5kID4gbWF4UmFuZ2UpXG4gICkge1xuICAgIGNvbnN0IHN0YXR1cyA9IFN0YXR1cy5SZXF1ZXN0ZWRSYW5nZU5vdFNhdGlzZmlhYmxlO1xuICAgIGNvbnN0IHN0YXR1c1RleHQgPSBTVEFUVVNfVEVYVC5nZXQoc3RhdHVzKTtcblxuICAgIGZpbGUuY2xvc2UoKTtcblxuICAgIHJldHVybiBuZXcgUmVzcG9uc2Uoc3RhdHVzVGV4dCwge1xuICAgICAgc3RhdHVzLFxuICAgICAgc3RhdHVzVGV4dCxcbiAgICAgIGhlYWRlcnMsXG4gICAgfSk7XG4gIH1cblxuICAvLyBTZXQgY29udGVudCBsZW5ndGhcbiAgY29uc3QgY29udGVudExlbmd0aCA9IGVuZCAtIHN0YXJ0ICsgMTtcbiAgaGVhZGVycy5zZXQoXCJjb250ZW50LWxlbmd0aFwiLCBgJHtjb250ZW50TGVuZ3RofWApO1xuICBpZiAocmFuZ2UgJiYgcGFyc2VkKSB7XG4gICAgLy8gQ3JlYXRlIGEgc3RyZWFtIG9mIHRoZSBmaWxlIGluc3RlYWQgb2YgbG9hZGluZyBpdCBpbnRvIG1lbW9yeVxuICAgIGxldCBieXRlc1NlbnQgPSAwO1xuICAgIGNvbnN0IGJvZHkgPSBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgICAgYXN5bmMgc3RhcnQoKSB7XG4gICAgICAgIGlmIChzdGFydCA+IDApIHtcbiAgICAgICAgICBhd2FpdCBmaWxlLnNlZWsoc3RhcnQsIERlbm8uU2Vla01vZGUuU3RhcnQpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYXN5bmMgcHVsbChjb250cm9sbGVyKSB7XG4gICAgICAgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoREVGQVVMVF9DSFVOS19TSVpFKTtcbiAgICAgICAgY29uc3QgYnl0ZXNSZWFkID0gYXdhaXQgZmlsZS5yZWFkKGJ5dGVzKTtcbiAgICAgICAgaWYgKGJ5dGVzUmVhZCA9PT0gbnVsbCkge1xuICAgICAgICAgIGZpbGUuY2xvc2UoKTtcbiAgICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShcbiAgICAgICAgICBieXRlcy5zbGljZSgwLCBNYXRoLm1pbihieXRlc1JlYWQsIGNvbnRlbnRMZW5ndGggLSBieXRlc1NlbnQpKSxcbiAgICAgICAgKTtcbiAgICAgICAgYnl0ZXNTZW50ICs9IGJ5dGVzUmVhZDtcbiAgICAgICAgaWYgKGJ5dGVzU2VudCA+IGNvbnRlbnRMZW5ndGgpIHtcbiAgICAgICAgICBmaWxlLmNsb3NlKCk7XG4gICAgICAgICAgY29udHJvbGxlci5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7XG4gICAgICBzdGF0dXM6IDIwNixcbiAgICAgIHN0YXR1c1RleHQ6IFwiUGFydGlhbCBDb250ZW50XCIsXG4gICAgICBoZWFkZXJzLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBSZXNwb25zZShmaWxlLnJlYWRhYmxlLCB7XG4gICAgc3RhdHVzOiAyMDAsXG4gICAgc3RhdHVzVGV4dDogXCJPS1wiLFxuICAgIGhlYWRlcnMsXG4gIH0pO1xufVxuXG4vLyBUT0RPKGJhcnRsb21pZWp1KTogc2ltcGxpZnkgdGhpcyBhZnRlciBkZW5vLnN0YXQgYW5kIGRlbm8ucmVhZERpciBhcmUgZml4ZWRcbmFzeW5jIGZ1bmN0aW9uIHNlcnZlRGlySW5kZXgoXG4gIHJlcTogUmVxdWVzdCxcbiAgZGlyUGF0aDogc3RyaW5nLFxuICBvcHRpb25zOiB7XG4gICAgZG90ZmlsZXM6IGJvb2xlYW47XG4gICAgdGFyZ2V0OiBzdHJpbmc7XG4gICAgZXRhZ0FsZ29yaXRobT86IEV0YWdBbGdvcml0aG07XG4gIH0sXG4pOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gIGNvbnN0IHNob3dEb3RmaWxlcyA9IG9wdGlvbnMuZG90ZmlsZXM7XG4gIGNvbnN0IGRpclVybCA9IGAvJHtwb3NpeC5yZWxhdGl2ZShvcHRpb25zLnRhcmdldCwgZGlyUGF0aCl9YDtcbiAgY29uc3QgbGlzdEVudHJ5OiBFbnRyeUluZm9bXSA9IFtdO1xuXG4gIC8vIGlmIFwiLi5cIiBtYWtlcyBzZW5zZVxuICBpZiAoZGlyVXJsICE9PSBcIi9cIikge1xuICAgIGNvbnN0IHByZXZQYXRoID0gcG9zaXguam9pbihkaXJQYXRoLCBcIi4uXCIpO1xuICAgIGNvbnN0IGZpbGVJbmZvID0gYXdhaXQgRGVuby5zdGF0KHByZXZQYXRoKTtcbiAgICBsaXN0RW50cnkucHVzaCh7XG4gICAgICBtb2RlOiBtb2RlVG9TdHJpbmcodHJ1ZSwgZmlsZUluZm8ubW9kZSksXG4gICAgICBzaXplOiBcIlwiLFxuICAgICAgbmFtZTogXCIuLi9cIixcbiAgICAgIHVybDogcG9zaXguam9pbihkaXJVcmwsIFwiLi5cIiksXG4gICAgfSk7XG4gIH1cblxuICBmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIERlbm8ucmVhZERpcihkaXJQYXRoKSkge1xuICAgIGlmICghc2hvd0RvdGZpbGVzICYmIGVudHJ5Lm5hbWVbMF0gPT09IFwiLlwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZmlsZVBhdGggPSBwb3NpeC5qb2luKGRpclBhdGgsIGVudHJ5Lm5hbWUpO1xuICAgIGNvbnN0IGZpbGVVcmwgPSBlbmNvZGVVUkkocG9zaXguam9pbihkaXJVcmwsIGVudHJ5Lm5hbWUpKTtcbiAgICBjb25zdCBmaWxlSW5mbyA9IGF3YWl0IERlbm8uc3RhdChmaWxlUGF0aCk7XG4gICAgaWYgKGVudHJ5Lm5hbWUgPT09IFwiaW5kZXguaHRtbFwiICYmIGVudHJ5LmlzRmlsZSkge1xuICAgICAgLy8gaW4gY2FzZSBpbmRleC5odG1sIGFzIGRpci4uLlxuICAgICAgcmV0dXJuIHNlcnZlRmlsZShyZXEsIGZpbGVQYXRoLCB7XG4gICAgICAgIGV0YWdBbGdvcml0aG06IG9wdGlvbnMuZXRhZ0FsZ29yaXRobSxcbiAgICAgICAgZmlsZUluZm8sXG4gICAgICB9KTtcbiAgICB9XG4gICAgbGlzdEVudHJ5LnB1c2goe1xuICAgICAgbW9kZTogbW9kZVRvU3RyaW5nKGVudHJ5LmlzRGlyZWN0b3J5LCBmaWxlSW5mby5tb2RlKSxcbiAgICAgIHNpemU6IGVudHJ5LmlzRmlsZSA/IGZpbGVMZW5Ub1N0cmluZyhmaWxlSW5mby5zaXplID8/IDApIDogXCJcIixcbiAgICAgIG5hbWU6IGAke2VudHJ5Lm5hbWV9JHtlbnRyeS5pc0RpcmVjdG9yeSA/IFwiL1wiIDogXCJcIn1gLFxuICAgICAgdXJsOiBgJHtmaWxlVXJsfSR7ZW50cnkuaXNEaXJlY3RvcnkgPyBcIi9cIiA6IFwiXCJ9YCxcbiAgICB9KTtcbiAgfVxuICBsaXN0RW50cnkuc29ydCgoYSwgYikgPT5cbiAgICBhLm5hbWUudG9Mb3dlckNhc2UoKSA+IGIubmFtZS50b0xvd2VyQ2FzZSgpID8gMSA6IC0xXG4gICk7XG4gIGNvbnN0IGZvcm1hdHRlZERpclVybCA9IGAke2RpclVybC5yZXBsYWNlKC9cXC8kLywgXCJcIil9L2A7XG4gIGNvbnN0IHBhZ2UgPSBlbmNvZGVyLmVuY29kZShkaXJWaWV3ZXJUZW1wbGF0ZShmb3JtYXR0ZWREaXJVcmwsIGxpc3RFbnRyeSkpO1xuXG4gIGNvbnN0IGhlYWRlcnMgPSBzZXRCYXNlSGVhZGVycygpO1xuICBoZWFkZXJzLnNldChcImNvbnRlbnQtdHlwZVwiLCBcInRleHQvaHRtbFwiKTtcblxuICByZXR1cm4gbmV3IFJlc3BvbnNlKHBhZ2UsIHsgc3RhdHVzOiBTdGF0dXMuT0ssIGhlYWRlcnMgfSk7XG59XG5cbmZ1bmN0aW9uIHNlcnZlRmFsbGJhY2soX3JlcTogUmVxdWVzdCwgZTogRXJyb3IpOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gIGlmIChlIGluc3RhbmNlb2YgVVJJRXJyb3IpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFxuICAgICAgbmV3IFJlc3BvbnNlKFNUQVRVU19URVhULmdldChTdGF0dXMuQmFkUmVxdWVzdCksIHtcbiAgICAgICAgc3RhdHVzOiBTdGF0dXMuQmFkUmVxdWVzdCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoZSBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLk5vdEZvdW5kKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShcbiAgICAgIG5ldyBSZXNwb25zZShTVEFUVVNfVEVYVC5nZXQoU3RhdHVzLk5vdEZvdW5kKSwge1xuICAgICAgICBzdGF0dXM6IFN0YXR1cy5Ob3RGb3VuZCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFxuICAgIG5ldyBSZXNwb25zZShTVEFUVVNfVEVYVC5nZXQoU3RhdHVzLkludGVybmFsU2VydmVyRXJyb3IpLCB7XG4gICAgICBzdGF0dXM6IFN0YXR1cy5JbnRlcm5hbFNlcnZlckVycm9yLFxuICAgIH0pLFxuICApO1xufVxuXG5mdW5jdGlvbiBzZXJ2ZXJMb2cocmVxOiBSZXF1ZXN0LCBzdGF0dXM6IG51bWJlcik6IHZvaWQge1xuICBjb25zdCBkID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICBjb25zdCBkYXRlRm10ID0gYFske2Quc2xpY2UoMCwgMTApfSAke2Quc2xpY2UoMTEsIDE5KX1dYDtcbiAgY29uc3Qgbm9ybWFsaXplZFVybCA9IG5vcm1hbGl6ZVVSTChyZXEudXJsKTtcbiAgY29uc3QgcyA9IGAke2RhdGVGbXR9IFske3JlcS5tZXRob2R9XSAke25vcm1hbGl6ZWRVcmx9ICR7c3RhdHVzfWA7XG4gIC8vIHVzaW5nIGNvbnNvbGUuZGVidWcgaW5zdGVhZCBvZiBjb25zb2xlLmxvZyBzbyBjaHJvbWUgaW5zcGVjdCB1c2VycyBjYW4gaGlkZSByZXF1ZXN0IGxvZ3NcbiAgY29uc29sZS5kZWJ1ZyhzKTtcbn1cblxuZnVuY3Rpb24gc2V0QmFzZUhlYWRlcnMoKTogSGVhZGVycyB7XG4gIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICBoZWFkZXJzLnNldChcInNlcnZlclwiLCBcImRlbm9cIik7XG5cbiAgLy8gU2V0IFwiYWNjZXB0LXJhbmdlc1wiIHNvIHRoYXQgdGhlIGNsaWVudCBrbm93cyBpdCBjYW4gbWFrZSByYW5nZSByZXF1ZXN0cyBvbiBmdXR1cmUgcmVxdWVzdHNcbiAgaGVhZGVycy5zZXQoXCJhY2NlcHQtcmFuZ2VzXCIsIFwiYnl0ZXNcIik7XG4gIGhlYWRlcnMuc2V0KFwiZGF0ZVwiLCBuZXcgRGF0ZSgpLnRvVVRDU3RyaW5nKCkpO1xuXG4gIHJldHVybiBoZWFkZXJzO1xufVxuXG5mdW5jdGlvbiBkaXJWaWV3ZXJUZW1wbGF0ZShkaXJuYW1lOiBzdHJpbmcsIGVudHJpZXM6IEVudHJ5SW5mb1tdKTogc3RyaW5nIHtcbiAgY29uc3QgcGF0aHMgPSBkaXJuYW1lLnNwbGl0KFwiL1wiKTtcblxuICByZXR1cm4gYFxuICAgIDwhRE9DVFlQRSBodG1sPlxuICAgIDxodG1sIGxhbmc9XCJlblwiPlxuICAgICAgPGhlYWQ+XG4gICAgICAgIDxtZXRhIGNoYXJzZXQ9XCJVVEYtOFwiIC8+XG4gICAgICAgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wXCIgLz5cbiAgICAgICAgPG1ldGEgaHR0cC1lcXVpdj1cIlgtVUEtQ29tcGF0aWJsZVwiIGNvbnRlbnQ9XCJpZT1lZGdlXCIgLz5cbiAgICAgICAgPHRpdGxlPkRlbm8gRmlsZSBTZXJ2ZXI8L3RpdGxlPlxuICAgICAgICA8c3R5bGU+XG4gICAgICAgICAgOnJvb3Qge1xuICAgICAgICAgICAgLS1iYWNrZ3JvdW5kLWNvbG9yOiAjZmFmYWZhO1xuICAgICAgICAgICAgLS1jb2xvcjogcmdiYSgwLCAwLCAwLCAwLjg3KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgQG1lZGlhIChwcmVmZXJzLWNvbG9yLXNjaGVtZTogZGFyaykge1xuICAgICAgICAgICAgOnJvb3Qge1xuICAgICAgICAgICAgICAtLWJhY2tncm91bmQtY29sb3I6ICMyOTI5Mjk7XG4gICAgICAgICAgICAgIC0tY29sb3I6ICNmZmY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGVhZCB7XG4gICAgICAgICAgICAgIGNvbG9yOiAjN2Y3ZjdmO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBAbWVkaWEgKG1pbi13aWR0aDogOTYwcHgpIHtcbiAgICAgICAgICAgIG1haW4ge1xuICAgICAgICAgICAgICBtYXgtd2lkdGg6IDk2MHB4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYm9keSB7XG4gICAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMzJweDtcbiAgICAgICAgICAgICAgcGFkZGluZy1yaWdodDogMzJweDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgQG1lZGlhIChtaW4td2lkdGg6IDYwMHB4KSB7XG4gICAgICAgICAgICBtYWluIHtcbiAgICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAyNHB4O1xuICAgICAgICAgICAgICBwYWRkaW5nLXJpZ2h0OiAyNHB4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBib2R5IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtY29sb3IpO1xuICAgICAgICAgICAgY29sb3I6IHZhcigtLWNvbG9yKTtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiBcIlJvYm90b1wiLCBcIkhlbHZldGljYVwiLCBcIkFyaWFsXCIsIHNhbnMtc2VyaWY7XG4gICAgICAgICAgICBmb250LXdlaWdodDogNDAwO1xuICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDEuNDM7XG4gICAgICAgICAgICBmb250LXNpemU6IDAuODc1cmVtO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhIHtcbiAgICAgICAgICAgIGNvbG9yOiAjMjE5NmYzO1xuICAgICAgICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhOmhvdmVyIHtcbiAgICAgICAgICAgIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGVhZCB7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGVhZCB0aCB7XG4gICAgICAgICAgICBwYWRkaW5nLWJvdHRvbTogMTJweDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGFibGUgdGQge1xuICAgICAgICAgICAgcGFkZGluZzogNnB4IDM2cHggNnB4IDBweDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLnNpemUge1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogcmlnaHQ7XG4gICAgICAgICAgICBwYWRkaW5nOiA2cHggMTJweCA2cHggMjRweDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLm1vZGUge1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6IG1vbm9zcGFjZSwgbW9ub3NwYWNlO1xuICAgICAgICAgIH1cbiAgICAgICAgPC9zdHlsZT5cbiAgICAgIDwvaGVhZD5cbiAgICAgIDxib2R5PlxuICAgICAgICA8bWFpbj5cbiAgICAgICAgICA8aDE+SW5kZXggb2ZcbiAgICAgICAgICA8YSBocmVmPVwiL1wiPmhvbWU8L2E+JHtcbiAgICBwYXRoc1xuICAgICAgLm1hcCgocGF0aCwgaW5kZXgsIGFycmF5KSA9PiB7XG4gICAgICAgIGlmIChwYXRoID09PSBcIlwiKSByZXR1cm4gXCJcIjtcbiAgICAgICAgY29uc3QgbGluayA9IGFycmF5LnNsaWNlKDAsIGluZGV4ICsgMSkuam9pbihcIi9cIik7XG4gICAgICAgIHJldHVybiBgPGEgaHJlZj1cIiR7bGlua31cIj4ke3BhdGh9PC9hPmA7XG4gICAgICB9KVxuICAgICAgLmpvaW4oXCIvXCIpXG4gIH1cbiAgICAgICAgICA8L2gxPlxuICAgICAgICAgIDx0YWJsZT5cbiAgICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0aD5Nb2RlPC90aD5cbiAgICAgICAgICAgICAgICA8dGg+U2l6ZTwvdGg+XG4gICAgICAgICAgICAgICAgPHRoPk5hbWU8L3RoPlxuICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICR7XG4gICAgZW50cmllc1xuICAgICAgLm1hcChcbiAgICAgICAgKGVudHJ5KSA9PiBgXG4gICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzcz1cIm1vZGVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAke2VudHJ5Lm1vZGV9XG4gICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzcz1cInNpemVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAke2VudHJ5LnNpemV9XG4gICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8YSBocmVmPVwiJHtlbnRyeS51cmx9XCI+JHtlbnRyeS5uYW1lfTwvYT5cbiAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgYCxcbiAgICAgIClcbiAgICAgIC5qb2luKFwiXCIpXG4gIH1cbiAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICA8L21haW4+XG4gICAgICA8L2JvZHk+XG4gICAgPC9odG1sPlxuICBgO1xufVxuXG5pbnRlcmZhY2UgU2VydmVEaXJPcHRpb25zIHtcbiAgZnNSb290Pzogc3RyaW5nO1xuICB1cmxSb290Pzogc3RyaW5nO1xuICBzaG93RGlyTGlzdGluZz86IGJvb2xlYW47XG4gIHNob3dEb3RmaWxlcz86IGJvb2xlYW47XG4gIGVuYWJsZUNvcnM/OiBib29sZWFuO1xuICBxdWlldD86IGJvb2xlYW47XG4gIGV0YWdBbGdvcml0aG0/OiBFdGFnQWxnb3JpdGhtO1xufVxuXG4vKipcbiAqIFNlcnZlcyB0aGUgZmlsZXMgdW5kZXIgdGhlIGdpdmVuIGRpcmVjdG9yeSByb290IChvcHRzLmZzUm9vdCkuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHNlcnZlIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vaHR0cC9zZXJ2ZXIudHNcIjtcbiAqIGltcG9ydCB7IHNlcnZlRGlyIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vaHR0cC9maWxlX3NlcnZlci50c1wiO1xuICpcbiAqIHNlcnZlKChyZXEpID0+IHtcbiAqICAgY29uc3QgcGF0aG5hbWUgPSBuZXcgVVJMKHJlcS51cmwpLnBhdGhuYW1lO1xuICogICBpZiAocGF0aG5hbWUuc3RhcnRzV2l0aChcIi9zdGF0aWNcIikpIHtcbiAqICAgICByZXR1cm4gc2VydmVEaXIocmVxLCB7XG4gKiAgICAgICBmc1Jvb3Q6IFwicGF0aC90by9zdGF0aWMvZmlsZXMvZGlyXCIsXG4gKiAgICAgfSk7XG4gKiAgIH1cbiAqICAgLy8gRG8gZHluYW1pYyByZXNwb25zZXNcbiAqICAgcmV0dXJuIG5ldyBSZXNwb25zZSgpO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBPcHRpb25hbGx5IHlvdSBjYW4gcGFzcyBgdXJsUm9vdGAgb3B0aW9uLiBJZiBpdCdzIHNwZWNpZmllZCB0aGF0IHBhcnQgaXMgc3RyaXBwZWQgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSByZXF1ZXN0ZWQgcGF0aG5hbWUuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHNlcnZlRGlyIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vaHR0cC9maWxlX3NlcnZlci50c1wiO1xuICpcbiAqIC8vIC4uLlxuICogc2VydmVEaXIobmV3IFJlcXVlc3QoXCJodHRwOi8vbG9jYWxob3N0L3N0YXRpYy9wYXRoL3RvL2ZpbGVcIiksIHtcbiAqICAgZnNSb290OiBcInB1YmxpY1wiLFxuICogICB1cmxSb290OiBcInN0YXRpY1wiLFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBUaGUgYWJvdmUgZXhhbXBsZSBzZXJ2ZXMgYC4vcHVibGljL3BhdGgvdG8vZmlsZWAgZm9yIHRoZSByZXF1ZXN0IHRvIGAvc3RhdGljL3BhdGgvdG8vZmlsZWAuXG4gKlxuICogQHBhcmFtIHJlcXVlc3QgVGhlIHJlcXVlc3QgdG8gaGFuZGxlXG4gKiBAcGFyYW0gb3B0c1xuICogQHJldHVybnNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlcnZlRGlyKHJlcTogUmVxdWVzdCwgb3B0czogU2VydmVEaXJPcHRpb25zID0ge30pIHtcbiAgbGV0IHJlc3BvbnNlOiBSZXNwb25zZTtcbiAgY29uc3QgdGFyZ2V0ID0gb3B0cy5mc1Jvb3QgfHwgXCIuXCI7XG4gIGNvbnN0IHVybFJvb3QgPSBvcHRzLnVybFJvb3Q7XG5cbiAgdHJ5IHtcbiAgICBsZXQgbm9ybWFsaXplZFBhdGggPSBub3JtYWxpemVVUkwocmVxLnVybCk7XG4gICAgaWYgKHVybFJvb3QpIHtcbiAgICAgIGlmIChub3JtYWxpemVkUGF0aC5zdGFydHNXaXRoKFwiL1wiICsgdXJsUm9vdCkpIHtcbiAgICAgICAgbm9ybWFsaXplZFBhdGggPSBub3JtYWxpemVkUGF0aC5yZXBsYWNlKHVybFJvb3QsIFwiXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IERlbm8uZXJyb3JzLk5vdEZvdW5kKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZnNQYXRoID0gcG9zaXguam9pbih0YXJnZXQsIG5vcm1hbGl6ZWRQYXRoKTtcbiAgICBjb25zdCBmaWxlSW5mbyA9IGF3YWl0IERlbm8uc3RhdChmc1BhdGgpO1xuXG4gICAgaWYgKGZpbGVJbmZvLmlzRGlyZWN0b3J5KSB7XG4gICAgICBpZiAob3B0cy5zaG93RGlyTGlzdGluZykge1xuICAgICAgICByZXNwb25zZSA9IGF3YWl0IHNlcnZlRGlySW5kZXgocmVxLCBmc1BhdGgsIHtcbiAgICAgICAgICBkb3RmaWxlczogb3B0cy5zaG93RG90ZmlsZXMgfHwgZmFsc2UsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBEZW5vLmVycm9ycy5Ob3RGb3VuZCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZSA9IGF3YWl0IHNlcnZlRmlsZShyZXEsIGZzUGF0aCwge1xuICAgICAgICBldGFnQWxnb3JpdGhtOiBvcHRzLmV0YWdBbGdvcml0aG0sXG4gICAgICAgIGZpbGVJbmZvLFxuICAgICAgfSk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc3QgZXJyID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZSA6IG5ldyBFcnJvcihcIltub24tZXJyb3IgdGhyb3duXVwiKTtcbiAgICBjb25zb2xlLmVycm9yKHJlZChlcnIubWVzc2FnZSkpO1xuICAgIHJlc3BvbnNlID0gYXdhaXQgc2VydmVGYWxsYmFjayhyZXEsIGVycik7XG4gIH1cblxuICBpZiAob3B0cy5lbmFibGVDb3JzKSB7XG4gICAgYXNzZXJ0KHJlc3BvbnNlKTtcbiAgICByZXNwb25zZS5oZWFkZXJzLmFwcGVuZChcImFjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpblwiLCBcIipcIik7XG4gICAgcmVzcG9uc2UuaGVhZGVycy5hcHBlbmQoXG4gICAgICBcImFjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnNcIixcbiAgICAgIFwiT3JpZ2luLCBYLVJlcXVlc3RlZC1XaXRoLCBDb250ZW50LVR5cGUsIEFjY2VwdCwgUmFuZ2VcIixcbiAgICApO1xuICB9XG5cbiAgaWYgKCFvcHRzLnF1aWV0KSBzZXJ2ZXJMb2cocmVxLCByZXNwb25zZSEuc3RhdHVzKTtcblxuICByZXR1cm4gcmVzcG9uc2UhO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVVUkwodXJsOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgbm9ybWFsaXplZFVybCA9IHVybDtcblxuICB0cnkge1xuICAgIC8vYWxsb3dlZCBwZXIgaHR0cHM6Ly93d3cudzMub3JnL1Byb3RvY29scy9yZmMyNjE2L3JmYzI2MTYtc2VjNS5odG1sXG4gICAgY29uc3QgYWJzb2x1dGVVUkkgPSBuZXcgVVJMKG5vcm1hbGl6ZWRVcmwpO1xuICAgIG5vcm1hbGl6ZWRVcmwgPSBhYnNvbHV0ZVVSSS5wYXRobmFtZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vd2Fzbid0IGFuIGFic29sdXRlVVJJXG4gICAgaWYgKCEoZSBpbnN0YW5jZW9mIFR5cGVFcnJvcikpIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICBub3JtYWxpemVkVXJsID0gZGVjb2RlVVJJKG5vcm1hbGl6ZWRVcmwpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKCEoZSBpbnN0YW5jZW9mIFVSSUVycm9yKSkge1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBpZiAobm9ybWFsaXplZFVybFswXSAhPT0gXCIvXCIpIHtcbiAgICB0aHJvdyBuZXcgVVJJRXJyb3IoXCJUaGUgcmVxdWVzdCBVUkkgaXMgbWFsZm9ybWVkLlwiKTtcbiAgfVxuXG4gIG5vcm1hbGl6ZWRVcmwgPSBwb3NpeC5ub3JtYWxpemUobm9ybWFsaXplZFVybCk7XG4gIGNvbnN0IHN0YXJ0T2ZQYXJhbXMgPSBub3JtYWxpemVkVXJsLmluZGV4T2YoXCI/XCIpO1xuXG4gIHJldHVybiBzdGFydE9mUGFyYW1zID4gLTFcbiAgICA/IG5vcm1hbGl6ZWRVcmwuc2xpY2UoMCwgc3RhcnRPZlBhcmFtcylcbiAgICA6IG5vcm1hbGl6ZWRVcmw7XG59XG5cbmZ1bmN0aW9uIG1haW4oKTogdm9pZCB7XG4gIGNvbnN0IHNlcnZlckFyZ3MgPSBwYXJzZShEZW5vLmFyZ3MsIHtcbiAgICBzdHJpbmc6IFtcInBvcnRcIiwgXCJob3N0XCIsIFwiY2VydFwiLCBcImtleVwiXSxcbiAgICBib29sZWFuOiBbXCJoZWxwXCIsIFwiZGlyLWxpc3RpbmdcIiwgXCJkb3RmaWxlc1wiLCBcImNvcnNcIiwgXCJ2ZXJib3NlXCJdLFxuICAgIGRlZmF1bHQ6IHtcbiAgICAgIFwiZGlyLWxpc3RpbmdcIjogdHJ1ZSxcbiAgICAgIGRvdGZpbGVzOiB0cnVlLFxuICAgICAgY29yczogdHJ1ZSxcbiAgICAgIHZlcmJvc2U6IGZhbHNlLFxuICAgICAgaG9zdDogXCIwLjAuMC4wXCIsXG4gICAgICBwb3J0OiBcIjQ1MDdcIixcbiAgICAgIGNlcnQ6IFwiXCIsXG4gICAgICBrZXk6IFwiXCIsXG4gICAgfSxcbiAgICBhbGlhczoge1xuICAgICAgcDogXCJwb3J0XCIsXG4gICAgICBjOiBcImNlcnRcIixcbiAgICAgIGs6IFwia2V5XCIsXG4gICAgICBoOiBcImhlbHBcIixcbiAgICAgIHY6IFwidmVyYm9zZVwiLFxuICAgIH0sXG4gIH0pO1xuICBjb25zdCBwb3J0ID0gc2VydmVyQXJncy5wb3J0O1xuICBjb25zdCBob3N0ID0gc2VydmVyQXJncy5ob3N0O1xuICBjb25zdCBjZXJ0RmlsZSA9IHNlcnZlckFyZ3MuY2VydDtcbiAgY29uc3Qga2V5RmlsZSA9IHNlcnZlckFyZ3Mua2V5O1xuXG4gIGlmIChzZXJ2ZXJBcmdzLmhlbHApIHtcbiAgICBwcmludFVzYWdlKCk7XG4gICAgRGVuby5leGl0KCk7XG4gIH1cblxuICBpZiAoa2V5RmlsZSB8fCBjZXJ0RmlsZSkge1xuICAgIGlmIChrZXlGaWxlID09PSBcIlwiIHx8IGNlcnRGaWxlID09PSBcIlwiKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIi0ta2V5IGFuZCAtLWNlcnQgYXJlIHJlcXVpcmVkIGZvciBUTFNcIik7XG4gICAgICBwcmludFVzYWdlKCk7XG4gICAgICBEZW5vLmV4aXQoMSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgd2lsZCA9IHNlcnZlckFyZ3MuXyBhcyBzdHJpbmdbXTtcbiAgY29uc3QgdGFyZ2V0ID0gcG9zaXgucmVzb2x2ZSh3aWxkWzBdID8/IFwiXCIpO1xuXG4gIGNvbnN0IGhhbmRsZXIgPSAocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4gPT4ge1xuICAgIHJldHVybiBzZXJ2ZURpcihyZXEsIHtcbiAgICAgIGZzUm9vdDogdGFyZ2V0LFxuICAgICAgc2hvd0Rpckxpc3Rpbmc6IHNlcnZlckFyZ3NbXCJkaXItbGlzdGluZ1wiXSxcbiAgICAgIHNob3dEb3RmaWxlczogc2VydmVyQXJncy5kb3RmaWxlcyxcbiAgICAgIGVuYWJsZUNvcnM6IHNlcnZlckFyZ3MuY29ycyxcbiAgICAgIHF1aWV0OiAhc2VydmVyQXJncy52ZXJib3NlLFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IHVzZVRscyA9IEJvb2xlYW4oa2V5RmlsZSB8fCBjZXJ0RmlsZSk7XG5cbiAgaWYgKHVzZVRscykge1xuICAgIHNlcnZlVGxzKGhhbmRsZXIsIHtcbiAgICAgIHBvcnQ6IE51bWJlcihwb3J0KSxcbiAgICAgIGhvc3RuYW1lOiBob3N0LFxuICAgICAgY2VydEZpbGUsXG4gICAgICBrZXlGaWxlLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHNlcnZlKGhhbmRsZXIsIHsgcG9ydDogTnVtYmVyKHBvcnQpLCBob3N0bmFtZTogaG9zdCB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmludFVzYWdlKCkge1xuICBjb25zb2xlLmxvZyhgRGVubyBGaWxlIFNlcnZlclxuICBTZXJ2ZXMgYSBsb2NhbCBkaXJlY3RvcnkgaW4gSFRUUC5cblxuSU5TVEFMTDpcbiAgZGVubyBpbnN0YWxsIC0tYWxsb3ctbmV0IC0tYWxsb3ctcmVhZCBodHRwczovL2Rlbm8ubGFuZC9zdGQvaHR0cC9maWxlX3NlcnZlci50c1xuXG5VU0FHRTpcbiAgZmlsZV9zZXJ2ZXIgW3BhdGhdIFtvcHRpb25zXVxuXG5PUFRJT05TOlxuICAtaCwgLS1oZWxwICAgICAgICAgIFByaW50cyBoZWxwIGluZm9ybWF0aW9uXG4gIC1wLCAtLXBvcnQgPFBPUlQ+ICAgU2V0IHBvcnRcbiAgLS1jb3JzICAgICAgICAgICAgICBFbmFibGUgQ09SUyB2aWEgdGhlIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCIgaGVhZGVyXG4gIC0taG9zdCAgICAgPEhPU1Q+ICAgSG9zdG5hbWUgKGRlZmF1bHQgaXMgMC4wLjAuMClcbiAgLWMsIC0tY2VydCA8RklMRT4gICBUTFMgY2VydGlmaWNhdGUgZmlsZSAoZW5hYmxlcyBUTFMpXG4gIC1rLCAtLWtleSAgPEZJTEU+ICAgVExTIGtleSBmaWxlIChlbmFibGVzIFRMUylcbiAgLS1uby1kaXItbGlzdGluZyAgICBEaXNhYmxlIGRpcmVjdG9yeSBsaXN0aW5nXG4gIC0tbm8tZG90ZmlsZXMgICAgICAgRG8gbm90IHNob3cgZG90ZmlsZXNcbiAgLXYsIC0tdmVyYm9zZSAgICAgICBQcmludCByZXF1ZXN0IGxldmVsIGxvZ3NcblxuICBBbGwgVExTIG9wdGlvbnMgYXJlIHJlcXVpcmVkIHdoZW4gb25lIGlzIHByb3ZpZGVkLmApO1xufVxuXG5pZiAoaW1wb3J0Lm1ldGEubWFpbikge1xuICBtYWluKCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQSwwRUFBMEU7QUFFMUUsZ0VBQWdFO0FBQ2hFLDJDQUEyQztBQUMzQyxnRkFBZ0Y7QUFFaEYsU0FBUyxPQUFPLEVBQUUsS0FBSyxRQUFRLGlCQUFpQjtBQUNoRCxTQUFTLE1BQU0sUUFBUSxxQkFBcUI7QUFDNUMsU0FBUyxLQUFLLEVBQUUsUUFB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