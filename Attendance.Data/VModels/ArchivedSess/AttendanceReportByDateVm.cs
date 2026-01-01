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
        public int StudentId { get; set; }
        public string FullName { get; set; }
        public string ImagePath { get; set; }
        public bool IsPresent { get; set; }
        public int? DelayMinutes { get; set; }
    }

}
