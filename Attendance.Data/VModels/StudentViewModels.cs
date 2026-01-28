using Attendance.Data.Entities;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels
{
    public class StudentListItemViewModel
    {
        public int Id { get; set; }
        public string? Photo { get; set; }
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string? EntryDateShamsi { get; set; }
        public string? BirthDateShamsi { get; set; }
        public PaymentStatus PaymentStatus { get; set; }

        public string PaymentStatusLabel =>
            PaymentStatus switch
            {
                PaymentStatus.Paid => "پرداخت شده",
                PaymentStatus.Unpaid => "پرداخت نشده",
                PaymentStatus.InProgress => "در حال پرداخت",
                _ => "-"
            };
        public string FatherName { get; set; } = null!;
        public string? NationalCode { get; set; }
        public string? Grade { get; set; }
        public string? SchoolName { get; set; }
        public string? CoachName { get; set; }
        public bool IsActive { get; set; } = true;
        public string? InactiveReason { get; set; }
        public int? ClassId { get; set; }
        public string? ClassName { get; set; }

        public string? HomeAddress { get; set; }
        public OwnershipStatus? OwnershipStatus { get; set; }
        public string? StudentPhone { get; set; }
        public string? FatherPhone { get; set; }
        public string? MotherPhone { get; set; }
        public bool IsParentInEitaa { get; set; }
        public string? FatherJob { get; set; }
        public string? MotherJob { get; set; }
        public decimal? LastAverageScore { get; set; }
        public string? LastAverageDescription { get; set; }
        // ===== Tuition Fields =====
        public decimal? ApprovedSixMonthTuition { get; set; }
        public decimal? PaidAmountSoFar { get; set; }
        // مجموع پرداختی‌ها تا این لحظه

        // ====== نمایش داده های لیست در فرم ثبت نام ======
        public string? WorkgroupName { get; set; }
        public Student.FormStatus ConsentForm { get; set; } = Student.FormStatus.Incomplete;
        public Student.FormStatus StudentInterviewForm { get; set; } = Student.FormStatus.Incomplete;
        public Student.FormStatus ParentInterviewForm { get; set; } = Student.FormStatus.Incomplete;
        public Student.FormStatus TalentTest { get; set; } = Student.FormStatus.Incomplete;
        public Student.FormStatus PsychologyForm { get; set; } = Student.FormStatus.Incomplete;
        public Student.FormStatus IQTest { get; set; } = Student.FormStatus.Incomplete;
        public Student.FormStatus WarkTest { get; set; } = Student.FormStatus.Incomplete;
    }

    public class StudentEditViewModel
    {
        [Required]
        public int Id { get; set; }

        // ====== فیلدهای اصلی ======
        [Required(ErrorMessage = "فیلد نام الزامی است")]
        [StringLength(100)]
        [Display(Name = "نام")]
        public string FirstName { get; set; } = null!;

        [Required(ErrorMessage = "فیلد نام خانوادگی الزامی است")]
        [StringLength(100)]
        [Display(Name = "نام خانوادگی")]
        public string LastName { get; set; } = null!;

        // ====== تاریخ تولد ======
        [Display(Name = "سال تولد")]
        public int? BirthYear { get; set; }

        [Display(Name = "ماه تولد")]
        public int? BirthMonth { get; set; }

        [Display(Name = "روز تولد")]
        public int? BirthDay { get; set; }

        [Display(Name = "تاریخ تولد (شمسی)")]
        public string? BirthDateShamsi
        {
            get
            {
                if (BirthYear.HasValue && BirthMonth.HasValue && BirthDay.HasValue)
                    return $"{BirthYear:0000}/{BirthMonth:00}/{BirthDay:00}";
                return null;
            }
            set
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    var parts = value.Split('/');
                    if (parts.Length == 3 &&
                        int.TryParse(parts[0], out var y) &&
                        int.TryParse(parts[1], out var m) &&
                        int.TryParse(parts[2], out var d))
                    {
                        BirthYear = y;
                        BirthMonth = m;
                        BirthDay = d;
                    }
                }
            }
        }

        // ====== تاریخ ورود ======
        [Display(Name = "سال ورود")]
        public int? EntryYear { get; set; }

        [Display(Name = "ماه ورود")]
        public int? EntryMonth { get; set; }

        [Display(Name = "روز ورود")]
        public int? EntryDay { get; set; }

        [Display(Name = "تاریخ ورود (شمسی)")]
        public string? EntryDateShamsi
        {
            get
            {
                if (EntryYear.HasValue && EntryMonth.HasValue && EntryDay.HasValue)
                    return $"{EntryYear:0000}/{EntryMonth:00}/{EntryDay:00}";
                return null;
            }
            set
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    var parts = value.Split('/');
                    if (parts.Length == 3 &&
                        int.TryParse(parts[0], out var y) &&
                        int.TryParse(parts[1], out var m) &&
                        int.TryParse(parts[2], out var d))
                    {
                        EntryYear = y;
                        EntryMonth = m;
                        EntryDay = d;
                    }
                }
            }
        }

        // ====== وضعیت پرداخت ======
        [Display(Name = "وضعیت پرداخت")]
        public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;

        [StringLength(100)]
        [Display(Name = "نام پدر")]
        public string? FatherName { get; set; }

        [StringLength(200)]
        [Display(Name = "نام مدرسه")]
        public string? SchoolName { get; set; }

        [StringLength(300)]
        [Display(Name = "عکس فعلی")]
        public string? PhotoPath { get; set; }

        [StringLength(50)]
        [Display(Name = "پایه تحصیلی")]
        public string? Grade { get; set; }

        [StringLength(100)]
        [Display(Name = "نام مربی")]
        public string? CoachName { get; set; }

        [StringLength(10)]
        [Display(Name = "کد ملی")]
        public string? NationalCode { get; set; }

        [StringLength(1000)]
        [Display(Name = "علت غیرفعال‌سازی")]
        public string? InactiveReason { get; set; }

        // ====== فیلدهای جدید ======
        [StringLength(200)]
        [Display(Name = "نام کارگروه")]
        public string? WorkgroupName { get; set; }

        [Display(Name = "فرم تعهدنامه")]
        public Student.FormStatus ConsentForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم مصاحبه دانش‌آموز")]
        public Student.FormStatus StudentInterviewForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم مصاحبه والدین")]
        public Student.FormStatus ParentInterviewForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "آزمون استعدادیابی")]
        public Student.FormStatus TalentTest { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم روانشناسی")]
        public Student.FormStatus PsychologyForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم آزمون هوش")]
        public Student.FormStatus IQTest { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم آزمون وارک")]
        public Student.FormStatus WarkTest { get; set; } = Student.FormStatus.Incomplete;

        // ====== سایر ======
        [Display(Name = "کلاس")]
        public int? ClassId { get; set; }

        [Display(Name = "فعال/غیرفعال")]
        public bool IsActive { get; set; } = true;

        // عکس جدید (برای آپلود در POST)
        [Display(Name = "عکس جدید")]
        public IFormFile? Photo { get; set; }

        // RowVersion به صورت base64 برای ارسال در فرم
        public string? RowVersion { get; set; }
    }

    public class StudentCreateViewModel
    {
        [Required(ErrorMessage = "فیلد نام الزامی است")]
        [StringLength(100)]
        [Display(Name = "نام")]
        public string FirstName { get; set; } = null!;

        [Required(ErrorMessage = "فیلد نام خانوادگی الزامی است")]
        [StringLength(100)]
        [Display(Name = "نام خانوادگی")]
        public string LastName { get; set; } = null!;

        // ====== تاریخ تولد ======
        [Display(Name = "سال تولد")]
        public int? BirthYear { get; set; }

        [Display(Name = "ماه تولد")]
        public int? BirthMonth { get; set; }

        [Display(Name = "روز تولد")]
        public int? BirthDay { get; set; }

        [Display(Name = "تاریخ تولد (شمسی)")]
        public string? BirthDateShamsi
        {
            get
            {
                if (BirthYear.HasValue && BirthMonth.HasValue && BirthDay.HasValue)
                    return $"{BirthYear:0000}/{BirthMonth:00}/{BirthDay:00}";
                return null;
            }
        }

        // ====== تاریخ ورود ======
        [Display(Name = "سال ورود")]
        public int? EntryYear { get; set; }

        [Display(Name = "ماه ورود")]
        public int? EntryMonth { get; set; }

        [Display(Name = "روز ورود")]
        public int? EntryDay { get; set; }

        [Display(Name = "تاریخ ورود (شمسی)")]
        public string? EntryDateShamsi
        {
            get
            {
                if (EntryYear.HasValue && EntryMonth.HasValue && EntryDay.HasValue)
                    return $"{EntryYear:0000}/{EntryMonth:00}/{EntryDay:00}";
                return null;
            }
        }


        // ====== وضعیت پرداخت ======
        [Display(Name = "وضعیت پرداخت")]
        public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;

        [StringLength(100)]
        [Display(Name = "نام پدر")]
        public string? FatherName { get; set; }

        [StringLength(200)]
        [Display(Name = "نام مدرسه")]
        public string? SchoolName { get; set; }

        [StringLength(50)]
        [Display(Name = "پایه تحصیلی")]
        public string? Grade { get; set; }

        [StringLength(100)]
        [Display(Name = "نام مربی")]
        public string? CoachName { get; set; }

        [StringLength(10)]
        [Display(Name = "کد ملی")]
        public string? NationalCode { get; set; }

        [StringLength(200)]
        [Display(Name = "نام کارگروه")]
        public string? WorkgroupName { get; set; }

        // ========== ADDITIONAL FIELDS ==========

        [Display(Name = "آدرس منزل")]
        [StringLength(1000)]
        public string? HomeAddress { get; set; }

        [Display(Name = "وضعیت تملک")]
        public OwnershipStatus? OwnershipStatus { get; set; }

        [Display(Name = "شماره تماس دانش‌آموز")]
        [StringLength(15)]
        public string? StudentPhone { get; set; }

        [Display(Name = "شماره تماس پدر")]
        [StringLength(15)]
        public string? FatherPhone { get; set; }

        [Display(Name = "شماره تماس مادر")]
        [StringLength(15)]
        public string? MotherPhone { get; set; }

        [Display(Name = "عضویت والدین در کانال ایتا")]
        public bool IsParentInEitaa { get; set; }

        [Display(Name = "شغل پدر")]
        [StringLength(200)]
        public string? FatherJob { get; set; }

        [Display(Name = "شغل مادر")]
        [StringLength(200)]
        public string? MotherJob { get; set; }

        [Display(Name = "آخرین معدل (عددی)")]
        [Column(TypeName = "decimal(4,2)")]
        public decimal? LastAverageScore { get; set; }

        [Display(Name = "آخرین معدل (توضیح متنی)")]
        [StringLength(100)]
        public string? LastAverageDescription { get; set; }

        // ===== Tuition Fields =====

        [Display(Name = "شهریه مصوب شش‌ماهه")]
        [Column(TypeName = "decimal(18,0)")]
        public decimal? ApprovedSixMonthTuition { get; set; }
        // مبلغ خام در دیتابیس (مثلاً: 1000000)

        [Display(Name = "مبلغ پرداخت‌شده تا کنون")]
        [Column(TypeName = "decimal(18,0)")]
        public decimal? PaidAmountSoFar { get; set; }
        // مجموع پرداختی‌ها تا این لحظه

        [Display(Name = "فرم تعهدنامه")]
        public Student.FormStatus ConsentForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم مصاحبه دانش‌آموز")]
        public Student.FormStatus StudentInterviewForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم مصاحبه والدین")]
        public Student.FormStatus ParentInterviewForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "آزمون استعدادیابی")]
        public Student.FormStatus TalentTest { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم روانشناسی")]
        public Student.FormStatus PsychologyForm { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم آزمون هوش")]
        public Student.FormStatus IQTest { get; set; } = Student.FormStatus.Incomplete;

        [Display(Name = "فرم آزمون وارک")]
        public Student.FormStatus WarkTest { get; set; } = Student.FormStatus.Incomplete;

        [StringLength(1000)]
        [Display(Name = "علت غیرفعال‌سازی")]
        public string? InactiveReason { get; set; }

        [Display(Name = "کلاس")]
        public int? ClassId { get; set; }

        [Display(Name = "فعال/غیرفعال")]
        public bool IsActive { get; set; } = true;

        [Display(Name = "تصویر دانش‌آموز")]
        public IFormFile? Photo { get; set; }

    }

    public class StudentDeleteViewModel
    {
        public int Id { get; set; }

        [Display(Name = "علت غیرفعال‌سازی")]
        [Required(ErrorMessage = "لطفاً دلیل غیرفعال‌سازی را وارد کنید.")]
        [StringLength(1000)]
        public string Reason { get; set; } = null!;
    }
}
