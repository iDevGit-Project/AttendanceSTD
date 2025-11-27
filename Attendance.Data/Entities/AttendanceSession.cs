using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class AttendanceSession
    {
        public int Id { get; set; }

        public string Title { get; set; } = string.Empty; // نام جلسه (از مدیر دریافت می‌شود)

        // ذخیره به صورت UTC (SessionDate از تاریخ شمسی به UTC تبدیل می‌شود)
        public DateTime SessionDate { get; set; }

        // مکان اختیاری (در این مرحله می‌توانیم School یا Location را قرار دهیم)
        public string? Location { get; set; }

        // پایه‌ای که این جلسه برای آن تشکیل شده (مهم برای فیلتر/گزارش)
        public string? Grade { get; set; }

        // کاربری که ایجاد کرده (نام کاربری یا id)
        public string? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<AttendanceRecord> Records { get; set; } = new List<AttendanceRecord>();
    }
}
