using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Attendance.Data.Entities.Student;

namespace Attendance.Data.VModels.Students
{
    public class StudentCreateViewModel
    {
        // ========== فیلدهای اصلی ==========
        [Required(ErrorMessage = "فیلد نام الزامی است")]
        [StringLength(100)]
        [Display(Name = "نام")]
        public string FirstName { get; set; } = null!;

        [Required(ErrorMessage = "فیلد نام خانوادگی الزامی است")]
        [StringLength(100)]
        [Display(Name = "نام خانوادگی")]
        public string LastName { get; set; } = null!;

        [StringLength(100)]
        [Display(Name = "نام پدر")]
        public string FatherName { get; set; }

        [StringLength(200)]
        [Display(Name = "نام مدرسه")]
        public string SchoolName { get; set; }

        [StringLength(50)]
        [Display(Name = "پایه تحصیلی")]
        public string Grade { get; set; }

        [StringLength(100)]
        [Display(Name = "نام مربی")]
        public string CoachName { get; set; }

        [StringLength(10)]
        [Display(Name = "کد ملی")]
        public string NationalCode { get; set; }

        [StringLength(200)]
        [Display(Name = "نام کارگروه")]
        public string WorkgroupName { get; set; }

        // ========== وضعیت فرم‌ها ==========
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

        // ========== سایر فیلدها ==========
        [StringLength(1000)]
        [Display(Name = "علت غیرفعال‌سازی")]
        public string InactiveReason { get; set; }

        [Display(Name = "کلاس")]
        public int? ClassId { get; set; }

        [Display(Name = "فعال/غیرفعال")]
        public bool IsActive { get; set; } = true;

        [Display(Name = "تصویر دانش‌آموز")]
        public IFormFile? Photo { get; set; }
    }
}
