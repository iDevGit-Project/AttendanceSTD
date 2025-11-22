using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Attendances
{
    public class AttendanceSessionDetailsViewModel
    {
        public long Id { get; set; }
        public string? Title { get; set; }

        public DateTime Date { get; set; }
        public string? DateShamsi { get; set; }

        public DateTime? StartAt { get; set; }
        public DateTime? EndAt { get; set; }

        public string? Location { get; set; }
        public string? Notes { get; set; }

        public int RecordsCount { get; set; }
        public int PresentCount { get; set; }
        public int AbsentCount { get; set; }

        // Use ViewModel list (recommended) — avoids passing EF entities to the view
        public List<AttendanceRecordItemViewModel> Records { get; set; } = new();
    }
}
