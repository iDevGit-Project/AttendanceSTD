using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.Students
{
    public class StudentMiniViewModel
    {
        public int Id { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? NationalCode { get; set; }
        public string? Grade { get; set; }
        public string? SchoolName { get; set; }

        public string FullName => $"{FirstName ?? ""} {LastName ?? ""}".Trim();
    }
}
