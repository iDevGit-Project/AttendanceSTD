using System.Globalization;
using System.Text.RegularExpressions;

namespace Attendance.Web.Helpers
{
    public static class PersianDateConverter
    {
        // regex برای YYYY/MM/DD یا YYYY-MM-DD (digits لاتین)
        private static readonly Regex _shamsiRegex = new Regex(@"^(?<y>\d{4})[\/\-](?<m>\d{1,2})[\/\-](?<d>\d{1,2})$", RegexOptions.Compiled);

        // تبدیل Shamsi string -> DateTime (UTC)
        // برمی‌گرداند: DateTime در Kind = DateTimeKind.Utc (گرِگوری معادل)
        public static DateTime? ParseShamsiToUtc(string? shamsi)
        {
            if (string.IsNullOrWhiteSpace(shamsi)) return null;
            var m = _shamsiRegex.Match(shamsi.Trim());
            if (!m.Success) return null;

            if (!int.TryParse(m.Groups["y"].Value, out var y)) return null;
            if (!int.TryParse(m.Groups["m"].Value, out var mo)) return null;
            if (!int.TryParse(m.Groups["d"].Value, out var d)) return null;

            // validate month/day ranges roughly (پایین‌ترین هَندل)
            if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

            try
            {
                // تبدیل از تقویم شمسی به میلادی
                var persian = new PersianCalendar();
                DateTime gregorian = persian.ToDateTime(y, mo, d, 0, 0, 0, 0);
                // برگردان به UTC (اگر می‌خواهی local ذخیره کنی، این خط را تغییر بده)
                return DateTime.SpecifyKind(gregorian, DateTimeKind.Unspecified).ToUniversalTime();
            }
            catch
            {
                return null;
            }
        }

        // امن: تلاش می‌کند parse کند و در صورت موفقیت مقدار out می‌شود
        public static bool TryParseShamsiToUtc(string? shamsi, out DateTime resultUtc)
        {
            resultUtc = default;
            var dt = ParseShamsiToUtc(shamsi);
            if (dt.HasValue)
            {
                resultUtc = dt.Value;
                return true;
            }
            return false;
        }

        // تبدیل DateTime? -> Shamsi string (برای نمایش)
        public static string? ToShamsiString(DateTime? dt)
        {
            if (!dt.HasValue) return null;
            // dt expected in UTC or local — convert to local for display
            var local = dt.Value.ToLocalTime();
            var persian = new PersianCalendar();
            var y = persian.GetYear(local);
            var m = persian.GetMonth(local);
            var d = persian.GetDayOfMonth(local);
            return $"{y:0000}/{m:00}/{d:00}";
        }
    }
}
