using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class AttendanceRecord // implements ISoftDelete if you want global filter
    {
        [Key]
        public long Id { get; set; }

        // FK to session
        public long SessionId { get; set; }
        public AttendanceSession? Session { get; set; }

        // FK to student
        public int StudentId { get; set; }
        public Student? Student { get; set; }

        //public AttendanceStatus Status { get; set; } = AttendanceStatus.Unknown;
        public AttendanceStatus Status { get; set; } = (AttendanceStatus)0;

        // optional times (UTC)
        public DateTime? CheckIn { get; set; }
        public DateTime? CheckOut { get; set; }

        [MaxLength(1000)]
        public string? Notes { get; set; }

        // Audit
        public int? CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int? ModifiedById { get; set; }
        public DateTime? ModifiedAt { get; set; }

        // Soft-delete
        public int? DeletedById { get; set; }
        public DateTime? DeletedAt { get; set; }

        // convenience (mapped by controller when needed)
        [NotMapped]
        public string? StudentFullName => Student != null ? $"{Student.FirstName} {Student.LastName}".Trim() : null;
    }
}
