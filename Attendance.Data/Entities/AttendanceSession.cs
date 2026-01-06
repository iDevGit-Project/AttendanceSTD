using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Attendance.Data.Entities
{
    public class AttendanceSession
    {
        /// <summary>
        /// bigint (PK)
        /// </summary>
        public long Id { get; set; }

        /// <summary>
        /// nvarchar(250)
        /// </summary>
        public string? Title { get; set; }

        /// <summary>
        /// ستون تاریخ اصلی جدول (نام ستون در دیتابیس: Date)
        /// از نوع date — در مدل از DateTime? استفاده شده تا مطابقت و انعطاف داشته باشیم.
        /// </summary>
        public DateTime? Date { get; set; }

        /// <summary>
        /// StartAt (datetime2) - شروع جلسه (اختیاری)
        /// </summary>
        public DateTime? StartAt { get; set; }

        /// <summary>
        /// EndAt (datetime2) - پایان جلسه (اختیاری)
        /// </summary>
        public DateTime? EndAt { get; set; }

        /// <summary>
        /// ClassId (int) - ارجاع اختیاری به کلاس (در صورت داشتن جدول کلاس)
        /// </summary>
        public int? ClassId { get; set; }

        /// <summary>
        /// Location nvarchar(200)
        /// </summary>
        public string? Location { get; set; }

        /// <summary>
        /// CreatedById (int) - کاربر ایجادکننده (اگر در سیستم شما شناسه عددی کاربر است)
        /// مطابق با جدول فعلی که CreatedById دارد.
        /// </summary>
        public int? CreatedById { get; set; }

        /// <summary>
        /// CreatedAt datetime2 (غیر nullable در جدول شما طبق تصویر)
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// ModifiedById (int) - شناسه کاربر ویرایش‌کننده (اختیاری)
        /// </summary>
        public int? ModifiedById { get; set; }

        /// <summary>
        /// ModifiedAt datetime2 (اختیاری)
        /// </summary>
        public DateTime? ModifiedAt { get; set; }

        /// <summary>
        /// DeletedById (int) - شناسه کاربر حذف‌کننده (اختیاری)
        /// </summary>
        public int? DeletedById { get; set; }

        /// <summary>
        /// DeletedAt datetime2 (اختیاری)
        /// </summary>
        public DateTime? DeletedAt { get; set; }

        /// <summary>
        /// Notes nvarchar(2000) - توضیحات دلخواه
        /// </summary>
        public string? Notes { get; set; }

        public SessionPeriod Period { get; set; }

        /// <summary>
        /// Navigation: رکوردهای حضور/غیاب مرتبط با این جلسه
        /// </summary>
        public ICollection<AttendanceRecord> Records { get; set; } = new List<AttendanceRecord>();

        // --- Convenience helpers (اختیاری ولی مفید) ---
        /// </summary>
        [NotMapped]
        public DateTime? SessionStart
        {
            get
            {
                if (StartAt.HasValue) return StartAt.Value;
                if (Date.HasValue) return Date.Value.Date;
                return null;
            }
        }
    }
    public enum SessionPeriod
    {
        Morning = 1,
        Evening = 2
    }

}
