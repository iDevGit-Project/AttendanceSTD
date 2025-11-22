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
        [Key]
        public long Id { get; set; }

        [MaxLength(250)]
        public string? Title { get; set; }

        [MaxLength(200)]
        public string? Location { get; set; }

        [Column(TypeName = "date")]
        public DateTime Date { get; set; }  // store date (UTC date) - use Date component

        public DateTime? StartAt { get; set; } // datetime2
        public DateTime? EndAt { get; set; }   // datetime2

        [MaxLength(2000)]
        public string? Notes { get; set; }

        // navigation
        public ICollection<AttendanceRecord> Records { get; set; } = new List<AttendanceRecord>();

        // Audit
        public int? CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int? ModifiedById { get; set; }
        public DateTime? ModifiedAt { get; set; }

        // Soft-delete
        public int? DeletedById { get; set; }
        public DateTime? DeletedAt { get; set; }
    }
}
