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
        public DbSet<AttendanceSession> AttendanceSessions { get; set; } = null!;
        public DbSet<AttendanceRecord> AttendanceRecords { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ---------- AttendanceSession mapping ----------
            modelBuilder.Entity<AttendanceSession>(b =>
            {
                // PK: bigint -> long
                b.HasKey(x => x.Id);

                // Title nvarchar(250) or 300 based on prior settings — رعایت محدودیت
                b.Property(x => x.Title).HasMaxLength(250).IsUnicode(true);

                // Date column in DB is "Date" (type = date)
                b.Property(x => x.Date)
                 .HasColumnName("Date")
                 .HasColumnType("date");

                // StartAt / EndAt as datetime2 (nullable)
                b.Property(x => x.StartAt).HasColumnType("datetime2");
                b.Property(x => x.EndAt).HasColumnType("datetime2");

                // ClassId is simple int? (no FK configured here unless you want)
                // Location nvarchar(200)
                b.Property(x => x.Location).HasMaxLength(200).IsUnicode(true);

                // Audit columns (CreatedById, CreatedAt, ModifiedById, ModifiedAt, DeletedById, DeletedAt)
                b.Property(x => x.CreatedById);
                b.Property(x => x.CreatedAt).HasColumnType("datetime2").IsRequired();
                b.Property(x => x.ModifiedById);
                b.Property(x => x.ModifiedAt).HasColumnType("datetime2");
                b.Property(x => x.DeletedById);
                b.Property(x => x.DeletedAt).HasColumnType("datetime2");

                // Notes nvarchar(2000)
                b.Property(x => x.Notes).HasMaxLength(2000).IsUnicode(true);
            });

            // ---------- Student: Unique Index for NationalCode (unchanged) ----------
            modelBuilder.Entity<Student>()
                .HasIndex(s => s.NationalCode)
                .IsUnique()
                .HasFilter("[NationalCode] IS NOT NULL AND [IsActive] = 1");

            // ---------- AttendanceRecord mapping ----------
            modelBuilder.Entity<AttendanceRecord>(b =>
            {
                b.HasKey(x => x.Id);

                // FK -> AttendanceSession.Id (long/bigint)
                b.HasOne(r => r.Session)
                 .WithMany(s => s.Records)
                 .HasForeignKey(r => r.SessionId)
                 .OnDelete(DeleteBehavior.Cascade);

                // Student FK (keep as before)
                b.HasOne(r => r.Student)
                 .WithMany() // no inverse navigation on Student by design
                 .HasForeignKey(r => r.StudentId)
                 .OnDelete(DeleteBehavior.Restrict);

                b.Property(r => r.CreatedAt).HasColumnType("datetime2").IsRequired();
                b.Property(r => r.Note).HasMaxLength(1000).IsUnicode(true);
            });

            // --------- Global Query Filter for Soft Delete (unchanged) ----------
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var clrType = entityType.ClrType;
                if (typeof(ISoftDelete).IsAssignableFrom(clrType))
                {
                    var parameter = Expression.Parameter(clrType, "e");
                    var prop = Expression.Property(parameter, nameof(ISoftDelete.IsActive));
                    var condition = Expression.Equal(prop, Expression.Constant(true));
                    var lambda = Expression.Lambda(condition, parameter);

                    modelBuilder.Entity(clrType).HasQueryFilter(lambda);
                }
            }

            // ---------- Optional: Configure RowVersion for Student ----------
            modelBuilder.Entity<Student>()
                .Property(s => s.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            // ---------- Map Student date columns and PaymentStatus (unchanged) ----------
            modelBuilder.Entity<Student>(entity =>
            {
                entity.Property(e => e.BirthDate).HasColumnType("datetime2");
                entity.Property(e => e.EntryDate).HasColumnType("datetime2");

                entity.Property(e => e.PaymentStatus)
                      .HasConversion<byte>()
                      .HasColumnType("tinyint")
                      .HasDefaultValue(PaymentStatus.Unpaid);

                entity.Property(e => e.WorkgroupName).HasMaxLength(200);
            });
        }
    }
    //public class ApplicationDbContext : IdentityDbContext
    //{
    //    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    //    public DbSet<Student> Students { get; set; } = null!;
    //    public DbSet<Teacher> Teachers { get; set; } = null!;
    //    public DbSet<Class> Classes { get; set; } = null!;
    //    public DbSet<AttendanceSession> AttendanceSessions { get; set; }
    //    public DbSet<AttendanceRecord> AttendanceRecords { get; set; }

    //    protected override void OnModelCreating(ModelBuilder modelBuilder)
    //    {
    //        base.OnModelCreating(modelBuilder);

    //        // ---------- Student: Unique Index for NationalCode (فقط رکوردهای فعال) ----------
    //        modelBuilder.Entity<AttendanceSession>(b =>
    //        {
    //            b.HasKey(x => x.Id);
    //            b.Property(x => x.Title).HasMaxLength(300);
    //            b.Property(x => x.Location).HasMaxLength(200);
    //            b.Property(x => x.Grade).HasMaxLength(50);
    //        });
    //        // توجه: HasFilter برای SQL Server نوشته شده (براکت دور ستون‌ها)
    //        modelBuilder.Entity<Student>()
    //            .HasIndex(s => s.NationalCode)
    //            .IsUnique()
    //            .HasFilter("[NationalCode] IS NOT NULL AND [IsActive] = 1");


    //        modelBuilder.Entity<AttendanceRecord>(b =>
    //        {
    //            b.HasKey(x => x.Id);

    //            b.HasOne(r => r.Session)
    //             .WithMany(s => s.Records)
    //             .HasForeignKey(r => r.SessionId)
    //             .OnDelete(DeleteBehavior.Cascade);

    //            b.HasOne(r => r.Student)
    //             .WithMany() // اگر خواستید رابطه معکوس اضافه کنید می‌توانیم Student.Records اضافه کنیم اما شما گفتید Student دست نخورَد
    //             .HasForeignKey(r => r.StudentId)
    //             .OnDelete(DeleteBehavior.Restrict);
    //        });

    //        // --------- Global Query Filter for Soft Delete ----------
    //        // برای همه Entity هایی که ISoftDelete را پیاده‌سازی کرده‌اند
    //        // به طور پیش‌فرض فقط رکوردهای IsActive == true نمایش داده شوند
    //        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
    //        {
    //            var clrType = entityType.ClrType;
    //            if (typeof(ISoftDelete).IsAssignableFrom(clrType))
    //            {
    //                var parameter = Expression.Parameter(clrType, "e");
    //                var prop = Expression.Property(parameter, nameof(ISoftDelete.IsActive));
    //                var condition = Expression.Equal(prop, Expression.Constant(true));
    //                var lambda = Expression.Lambda(condition, parameter);

    //                modelBuilder.Entity(clrType).HasQueryFilter(lambda);
    //            }
    //        }

    //        // ---------- Optional: Configure RowVersion for Student ----------
    //        modelBuilder.Entity<Student>()
    //            .Property(s => s.RowVersion)
    //            .IsRowVersion()
    //            .IsConcurrencyToken();

    //        // ---------- NEW: Map Student date columns and PaymentStatus ----------
    //        modelBuilder.Entity<Student>(entity =>
    //        {
    //            // BirthDate: store as datetime2 (nullable)
    //            entity.Property(e => e.BirthDate)
    //                  .HasColumnType("datetime2");

    //            // EntryDate: store as datetime2 (nullable)
    //            entity.Property(e => e.EntryDate)
    //                  .HasColumnType("datetime2");

    //            // PaymentStatus: store enum as tinyint (byte)
    //            // ensures compact storage and predictable mapping
    //            entity.Property(e => e.PaymentStatus)
    //                  .HasConversion<byte>()               // تبدیل enum -> byte برای ذخیره در DB
    //                  .HasColumnType("tinyint")            // نگاشت نوع ستون در SQL Server
    //                  .HasDefaultValue(PaymentStatus.Unpaid); // مقدار پیش‌فرض به صورت enum (نه byte)

    //            // (اختیاری) طول نام کارگروه را صریح می‌کنیم اگر لازم باشه
    //            entity.Property(e => e.WorkgroupName)
    //                  .HasMaxLength(200);
    //        });
    //    }
    //}
}
