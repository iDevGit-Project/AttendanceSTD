using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public interface ISoftDelete
    {
        bool IsActive { get; set; }
        DateTimeOffset? DeletedAt { get; set; }
        string? DeletedBy { get; set; }
        string? InactiveReason { get; set; }
    }

    //public interface ISoftDelete
    //{
    //    /// <summary>
    //    /// true = رکورد فعال است (نمایش داده شود)
    //    /// false = رکورد غیرفعال (Soft deleted)
    //    /// </summary>
    //    bool IsActive { get; set; }

    //    /// <summary>
    //    /// زمان غیرفعال‌سازی (UTC)
    //    /// </summary>
    //    DateTimeOffset? DeletedAt { get; set; }

    //    /// <summary>
    //    /// نام/آی‌دی کاربری که رکورد را غیرفعال کرده
    //    /// </summary>
    //    string? DeletedBy { get; set; }
    //}
}
