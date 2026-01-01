using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class AttendanceRecord
    {
        public int Id { get; set; }

        // SessionId باید نوعش long باشد چون AttendanceSession.Id از نوع long است
        public long SessionId { get; set; }
        public AttendanceSession? Session { get; set; }
        public int StudentId { get; set; }
        public Student? Student { get; set; }

        // جدید: چهار حالته با enum واحد
        public AttendanceStatus Status { get; set; } = AttendanceStatus.Absent;

        // اگر می‌خواهی میزان تاخیر را ضبط کنی
        public int? LateMinutes { get; set; }

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
