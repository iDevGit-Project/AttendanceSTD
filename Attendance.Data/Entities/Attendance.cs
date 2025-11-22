using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class AttendanceTable
    {
        public int Id { get; set; }

        [Display(Name = "دانش‌آموز")]
        [Required]
        public int StudentId { get; set; }
        public Student? Student { get; set; }

        [Display(Name = "تاریخ")]
        public DateOnly Date { get; set; }

        [Display(Name = "ساعت ورود")]
        public TimeOnly? CheckIn { get; set; }

        [Display(Name = "ساعت خروج")]
        public TimeOnly? CheckOut { get; set; }

        [Display(Name = "وضعیت")]
        public AttendanceStatus Status { get; set; } = AttendanceStatus.Present;

        // → این فیلد جدید برای ثبت مدت زمان تأخیر (دقیقه و ثانیه)
        [Display(Name = "میزان تأخیر")]
        public TimeSpan? LateBy { get; set; }

        [Display(Name = "توضیحات")]
        [StringLength(500)]
        public string? Remarks { get; set; }

        [Display(Name = "ثبت‌کننده")]
        public int? TeacherId { get; set; }
        public Teacher? Teacher { get; set; }
    }

    // وضعیت حضور
    public enum AttendanceStatus
    {
        [Display(Name = "حاضر")]
        Present = 1,

        [Display(Name = "غایب")]
        Absent = 2,

        [Display(Name = "با تأخیر")]
        Late = 3,

        [Display(Name = "موجه")]
        Excused = 4
    }
}
