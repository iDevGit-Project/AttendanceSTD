using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.VModels.AttendanceDTO
{
    // DTO for payload from client when doing batch update
    public class BatchUpdateRecordDto
    {
        public long RecordId { get; set; }      // if 0 => new record (but by design InitializeRecords should have created records)
        public int StudentId { get; set; }
        public byte Status { get; set; }        // or use AttendanceStatus type
        public DateTime? CheckIn { get; set; }
        public DateTime? CheckOut { get; set; }
        public string? Notes { get; set; }
    }

    public class BatchUpdateRequest
    {
        public List<BatchUpdateRecordDto> Records { get; set; } = new();
    }
}
