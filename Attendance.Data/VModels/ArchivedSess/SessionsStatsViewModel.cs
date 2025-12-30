using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.ArchivedSess
{
    public class SessionsStatsViewModel
    {
        public int TotalSessions { get; set; }
        public int ActiveSessions { get; set; }
        public int ArchivedSessions { get; set; }
    }

}
