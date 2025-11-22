using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Students
{
    public class StudentDeleteViewModel
    {
        public int Id { get; set; }

        [Display(Name = "دلیل غیرفعال‌سازی")]
        [StringLength(250)]
        public string? InactiveReason { get; set; }
    }
}
