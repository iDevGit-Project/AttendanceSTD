using System.Globalization;

namespace Attendance.Web.Mapping
{
    /// <summary>
    /// Simple helper to convert Gregorian DateTime to a Shamsi (Persian) date string.
    /// Produces "yyyy/MM/dd" or "yyyy/MM/dd HH:mm" formats.
    /// Place this class in your project at: Attendance.Web.Entities.Helpers namespace.
    /// </summary>
    public static class PersianDateConverter
    {
        /// <summary>
        /// Convert a DateTime (assumed UTC or local as you prefer) to a Shamsi date string "yyyy/MM/dd".
        /// </summary>
        public static string ToShamsiString(DateTime dt)
        {
            var pc = new PersianCalendar();
            int y = pc.GetYear(dt);
            int m = pc.GetMonth(dt);
            int d = pc.GetDayOfMonth(dt);
            return $"{y:0000}/{m:00}/{d:00}";
        }

        /// <summary>
        /// Convert a DateTime to a Shamsi date string including time "yyyy/MM/dd HH:mm".
        /// </summary>
        public static string ToShamsiStringWithTime(DateTime dt)
        {
            var date = ToShamsiString(dt);
            return $"{date} {dt:HH:mm}";
        }
    }
}
