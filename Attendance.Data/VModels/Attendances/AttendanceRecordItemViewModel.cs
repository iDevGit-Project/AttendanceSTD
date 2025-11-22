using Attendance.Data.VModels.Students;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Attendances
{
    public class AttendanceRecordItemViewModel
    {
        public long Id { get; set; }
        public long SessionId { get; set; }
        public int StudentId { get; set; }

        //public Attendance.Data.Entities.AttendanceStatus Status { get; set; } = Attendance.Data.Entities.AttendanceStatus.Unknown;

        public DateTime? CheckIn { get; set; }
        public DateTime? CheckOut { get; set; }

        public string? Notes { get; set; }

        public StudentMiniViewModel Student { get; set; } = new StudentMiniViewModel();

        // For JS-friendly serialization (camelCase) you can add JsonPropertyName attributes or configure globally
        [JsonIgnore]
        public string? CheckInDisplay => CheckIn?.ToString("yyyy-MM-dd HH:mm");
    }
}
