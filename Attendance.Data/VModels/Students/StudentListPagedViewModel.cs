using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Students
{
    public class StudentListPagedViewModel
    {
        public IEnumerable<StudentListItemViewModel> Items { get; set; } = new List<StudentListItemViewModel>();

        // page info
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public int TotalCount { get; set; }
        public int InactiveCount { get; set; }

        public int TotalPages => PageSize > 0 ? (int)System.Math.Ceiling(TotalCount / (double)PageSize) : 1;

        // optional: search/filter
        public string? Search { get; set; }
    }
}
