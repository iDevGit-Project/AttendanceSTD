using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class AttendanceRecord
    {
        public int Id { get; set; }

        // ** مهم: SessionId باید با نوع PK در AttendanceSession سازگار باشد **
        public long SessionId { get; set; }
        public AttendanceSession? Session { get; set; }

        public int StudentId { get; set; }
        public Student? Student { get; set; }

        public bool IsPresent { get; set; } = false;

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
    //public class AttendanceRecord // implements ISoftDelete if you want global filter
    //{
    //    public int Id { get; set; }

    //    public int SessionId { get; set; }
    //    public AttendanceSession? Session { get; set; }

    //    public int StudentId { get; set; }
    //    public Attendance.Data.Entities.Student? Student { get; set; } // استفاده از موجودیت Student شما

    //    public bool IsPresent { get; set; } = false;

    //    public string? Note { get; set; }

    //    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    //}
}
