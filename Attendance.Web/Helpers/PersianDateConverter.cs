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
    ///// <summary>
    ///// کمکی برای تبدیل بین تاریخ شمسی (yyyy/MM/dd) و DateTime
    ///// - ParseShamsiToUtc: رشتهٔ شَمشـی -> DateTime (Kind = Utc) یا null
    ///// - ToShamsiString: DateTime? -> "yyyy/MM/dd" یا null
    ///// </summary>
    //public static class PersianDateConverter
    //{
    //    private static readonly PersianCalendar _persian = new PersianCalendar();

    //    /// <summary>
    //    /// تبدیل رشتهٔ شمسی (مثل "1404/02/01" یا "1404-2-1") به DateTime (Kind = Utc).
    //    /// برمی‌گرداند null اگر ورودی نامعتبر باشد.
    //    /// </summary>
    //    public static DateTime? ParseShamsiToUtc(string? shamsi)
    //    {
    //        if (string.IsNullOrWhiteSpace(shamsi)) return null;

    //        // انتخاب جداکننده
    //        char sep = shamsi.Contains('/') ? '/' : (shamsi.Contains('-') ? '-' : '\0');
    //        string[] parts;
    //        if (sep != '\0') parts = shamsi.Split(sep);
    //        else parts = new[] { shamsi };

    //        if (parts.Length < 3) return null;

    //        if (!int.TryParse(parts[0], out int y)) return null;
    //        if (!int.TryParse(parts[1], out int m)) return null;
    //        if (!int.TryParse(parts[2], out int d)) return null;

    //        try
    //        {
    //            // تبدیل با PersianCalendar
    //            var dt = _persian.ToDateTime(y, m, d, 0, 0, 0, 0);
    //            // مشخص کردن Kind = Utc برای ثبات (می‌تونی Local یا Unspecified بخوای)
    //            return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
    //        }
    //        catch
    //        {
    //            return null;
    //        }
    //    }

    //    /// <summary>
    //    /// تبدیل DateTime? به رشتهٔ شمسی "yyyy/MM/dd". اگر null باشد، null بازگشت داده می‌شود.
    //    /// </summary>
    //    public static string? ToShamsiString(DateTime? dt)
    //    {
    //        if (!dt.HasValue) return null;

    //        var d = dt.Value;
    //        // اگر ذخیره به صورت UTC است و می‌خواهی به Local تبدیل شود:
    //        // d = d.ToLocalTime();
    //        int y = _persian.GetYear(d);
    //        int m = _persian.GetMonth(d);
    //        int day = _persian.GetDayOfMonth(d);
    //        return $"{y:0000}/{m:00}/{day:00}";
    //    }

    //    /// <summary>
    //    /// (اختیاری) تابع که بررسی می‌کند آیا سال شَمشـی کبیسه است یا نه.
    //    /// مفید برای تنظیم dropdown روزها در UI.
    //    /// </summary>
    //    public static bool IsPersianLeapYear(int persianYear)
    //    {
    //        // PersianCalendar.IsLeapYear expects gregorian year? No — it has overload: PersianCalendar.IsLeapYear(int year)
    //        try
    //        {
    //            return _persian.IsLeapYear(persianYear);
    //        }
    //        catch
    //        {
    //            return false;
    //        }
    //    }

    //    /// <summary>
    //    /// (اختیاری) تعداد روزهای ماه شَمشـی را برمی‌گرداند (برای تنظیم dropdown روز)
    //    /// </summary>
    //    public static int DaysInPersianMonth(int year, int month)
    //    {
    //        if (month >= 1 && month <= 6) return 31;
    //        if (month >= 7 && month <= 11) return 30;
    //        // month == 12
    //        return IsPersianLeapYear(year) ? 30 : 29;
    //    }
    //}
}
