using Attendance.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.ArchivedSess
{
    public class AttendanceReportItemVm
    {
        public string StudentName { get; set; }
        public string? Photo { get; set; }
        public AttendanceStatus Status { get; set; }
        public int? LateMinutes { get; set; }
    }
}
