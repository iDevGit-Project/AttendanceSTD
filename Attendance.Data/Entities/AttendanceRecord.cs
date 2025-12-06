using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class AttendanceRecord // implements ISoftDelete if you want global filter
    {
        public int Id { get; set; }

        // <-- مهم: اینجا باید long باشد چون AttendanceSession.Id از نوع long است
        public long SessionId { get; set; }
        public AttendanceSession? Session { get; set; }

        public int StudentId { get; set; }
        public Student? Student { get; set; }

        // جدید: وضعیت 4 حالته (enum)
        public AttendanceStatus Status { get; set; } = AttendanceStatus.Absent;

        // در صورت نیاز به ثبت تأخیر دقیقه‌ای
        public int? LateMinutes { get; set; }

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
