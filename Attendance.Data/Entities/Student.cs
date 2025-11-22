using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class Student : ISoftDelete
    {
        public int Id { get; set; }

        [Display(Name = "نام")]
        [Required(ErrorMessage = "فیلد نام الزامی است")]
        [StringLength(100)]
        public string FirstName { get; set; } = null!;

        [Display(Name = "نام خانوادگی")]
        [Required(ErrorMessage = "فیلد نام خانوادگی الزامی است")]
        [StringLength(100)]
        public string LastName { get; set; } = null!;

        [Display(Name = "تاریخ تولد")]
        [DataType(DataType.Date)]
        public DateTime? BirthDate { get; set; } // stored as UTC (or local) in DB

        [Display(Name = "تاریخ ورود به طرح")]
        [DataType(DataType.Date)]
        public DateTime? EntryDate { get; set; } // stored as UTC (or local) in DB

        [Display(Name = "نام پدر")]
        [StringLength(100)]
        public string? FatherName { get; set; }

        [Display(Name = "نام مدرسه")]
        [StringLength(200)]
        public string? SchoolName { get; set; }

        [Display(Name = "عکس دانش‌آموز")]
        [StringLength(300)]
        public string? PhotoPath { get; set; }

        [Display(Name = "پایه تحصیلی")]
        [StringLength(50)]
        public string? Grade { get; set; }

        [Display(Name = "نام مربی")]
        [StringLength(100)]
        public string? CoachName { get; set; }

        [Display(Name = "کد ملی")]
        [StringLength(10)]
        public string? NationalCode { get; set; }

        [Display(Name = "علت غیرفعال‌سازی")]
        [StringLength(1000)]
        public string? InactiveReason { get; set; }

        // ========== NEW FIELDS ==========
        [Display(Name = "نام کارگروه")]
        [StringLength(200)]
        public string? WorkgroupName { get; set; }

        [Display(Name = "وضعیت پرداختی شهریه")]
        public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;

        [Display(Name = "فرم تعهدنامه")]
        public FormStatus ConsentForm { get; set; } = FormStatus.Incomplete;

        [Display(Name = "فرم مصاحبه دانش‌آموز")]
        public FormStatus StudentInterviewForm { get; set; } = FormStatus.Incomplete;

        [Display(Name = "فرم مصاحبه والدین")]
        public FormStatus ParentInterviewForm { get; set; } = FormStatus.Incomplete;

        [Display(Name = "آزمون استعدادیابی")]
        public FormStatus TalentTest { get; set; } = FormStatus.Incomplete;

        [Display(Name = "فرم روانشناسی")]
        public FormStatus PsychologyForm { get; set; } = FormStatus.Incomplete;

        [Display(Name = "فرم آزمون هوش")]
        public FormStatus IQTest { get; set; } = FormStatus.Incomplete;

        [Display(Name = "فرم آزمون وارک")]
        public FormStatus WarkTest { get; set; } = FormStatus.Incomplete;
        // ========== END NEW FIELDS ==========

        // ارتباط با کلاس
        [Display(Name = "کلاس")]
        public int? ClassId { get; set; }
        public Class? Class { get; set; }

        // -- Soft delete fields --
        [Display(Name = "فعال/غیرفعال")]
        public bool IsActive { get; set; } = true;

        [Display(Name = "زمان غیرفعال سازی")]
        public DateTimeOffset? DeletedAt { get; set; }

        [Display(Name = "غیرفعال کننده")]
        [StringLength(256)]
        public string? DeletedBy { get; set; }

        public ICollection<AttendanceTable>? Attendances { get; set; }

        // Concurrency (اختیاری ولی توصیه میشه)
        [Timestamp]
        public byte[]? RowVersion { get; set; }

        public enum FormStatus : byte
        {
            Incomplete = 0,
            Complete = 1
        }
    }
    public enum PaymentStatus : byte
    {
        Unpaid = 0,
        Paid = 1,
        InProgress = 2
    }
}
