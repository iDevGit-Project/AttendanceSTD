using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.ArchivedSess
{
    public class SessionListItemVm
    {
        public long Id { get; set; }
        public string? Title { get; set; }
        public DateTime? Date { get; set; }
        public string? DateShamsi { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedAtShamsi { get; set; }
        public string? Location { get; set; }
        public int RecordsCount { get; set; }
    }

    public class SessionsIndexViewModel
    {
        public IEnumerable<SessionListItemVm> Sessions { get; set; } = Array.Empty<SessionListItemVm>();
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public int Total { get; set; }
        public int TotalPages { get; set; }
        public string? Search { get; set; }
    }
}
