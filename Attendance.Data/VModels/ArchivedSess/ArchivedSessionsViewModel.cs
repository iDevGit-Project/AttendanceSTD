using Attendance.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.ArchivedSess
{
    // ViewModel (add inside controller class or in separate file; if you prefer separate file, move it)
    public class ArchivedSessionsViewModel
    {
        public IEnumerable<AttendanceSession> Sessions { get; set; } = Enumerable.Empty<AttendanceSession>();
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public int Total { get; set; }
        public string? Search { get; set; }
    }
}
