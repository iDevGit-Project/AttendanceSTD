using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Students
{
    public class StudentsIndexViewModel
    {
        public IEnumerable<StudentListItemViewModel> Students { get; set; } = Enumerable.Empty<StudentListItemViewModel>();

        // آمار
        public int TotalStudents { get; set; }
        public int InactiveStudents { get; set; }
        public int ActiveStudents => TotalStudents - InactiveStudents;

        // صفحه‌بندی
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public int TotalPages { get; set; }

        // برای جستجو (اختیاری، اگر بخواهی سرور-ساید سرچ پیاده بشه)
        public string? Search { get; set; }
    }

}
