using System.Globalization;
using System.Text.RegularExpressions;

namespace Attendance.Web.Helpers
{
    public static class PersianDateConverter
    {
        private static readonly PersianCalendar pc = new PersianCalendar();

        public static bool TryParseShamsiToDate(
            string shamsi,
            out DateTime date)
        {
            date = default;

            if (string.IsNullOrWhiteSpace(shamsi))
                return false;

            var parts = shamsi.Split('/');
            if (parts.Length != 3)
                return false;

            if (!int.TryParse(parts[0], out int y) ||
                !int.TryParse(parts[1], out int m) ||
                !int.TryParse(parts[2], out int d))
                return false;

            try
            {
                // ⬅️ ساعت 12 ظهر (امن)
                date = pc.ToDateTime(y, m, d, 12, 0, 0, 0);
                return true;
            }
            catch
            {
                return false;
            }
        }

        public static DateTime ParseShamsiToDate(string shamsi)
        {
            if (!TryParseShamsiToDate(shamsi, out var d))
                throw new ArgumentException("Invalid shamsi date");

            return d;
        }

        public static string ToShamsiString(DateTime? date)
        {
            if (!date.HasValue) return "";

            var d = date.Value;
            return $"{pc.GetYear(d):0000}/{pc.GetMonth(d):00}/{pc.GetDayOfMonth(d):00}";
        }
    }

    //public static class PersianDateConverter
    //{
    //    // regex برای YYYY/MM/DD یا YYYY-MM-DD (digits لاتین)
    //    private static readonly Regex _shamsiRegex = new Regex(@"^(?<y>\d{4})[\/\-](?<m>\d{1,2})[\/\-](?<d>\d{1,2})$", RegexOptions.Compiled);

    //    // تبدیل Shamsi string -> DateTime (UTC)
    //    // برمی‌گرداند: DateTime در Kind = DateTimeKind.Utc (گرِگوری معادل)
    //    public static DateTime? ParseShamsiToUtc(string? shamsi)
    //    {
    //        if (string.IsNullOrWhiteSpace(shamsi)) return null;
    //        var m = _shamsiRegex.Match(shamsi.Trim());
    //        if (!m.Success) return null;

    //        if (!int.TryParse(m.Groups["y"].Value, out var y)) return null;
    //        if (!int.TryParse(m.Groups["m"].Value, out var mo)) return null;
    //        if (!int.TryParse(m.Groups["d"].Value, out var d)) return null;

    //        // validate month/day ranges roughly (پایین‌ترین هَندل)
    //        if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

    //        try
    //        {
    //            // تبدیل از تقویم شمسی به میلادی
    //            var persian = new PersianCalendar();
    //            DateTime gregorian = persian.ToDateTime(y, mo, d, 0, 0, 0, 0);
    //            // برگردان به UTC (اگر می‌خواهی local ذخیره کنی، این خط را تغییر بده)
    //            return DateTime.SpecifyKind(gregorian, DateTimeKind.Unspecified).ToUniversalTime();
    //        }
    //        catch
    //        {
    //            return null;
    //        }
    //    }

    //    // امن: تلاش می‌کند parse کند و در صورت موفقیت مقدار out می‌شود
    //    public static bool TryParseShamsiToUtc(string? shamsi, out DateTime resultUtc)
    //    {
    //        resultUtc = default;
    //        var dt = ParseShamsiToUtc(shamsi);
    //        if (dt.HasValue)
    //        {
    //            resultUtc = dt.Value;
    //            return true;
    //        }
    //        return false;
    //    }

    //    // تبدیل DateTime? -> Shamsi string (برای نمایش)
    //    public static string? ToShamsiString(DateTime? dt)
    //    {
    //        if (!dt.HasValue) return null;
    //        // dt expected in UTC or local — convert to local for display
    //        var local = dt.Value.ToLocalTime();
    //        var persian = new PersianCalendar();
    //        var y = persian.GetYear(local);
    //        var m = persian.GetMonth(local);
    //        var d = persian.GetDayOfMonth(local);
    //        return $"{y:0000}/{m:00}/{d:00}";
    //    }
    //}
}
