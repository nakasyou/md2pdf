// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * This module is browser compatible.
 * @module
 */ import { DateTimeFormatter } from "./formatter.ts";
export const SECOND = 1e3;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
const DAYS_PER_WEEK = 7;
var Day;
(function(Day) {
    Day[Day["Sun"] = 0] = "Sun";
    Day[Day["Mon"] = 1] = "Mon";
    Day[Day["Tue"] = 2] = "Tue";
    Day[Day["Wed"] = 3] = "Wed";
    Day[Day["Thu"] = 4] = "Thu";
    Day[Day["Fri"] = 5] = "Fri";
    Day[Day["Sat"] = 6] = "Sat";
})(Day || (Day = {}));
/**
 * Parse date from string using format string
 * @param dateString Date string
 * @param format Format string
 * @return Parsed date
 */ export function parse(dateString, formatString) {
    const formatter = new DateTimeFormatter(formatString);
    const parts = formatter.parseToParts(dateString);
    const sortParts = formatter.sortDateTimeFormatPart(parts);
    return formatter.partsToDate(sortParts);
}
/**
 * Format date using format string
 * @param date Date
 * @param format Format string
 * @return formatted date string
 */ export function format(date, formatString) {
    const formatter = new DateTimeFormatter(formatString);
    return formatter.format(date);
}
/**
 * Get number of the day in the year
 * @return Number of the day in year
 */ export function dayOfYear(date) {
    // Values from 0 to 99 map to the years 1900 to 1999. All other values are the actual year. (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
    // Using setFullYear as a workaround
    const yearStart = new Date(date);
    yearStart.setUTCFullYear(date.getUTCFullYear(), 0, 0);
    const diff = date.getTime() - yearStart.getTime();
    return Math.floor(diff / DAY);
}
/**
 * Get number of the week in the year (ISO-8601)
 * @return Number of the week in year
 */ export function weekOfYear(date) {
    const workingDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = workingDate.getUTCDay();
    const nearestThursday = workingDate.getUTCDate() + Day.Thu - (day === Day.Sun ? DAYS_PER_WEEK : day);
    workingDate.setUTCDate(nearestThursday);
    // Get first day of year
    const yearStart = new Date(Date.UTC(workingDate.getUTCFullYear(), 0, 1));
    // return the calculated full weeks to nearest Thursday
    return Math.ceil((workingDate.getTime() - yearStart.getTime() + DAY) / WEEK);
}
/**
 * Parse a date to return a IMF formatted string date
 * RFC: https://tools.ietf.org/html/rfc7231#section-7.1.1.1
 * IMF is the time format to use when generating times in HTTP
 * headers. The time being formatted must be in UTC for Format to
 * generate the correct format.
 * @param date Date to parse
 * @return IMF date formatted string
 */ export function toIMF(date) {
    function dtPad(v, lPad = 2) {
        return v.padStart(lPad, "0");
    }
    const d = dtPad(date.getUTCDate().toString());
    const h = dtPad(date.getUTCHours().toString());
    const min = dtPad(date.getUTCMinutes().toString());
    const s = dtPad(date.getUTCSeconds().toString());
    const y = date.getUTCFullYear();
    const days = [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
    ];
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];
    return `${days[date.getUTCDay()]}, ${d} ${months[date.getUTCMonth()]} ${y} ${h}:${min}:${s} GMT`;
}
/**
 * Check given year is a leap year or not.
 * based on : https://docs.microsoft.com/en-us/office/troubleshoot/excel/determine-a-leap-year
 * @param year year in number or Date format
 */ export function isLeap(year) {
    const yearNumber = year instanceof Date ? year.getFullYear() : year;
    return yearNumber % 4 === 0 && yearNumber % 100 !== 0 || yearNumber % 400 === 0;
}
/**
 * Calculate difference between two dates.
 * @param from Year to calculate difference
 * @param to Year to calculate difference with
 * @param options Options for determining how to respond
 *
 * example :
 *
 * ```typescript
 * import * as datetime from "./mod.ts";
 *
 * datetime.difference(new Date("2020/1/1"),new Date("2020/2/2"),{ units : ["days","months"] })
 * ```
 */ export function difference(from, to, options) {
    const uniqueUnits = options?.units ? [
        ...new Set(options?.units)
    ] : [
        "milliseconds",
        "seconds",
        "minutes",
        "hours",
        "days",
        "weeks",
        "months",
        "quarters",
        "years"
    ];
    const bigger = Math.max(from.getTime(), to.getTime());
    const smaller = Math.min(from.getTime(), to.getTime());
    const differenceInMs = bigger - smaller;
    const differences = {};
    for (const uniqueUnit of uniqueUnits){
        switch(uniqueUnit){
            case "milliseconds":
                differences.milliseconds = differenceInMs;
                break;
            case "seconds":
                differences.seconds = Math.floor(differenceInMs / SECOND);
                break;
            case "minutes":
                differences.minutes = Math.floor(differenceInMs / MINUTE);
                break;
            case "hours":
                differences.hours = Math.floor(differenceInMs / HOUR);
                break;
            case "days":
                differences.days = Math.floor(differenceInMs / DAY);
                break;
            case "weeks":
                differences.weeks = Math.floor(differenceInMs / WEEK);
                break;
            case "months":
                differences.months = calculateMonthsDifference(bigger, smaller);
                break;
            case "quarters":
                differences.quarters = Math.floor(typeof differences.months !== "undefined" && differences.months / 4 || calculateMonthsDifference(bigger, smaller) / 4);
                break;
            case "years":
                differences.years = Math.floor(typeof differences.months !== "undefined" && differences.months / 12 || calculateMonthsDifference(bigger, smaller) / 12);
                break;
        }
    }
    return differences;
}
function calculateMonthsDifference(bigger, smaller) {
    const biggerDate = new Date(bigger);
    const smallerDate = new Date(smaller);
    const yearsDiff = biggerDate.getFullYear() - smallerDate.getFullYear();
    const monthsDiff = biggerDate.getMonth() - smallerDate.getMonth();
    const calendarDifferences = Math.abs(yearsDiff * 12 + monthsDiff);
    const compareResult = biggerDate > smallerDate ? 1 : -1;
    biggerDate.setMonth(biggerDate.getMonth() - compareResult * calendarDifferences);
    const isLastMonthNotFull = biggerDate > smallerDate ? 1 : -1 === -compareResult ? 1 : 0;
    const months = compareResult * (calendarDifferences - isLastMonthNotFull);
    return months === 0 ? 0 : months;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MS4wL2RhdGV0aW1lL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLyoqXG4gKiBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG4gKiBAbW9kdWxlXG4gKi9cblxuaW1wb3J0IHsgRGF0ZVRpbWVGb3JtYXR0ZXIgfSBmcm9tIFwiLi9mb3JtYXR0ZXIudHNcIjtcblxuZXhwb3J0IGNvbnN0IFNFQ09ORCA9IDFlMztcbmV4cG9ydCBjb25zdCBNSU5VVEUgPSBTRUNPTkQgKiA2MDtcbmV4cG9ydCBjb25zdCBIT1VSID0gTUlOVVRFICogNjA7XG5leHBvcnQgY29uc3QgREFZID0gSE9VUiAqIDI0O1xuZXhwb3J0IGNvbnN0IFdFRUsgPSBEQVkgKiA3O1xuY29uc3QgREFZU19QRVJfV0VFSyA9IDc7XG5cbmVudW0gRGF5IHtcbiAgU3VuLFxuICBNb24sXG4gIFR1ZSxcbiAgV2VkLFxuICBUaHUsXG4gIEZyaSxcbiAgU2F0LFxufVxuXG4vKipcbiAqIFBhcnNlIGRhdGUgZnJvbSBzdHJpbmcgdXNpbmcgZm9ybWF0IHN0cmluZ1xuICogQHBhcmFtIGRhdGVTdHJpbmcgRGF0ZSBzdHJpbmdcbiAqIEBwYXJhbSBmb3JtYXQgRm9ybWF0IHN0cmluZ1xuICogQHJldHVybiBQYXJzZWQgZGF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2UoZGF0ZVN0cmluZzogc3RyaW5nLCBmb3JtYXRTdHJpbmc6IHN0cmluZyk6IERhdGUge1xuICBjb25zdCBmb3JtYXR0ZXIgPSBuZXcgRGF0ZVRpbWVGb3JtYXR0ZXIoZm9ybWF0U3RyaW5nKTtcbiAgY29uc3QgcGFydHMgPSBmb3JtYXR0ZXIucGFyc2VUb1BhcnRzKGRhdGVTdHJpbmcpO1xuICBjb25zdCBzb3J0UGFydHMgPSBmb3JtYXR0ZXIuc29ydERhdGVUaW1lRm9ybWF0UGFydChwYXJ0cyk7XG4gIHJldHVybiBmb3JtYXR0ZXIucGFydHNUb0RhdGUoc29ydFBhcnRzKTtcbn1cblxuLyoqXG4gKiBGb3JtYXQgZGF0ZSB1c2luZyBmb3JtYXQgc3RyaW5nXG4gKiBAcGFyYW0gZGF0ZSBEYXRlXG4gKiBAcGFyYW0gZm9ybWF0IEZvcm1hdCBzdHJpbmdcbiAqIEByZXR1cm4gZm9ybWF0dGVkIGRhdGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXQoZGF0ZTogRGF0ZSwgZm9ybWF0U3RyaW5nOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBmb3JtYXR0ZXIgPSBuZXcgRGF0ZVRpbWVGb3JtYXR0ZXIoZm9ybWF0U3RyaW5nKTtcbiAgcmV0dXJuIGZvcm1hdHRlci5mb3JtYXQoZGF0ZSk7XG59XG5cbi8qKlxuICogR2V0IG51bWJlciBvZiB0aGUgZGF5IGluIHRoZSB5ZWFyXG4gKiBAcmV0dXJuIE51bWJlciBvZiB0aGUgZGF5IGluIHllYXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRheU9mWWVhcihkYXRlOiBEYXRlKTogbnVtYmVyIHtcbiAgLy8gVmFsdWVzIGZyb20gMCB0byA5OSBtYXAgdG8gdGhlIHllYXJzIDE5MDAgdG8gMTk5OS4gQWxsIG90aGVyIHZhbHVlcyBhcmUgdGhlIGFjdHVhbCB5ZWFyLiAoaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRGF0ZS9EYXRlKVxuICAvLyBVc2luZyBzZXRGdWxsWWVhciBhcyBhIHdvcmthcm91bmRcblxuICBjb25zdCB5ZWFyU3RhcnQgPSBuZXcgRGF0ZShkYXRlKTtcblxuICB5ZWFyU3RhcnQuc2V0VVRDRnVsbFllYXIoZGF0ZS5nZXRVVENGdWxsWWVhcigpLCAwLCAwKTtcbiAgY29uc3QgZGlmZiA9IGRhdGUuZ2V0VGltZSgpIC1cbiAgICB5ZWFyU3RhcnQuZ2V0VGltZSgpO1xuXG4gIHJldHVybiBNYXRoLmZsb29yKGRpZmYgLyBEQVkpO1xufVxuLyoqXG4gKiBHZXQgbnVtYmVyIG9mIHRoZSB3ZWVrIGluIHRoZSB5ZWFyIChJU08tODYwMSlcbiAqIEByZXR1cm4gTnVtYmVyIG9mIHRoZSB3ZWVrIGluIHllYXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdlZWtPZlllYXIoZGF0ZTogRGF0ZSk6IG51bWJlciB7XG4gIGNvbnN0IHdvcmtpbmdEYXRlID0gbmV3IERhdGUoXG4gICAgRGF0ZS5VVEMoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpKSxcbiAgKTtcblxuICBjb25zdCBkYXkgPSB3b3JraW5nRGF0ZS5nZXRVVENEYXkoKTtcblxuICBjb25zdCBuZWFyZXN0VGh1cnNkYXkgPSB3b3JraW5nRGF0ZS5nZXRVVENEYXRlKCkgK1xuICAgIERheS5UaHUgLVxuICAgIChkYXkgPT09IERheS5TdW4gPyBEQVlTX1BFUl9XRUVLIDogZGF5KTtcblxuICB3b3JraW5nRGF0ZS5zZXRVVENEYXRlKG5lYXJlc3RUaHVyc2RheSk7XG5cbiAgLy8gR2V0IGZpcnN0IGRheSBvZiB5ZWFyXG4gIGNvbnN0IHllYXJTdGFydCA9IG5ldyBEYXRlKERhdGUuVVRDKHdvcmtpbmdEYXRlLmdldFVUQ0Z1bGxZZWFyKCksIDAsIDEpKTtcblxuICAvLyByZXR1cm4gdGhlIGNhbGN1bGF0ZWQgZnVsbCB3ZWVrcyB0byBuZWFyZXN0IFRodXJzZGF5XG4gIHJldHVybiBNYXRoLmNlaWwoKHdvcmtpbmdEYXRlLmdldFRpbWUoKSAtIHllYXJTdGFydC5nZXRUaW1lKCkgKyBEQVkpIC8gV0VFSyk7XG59XG5cbi8qKlxuICogUGFyc2UgYSBkYXRlIHRvIHJldHVybiBhIElNRiBmb3JtYXR0ZWQgc3RyaW5nIGRhdGVcbiAqIFJGQzogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzcyMzEjc2VjdGlvbi03LjEuMS4xXG4gKiBJTUYgaXMgdGhlIHRpbWUgZm9ybWF0IHRvIHVzZSB3aGVuIGdlbmVyYXRpbmcgdGltZXMgaW4gSFRUUFxuICogaGVhZGVycy4gVGhlIHRpbWUgYmVpbmcgZm9ybWF0dGVkIG11c3QgYmUgaW4gVVRDIGZvciBGb3JtYXQgdG9cbiAqIGdlbmVyYXRlIHRoZSBjb3JyZWN0IGZvcm1hdC5cbiAqIEBwYXJhbSBkYXRlIERhdGUgdG8gcGFyc2VcbiAqIEByZXR1cm4gSU1GIGRhdGUgZm9ybWF0dGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdG9JTUYoZGF0ZTogRGF0ZSk6IHN0cmluZyB7XG4gIGZ1bmN0aW9uIGR0UGFkKHY6IHN0cmluZywgbFBhZCA9IDIpOiBzdHJpbmcge1xuICAgIHJldHVybiB2LnBhZFN0YXJ0KGxQYWQsIFwiMFwiKTtcbiAgfVxuICBjb25zdCBkID0gZHRQYWQoZGF0ZS5nZXRVVENEYXRlKCkudG9TdHJpbmcoKSk7XG4gIGNvbnN0IGggPSBkdFBhZChkYXRlLmdldFVUQ0hvdXJzKCkudG9TdHJpbmcoKSk7XG4gIGNvbnN0IG1pbiA9IGR0UGFkKGRhdGUuZ2V0VVRDTWludXRlcygpLnRvU3RyaW5nKCkpO1xuICBjb25zdCBzID0gZHRQYWQoZGF0ZS5nZXRVVENTZWNvbmRzKCkudG9TdHJpbmcoKSk7XG4gIGNvbnN0IHkgPSBkYXRlLmdldFVUQ0Z1bGxZZWFyKCk7XG4gIGNvbnN0IGRheXMgPSBbXCJTdW5cIiwgXCJNb25cIiwgXCJUdWVcIiwgXCJXZWRcIiwgXCJUaHVcIiwgXCJGcmlcIiwgXCJTYXRcIl07XG4gIGNvbnN0IG1vbnRocyA9IFtcbiAgICBcIkphblwiLFxuICAgIFwiRmViXCIsXG4gICAgXCJNYXJcIixcbiAgICBcIkFwclwiLFxuICAgIFwiTWF5XCIsXG4gICAgXCJKdW5cIixcbiAgICBcIkp1bFwiLFxuICAgIFwiQXVnXCIsXG4gICAgXCJTZXBcIixcbiAgICBcIk9jdFwiLFxuICAgIFwiTm92XCIsXG4gICAgXCJEZWNcIixcbiAgXTtcbiAgcmV0dXJuIGAke2RheXNbZGF0ZS5nZXRVVENEYXkoKV19LCAke2R9ICR7XG4gICAgbW9udGhzW2RhdGUuZ2V0VVRDTW9udGgoKV1cbiAgfSAke3l9ICR7aH06JHttaW59OiR7c30gR01UYDtcbn1cblxuLyoqXG4gKiBDaGVjayBnaXZlbiB5ZWFyIGlzIGEgbGVhcCB5ZWFyIG9yIG5vdC5cbiAqIGJhc2VkIG9uIDogaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvb2ZmaWNlL3Ryb3VibGVzaG9vdC9leGNlbC9kZXRlcm1pbmUtYS1sZWFwLXllYXJcbiAqIEBwYXJhbSB5ZWFyIHllYXIgaW4gbnVtYmVyIG9yIERhdGUgZm9ybWF0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0xlYXAoeWVhcjogRGF0ZSB8IG51bWJlcik6IGJvb2xlYW4ge1xuICBjb25zdCB5ZWFyTnVtYmVyID0geWVhciBpbnN0YW5jZW9mIERhdGUgPyB5ZWFyLmdldEZ1bGxZZWFyKCkgOiB5ZWFyO1xuICByZXR1cm4gKFxuICAgICh5ZWFyTnVtYmVyICUgNCA9PT0gMCAmJiB5ZWFyTnVtYmVyICUgMTAwICE9PSAwKSB8fCB5ZWFyTnVtYmVyICUgNDAwID09PSAwXG4gICk7XG59XG5cbmV4cG9ydCB0eXBlIFVuaXQgPVxuICB8IFwibWlsbGlzZWNvbmRzXCJcbiAgfCBcInNlY29uZHNcIlxuICB8IFwibWludXRlc1wiXG4gIHwgXCJob3Vyc1wiXG4gIHwgXCJkYXlzXCJcbiAgfCBcIndlZWtzXCJcbiAgfCBcIm1vbnRoc1wiXG4gIHwgXCJxdWFydGVyc1wiXG4gIHwgXCJ5ZWFyc1wiO1xuXG5leHBvcnQgdHlwZSBEaWZmZXJlbmNlRm9ybWF0ID0gUGFydGlhbDxSZWNvcmQ8VW5pdCwgbnVtYmVyPj47XG5cbmV4cG9ydCB0eXBlIERpZmZlcmVuY2VPcHRpb25zID0ge1xuICB1bml0cz86IFVuaXRbXTtcbn07XG5cbi8qKlxuICogQ2FsY3VsYXRlIGRpZmZlcmVuY2UgYmV0d2VlbiB0d28gZGF0ZXMuXG4gKiBAcGFyYW0gZnJvbSBZZWFyIHRvIGNhbGN1bGF0ZSBkaWZmZXJlbmNlXG4gKiBAcGFyYW0gdG8gWWVhciB0byBjYWxjdWxhdGUgZGlmZmVyZW5jZSB3aXRoXG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIGZvciBkZXRlcm1pbmluZyBob3cgdG8gcmVzcG9uZFxuICpcbiAqIGV4YW1wbGUgOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCAqIGFzIGRhdGV0aW1lIGZyb20gXCIuL21vZC50c1wiO1xuICpcbiAqIGRhdGV0aW1lLmRpZmZlcmVuY2UobmV3IERhdGUoXCIyMDIwLzEvMVwiKSxuZXcgRGF0ZShcIjIwMjAvMi8yXCIpLHsgdW5pdHMgOiBbXCJkYXlzXCIsXCJtb250aHNcIl0gfSlcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlmZmVyZW5jZShcbiAgZnJvbTogRGF0ZSxcbiAgdG86IERhdGUsXG4gIG9wdGlvbnM/OiBEaWZmZXJlbmNlT3B0aW9ucyxcbik6IERpZmZlcmVuY2VGb3JtYXQge1xuICBjb25zdCB1bmlxdWVVbml0cyA9IG9wdGlvbnM/LnVuaXRzID8gWy4uLm5ldyBTZXQob3B0aW9ucz8udW5pdHMpXSA6IFtcbiAgICBcIm1pbGxpc2Vjb25kc1wiLFxuICAgIFwic2Vjb25kc1wiLFxuICAgIFwibWludXRlc1wiLFxuICAgIFwiaG91cnNcIixcbiAgICBcImRheXNcIixcbiAgICBcIndlZWtzXCIsXG4gICAgXCJtb250aHNcIixcbiAgICBcInF1YXJ0ZXJzXCIsXG4gICAgXCJ5ZWFyc1wiLFxuICBdO1xuXG4gIGNvbnN0IGJpZ2dlciA9IE1hdGgubWF4KGZyb20uZ2V0VGltZSgpLCB0by5nZXRUaW1lKCkpO1xuICBjb25zdCBzbWFsbGVyID0gTWF0aC5taW4oZnJvbS5nZXRUaW1lKCksIHRvLmdldFRpbWUoKSk7XG4gIGNvbnN0IGRpZmZlcmVuY2VJbk1zID0gYmlnZ2VyIC0gc21hbGxlcjtcblxuICBjb25zdCBkaWZmZXJlbmNlczogRGlmZmVyZW5jZUZvcm1hdCA9IHt9O1xuXG4gIGZvciAoY29uc3QgdW5pcXVlVW5pdCBvZiB1bmlxdWVVbml0cykge1xuICAgIHN3aXRjaCAodW5pcXVlVW5pdCkge1xuICAgICAgY2FzZSBcIm1pbGxpc2Vjb25kc1wiOlxuICAgICAgICBkaWZmZXJlbmNlcy5taWxsaXNlY29uZHMgPSBkaWZmZXJlbmNlSW5NcztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwic2Vjb25kc1wiOlxuICAgICAgICBkaWZmZXJlbmNlcy5zZWNvbmRzID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlSW5NcyAvIFNFQ09ORCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIm1pbnV0ZXNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMubWludXRlcyA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZUluTXMgLyBNSU5VVEUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJob3Vyc1wiOlxuICAgICAgICBkaWZmZXJlbmNlcy5ob3VycyA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZUluTXMgLyBIT1VSKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiZGF5c1wiOlxuICAgICAgICBkaWZmZXJlbmNlcy5kYXlzID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlSW5NcyAvIERBWSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIndlZWtzXCI6XG4gICAgICAgIGRpZmZlcmVuY2VzLndlZWtzID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlSW5NcyAvIFdFRUspO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJtb250aHNcIjpcbiAgICAgICAgZGlmZmVyZW5jZXMubW9udGhzID0gY2FsY3VsYXRlTW9udGhzRGlmZmVyZW5jZShiaWdnZXIsIHNtYWxsZXIpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJxdWFydGVyc1wiOlxuICAgICAgICBkaWZmZXJlbmNlcy5xdWFydGVycyA9IE1hdGguZmxvb3IoXG4gICAgICAgICAgKHR5cGVvZiBkaWZmZXJlbmNlcy5tb250aHMgIT09IFwidW5kZWZpbmVkXCIgJiZcbiAgICAgICAgICAgIGRpZmZlcmVuY2VzLm1vbnRocyAvIDQpIHx8XG4gICAgICAgICAgICBjYWxjdWxhdGVNb250aHNEaWZmZXJlbmNlKGJpZ2dlciwgc21hbGxlcikgLyA0LFxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJ5ZWFyc1wiOlxuICAgICAgICBkaWZmZXJlbmNlcy55ZWFycyA9IE1hdGguZmxvb3IoXG4gICAgICAgICAgKHR5cGVvZiBkaWZmZXJlbmNlcy5tb250aHMgIT09IFwidW5kZWZpbmVkXCIgJiZcbiAgICAgICAgICAgIGRpZmZlcmVuY2VzLm1vbnRocyAvIDEyKSB8fFxuICAgICAgICAgICAgY2FsY3VsYXRlTW9udGhzRGlmZmVyZW5jZShiaWdnZXIsIHNtYWxsZXIpIC8gMTIsXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkaWZmZXJlbmNlcztcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlTW9udGhzRGlmZmVyZW5jZShiaWdnZXI6IG51bWJlciwgc21hbGxlcjogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgYmlnZ2VyRGF0ZSA9IG5ldyBEYXRlKGJpZ2dlcik7XG4gIGNvbnN0IHNtYWxsZXJEYXRlID0gbmV3IERhdGUoc21hbGxlcik7XG4gIGNvbnN0IHllYXJzRGlmZiA9IGJpZ2dlckRhdGUuZ2V0RnVsbFllYXIoKSAtIHNtYWxsZXJEYXRlLmdldEZ1bGxZZWFyKCk7XG4gIGNvbnN0IG1vbnRoc0RpZmYgPSBiaWdnZXJEYXRlLmdldE1vbnRoKCkgLSBzbWFsbGVyRGF0ZS5nZXRNb250aCgpO1xuICBjb25zdCBjYWxlbmRhckRpZmZlcmVuY2VzID0gTWF0aC5hYnMoeWVhcnNEaWZmICogMTIgKyBtb250aHNEaWZmKTtcbiAgY29uc3QgY29tcGFyZVJlc3VsdCA9IGJpZ2dlckRhdGUgPiBzbWFsbGVyRGF0ZSA/IDEgOiAtMTtcbiAgYmlnZ2VyRGF0ZS5zZXRNb250aChcbiAgICBiaWdnZXJEYXRlLmdldE1vbnRoKCkgLSBjb21wYXJlUmVzdWx0ICogY2FsZW5kYXJEaWZmZXJlbmNlcyxcbiAgKTtcbiAgY29uc3QgaXNMYXN0TW9udGhOb3RGdWxsID0gYmlnZ2VyRGF0ZSA+IHNtYWxsZXJEYXRlXG4gICAgPyAxXG4gICAgOiAtMSA9PT0gLWNvbXBhcmVSZXN1bHRcbiAgICA/IDFcbiAgICA6IDA7XG4gIGNvbnN0IG1vbnRocyA9IGNvbXBhcmVSZXN1bHQgKiAoY2FsZW5kYXJEaWZmZXJlbmNlcyAtIGlzTGFzdE1vbnRoTm90RnVsbCk7XG4gIHJldHVybiBtb250aHMgPT09IDAgPyAwIDogbW9udGhzO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRTs7O0NBR0MsR0FFRCxTQUFTLGlCQUFpQixRQUFRLGlCQUFpQjtBQUVuRCxPQUFPLE1BQU0sU0FBUyxJQUFJO0FBQzFCLE9BQU8sTUFBTSxTQUFTLFNBQVMsR0FBRztBQUNsQyxPQUFPLE1BQU0sT0FBTyxTQUFTLEdBQUc7QUFDaEMsT0FBTyxNQUFNLE1BQU0sT0FBTyxHQUFHO0FBQzdCLE9BQU8sTUFBTSxPQUFPLE1BQU0sRUFBRTtBQUM1QixNQUFNLGdCQUFnQjtJQUV0QjtVQUFLLEdBQUc7SUFBSCxJQUFBLElBQ0gsU0FBQSxLQUFBO0lBREcsSUFBQSxJQUVILFNBQUEsS0FBQTtJQUZHLElBQUEsSUFHSCxTQUFBLEtBQUE7SUFIRyxJQUFBLElBSUgsU0FBQSxLQUFBO0lBSkcsSUFBQSxJQUtILFNBQUEsS0FBQTtJQUxHLElBQUEsSUFNSCxTQUFBLEtBQUE7SUFORyxJQUFBLElBT0gsU0FBQSxLQUFBO0dBUEcsUUFBQTtBQVVMOzs7OztDQUtDLEdBQ0QsT0FBTyxTQUFTLE1BQU0sVUFBa0IsRUFBRSxZQUFvQixFQUFRO0lBQ3BFLE1BQU0sWUFBWSxJQUFJLGtCQUFrQjtJQUN4QyxNQUFNLFFBQVEsVUFBVSxZQUFZLENBQUM7SUFDckMsTUFBTSxZQUFZLFVBQVUsc0JBQXNCLENB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