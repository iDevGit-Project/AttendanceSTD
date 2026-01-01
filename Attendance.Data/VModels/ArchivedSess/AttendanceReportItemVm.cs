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
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public List<AttendanceReportItemVm> Items { get; set; } = new();
    }

}
