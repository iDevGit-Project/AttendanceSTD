using Attendance.Data.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Attendance.Data.Conext
{
    public class ApplicationDbContext : IdentityDbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<Student> Students { get; set; } = null!;
        public DbSet<Teacher> Teachers { get; set; } = null!;
        public DbSet<Class> Classes { get; set; } = null!;
        public DbSet<AttendanceTable> Attendances { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // ---------- Student: Unique Index for NationalCode (فقط رکوردهای فعال) ----------
            // توجه: HasFilter برای SQL Server نوشته شده (براکت دور ستون‌ها)
            builder.Entity<Student>()
                .HasIndex(s => s.NationalCode)
                .IsUnique()
                .HasFilter("[NationalCode] IS NOT NULL AND [IsActive] = 1");

            // ---------- AttendanceTable: LateBy column mapping ----------
            builder.Entity<AttendanceTable>()
                .Property(a => a.LateBy)
                .HasColumnType("time");

            // جلوگیری از ثبت چند ردیف حضور برای یک دانش‌آموز در همان روز
            builder.Entity<AttendanceTable>()
                .HasIndex(a => new { a.StudentId, a.Date })
                .IsUnique();

            // --------- Global Query Filter for Soft Delete ----------
            // برای همه Entity هایی که ISoftDelete را پیاده‌سازی کرده‌اند
            // به طور پیش‌فرض فقط رکوردهای IsActive == true نمایش داده شوند
            foreach (var entityType in builder.Model.GetEntityTypes())
            {
                var clrType = entityType.ClrType;
                if (typeof(ISoftDelete).IsAssignableFrom(clrType))
                {
                    var parameter = Expression.Parameter(clrType, "e");
                    var prop = Expression.Property(parameter, nameof(ISoftDelete.IsActive));
                    var condition = Expression.Equal(prop, Expression.Constant(true));
                    var lambda = Expression.Lambda(condition, parameter);

                    builder.Entity(clrType).HasQueryFilter(lambda);
                }
            }

            // ---------- Optional: Configure RowVersion for Student ----------
            builder.Entity<Student>()
                .Property(s => s.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            // ---------- NEW: Map Student date columns and PaymentStatus ----------
            builder.Entity<Student>(entity =>
            {
                // BirthDate: store as datetime2 (nullable)
                entity.Property(e => e.BirthDate)
                      .HasColumnType("datetime2");

                // EntryDate: store as datetime2 (nullable)
                entity.Property(e => e.EntryDate)
                      .HasColumnType("datetime2");

                // PaymentStatus: store enum as tinyint (byte)
                // ensures compact storage and predictable mapping
                entity.Property(e => e.PaymentStatus)
                      .HasConversion<byte>()               // تبدیل enum -> byte برای ذخیره در DB
                      .HasColumnType("tinyint")            // نگاشت نوع ستون در SQL Server
                      .HasDefaultValue(PaymentStatus.Unpaid); // مقدار پیش‌فرض به صورت enum (نه byte)

                // (اختیاری) طول نام کارگروه را صریح می‌کنیم اگر لازم باشه
                entity.Property(e => e.WorkgroupName)
                      .HasMaxLength(200);
            });
        }
    }

    //public class ApplicationDbContext : IdentityDbContext
    //{
    //    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    //    public DbSet<Student> Students { get; set; } = null!;
    //    public DbSet<Teacher> Teachers { get; set; } = null!;
    //    public DbSet<Class> Classes { get; set; } = null!;
    //    public DbSet<AttendanceTable> Attendances { get; set; } = null!;

    //    protected override void OnModelCreating(ModelBuilder builder)
    //    {
    //        base.OnModelCreating(builder);

    //        // ---------- Student: Unique Index for NationalCode (فقط رکوردهای فعال) ----------
    //        builder.Entity<Student>()
    //            .HasIndex(s => s.NationalCode)
    //            .IsUnique()
    //            .HasFilter("[NationalCode] IS NOT NULL AND [IsActive] = 1");

    //        // ---------- AttendanceTable: LateBy column mapping ----------
    //        builder.Entity<AttendanceTable>()
    //            .Property(a => a.LateBy)
    //            .HasColumnType("time");

    //        // جلوگیری از ثبت چند ردیف حضور برای یک دانش‌آموز در همان روز
    //        builder.Entity<AttendanceTable>()
    //            .HasIndex(a => new { a.StudentId, a.Date })
    //            .IsUnique();

    //        // --------- Global Query Filter for Soft Delete ----------
    //        // برای همه Entity هایی که ISoftDelete را پیاده‌سازی کرده‌اند
    //        // به طور پیش‌فرض فقط رکوردهای IsActive == true نمایش داده شوند
    //        foreach (var entityType in builder.Model.GetEntityTypes())
    //        {
    //            var clrType = entityType.ClrType;
    //            if (typeof(ISoftDelete).IsAssignableFrom(clrType))
    //            {
    //                // parameter: e =>
    //                var parameter = Expression.Parameter(clrType, "e");
    //                // property: e.IsActive
    //                var prop = Expression.Property(parameter, nameof(ISoftDelete.IsActive));
    //                // expression: e.IsActive == true
    //                var condition = Expression.Equal(prop, Expression.Constant(true));
    //                var lambda = Expression.Lambda(condition, parameter);

    //                builder.Entity(clrType).HasQueryFilter(lambda);
    //            }
    //        }

    //        // ---------- Optional: Configure RowVersion for Student ----------
    //        builder.Entity<Student>()
    //            .Property(s => s.RowVersion)
    //            .IsRowVersion()
    //            .IsConcurrencyToken();
    //    }
    //}
}
