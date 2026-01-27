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
                b.HasKey(x => x.Id);
                b.Property(x => x.Title).HasMaxLength(300).IsUnicode();
                b.Property(x => x.Location).HasMaxLength(200).IsUnicode();
                b.Property(x => x.Notes).HasMaxLength(2000).IsUnicode();

                b.Property(x => x.Date).HasColumnType("date");
                b.Property(x => x.StartAt).HasColumnType("datetime2");
                b.Property(x => x.EndAt).HasColumnType("datetime2");

                b.Property(x => x.CreatedAt).HasColumnType("datetime2").IsRequired();
            });

            // ---------- Student: Unique Index for NationalCode ----------
            modelBuilder.Entity<Student>()
                .HasIndex(s => s.NationalCode)
                .IsUnique()
                .HasFilter("[NationalCode] IS NOT NULL AND [IsActive] = 1");

            // ---------- AttendanceRecord mapping ----------
            modelBuilder.Entity<AttendanceRecord>(b =>
            {
                b.HasKey(x => x.Id);

                // توجه: SessionId باید با نوع PK AttendanceSession.Id سازگار باشد (long)
                b.HasOne(r => r.Session)
                 .WithMany(s => s.Records)
                 .HasForeignKey(r => r.SessionId)
                 .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(r => r.Student)
                 .WithMany()
                 .HasForeignKey(r => r.StudentId)
                 .OnDelete(DeleteBehavior.Restrict);

                // نگاشت enum -> tinyint (provider) و مقدار پیش‌فرض به صورت enum (CLR)
                b.Property(r => r.Status)
                 .HasConversion<byte>()
                 .HasColumnType("tinyint")
                 .HasDefaultValue(AttendanceStatus.Absent); // <- مقدار از نوع enum (نه byte)

                b.Property(r => r.LateMinutes).HasColumnType("int").IsRequired(false);
                b.Property(r => r.Note).HasMaxLength(1000).IsUnicode().IsRequired(false);
                b.Property(r => r.CreatedAt).HasColumnType("datetime2").IsRequired();
            });

            // ---------- Student mapping (PaymentStatus fix here) ----------
            modelBuilder.Entity<Student>(entity =>
            {
                entity.Property(e => e.BirthDate)
                      .HasColumnType("datetime2");

                entity.Property(e => e.EntryDate)
                      .HasColumnType("datetime2");

                // نگاشت enum PaymentStatus -> tinyint
                entity.Property(e => e.PaymentStatus)
                      .HasConversion<byte>()
                      .HasColumnType("tinyint")
                      .HasDefaultValue(PaymentStatus.Unpaid); // <-- مهم: مقدار enum (CLR) نه byte

                entity.Property(e => e.WorkgroupName)
                      .HasMaxLength(200);
            });

            // --------- Global Query Filter for Soft Delete ----------
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
        }
    }
}
