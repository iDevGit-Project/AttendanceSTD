using Attendance.Data.VModels.Students;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Attendances
{
    public class AttendanceSessionCreateViewModel
    {
        public string? Title { get; set; }
        public string? Location { get; set; }

        // use DateTime for date; UI will present shamsi but send UTC Date on finalization
        public DateTime? Date { get; set; }

        public DateTime? StartAt { get; set; }
        public DateTime? EndAt { get; set; }

        // Selected student ids from UI (multi-select)
        public List<int> SelectedStudentIds { get; set; } = new();

        // optional notes for session
        public string? Notes { get; set; }

        // For UI: items to populate select list (id + display)
        public List<StudentMiniViewModel> AvailableStudents { get; set; } = new();
    }
}
