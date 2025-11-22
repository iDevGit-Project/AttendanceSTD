using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class Class
    {
        public int Id { get; set; }

        [Display(Name = "نام کلاس")]
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = null!; // مثال: "پایه هشتم - الف"

        [Display(Name = "مدرس")]
        public int? TeacherId { get; set; }
        public Teacher? Teacher { get; set; }

        public ICollection<Student>? Students { get; set; }
    }
}
