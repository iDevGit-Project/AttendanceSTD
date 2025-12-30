using Attendance.Data.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.ArchivedSess
{
    public class AttendanceReportByDateVm
    {
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public List<AttendanceReportItemVm> Records { get; set; }
    }
}
