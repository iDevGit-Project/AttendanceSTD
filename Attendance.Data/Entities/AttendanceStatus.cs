using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    /// <summary>
    /// وضعیت حضور — پایهٔ بایت تا نگاشت به tinyint در SQL Server آسان باشد.
    /// یک تعریفی واحد و مشترک برای کل پروژه.
    /// </summary>
    public enum AttendanceStatus : byte
    {
        Present = 1,
        Absent = 2,
        Late = 3,
        Excused = 4
    }
}
