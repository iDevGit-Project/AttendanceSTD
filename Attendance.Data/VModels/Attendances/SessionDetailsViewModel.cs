using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Attendances
{
    public class SessionDetailsViewModel
    {
        public long Id { get; set; }
        public string? Title { get; set; }
        public DateTime? Date { get; set; }
        public DateTime? StartAt { get; set; }
        public DateTime? EndAt { get; set; }
        public string? Location { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<AttendanceRecordItem> Records { get; set; } = new();
    }

    public class AttendanceRecordItem
    {
        public int Id { get; set; }
        public int StudentId { get; set; }
        public string StudentName { get; set; } = "";
        public string StudentPhoto { get; set; } = "/uploads/students/default.png";
        public bool IsPresent { get; set; }
        public string? Note { get; set; }
    }
}
