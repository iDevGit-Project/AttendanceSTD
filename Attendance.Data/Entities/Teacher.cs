using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class Teacher : ISoftDelete
    {
        public int Id { get; set; }

        [Display(Name = "نام")]
        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = null!;

        [Display(Name = "نام خانوادگی")]
        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = null!;

        [Display(Name = "شماره موبایل")]
        [StringLength(50)]
        public string? Mobile { get; set; }

        [Display(Name = "ایمیل")]
        [StringLength(200)]
        public string? Email { get; set; }

        public ICollection<Class>? Classes { get; set; }

        // Soft delete
        public bool IsActive { get; set; } = true;
        public DateTimeOffset? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
        public string InactiveReason { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
    }
}
