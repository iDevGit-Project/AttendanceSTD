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
                // Id is long (bigint) by default if model uses long
                b.Property(x => x.Title).HasMaxLength(300).IsUnicode();
                b.Property(x => x.Location).HasMaxLength(200).IsUnicode();
                b.Property(x => x.Notes).HasMaxLength(2000).IsUnicode();

                // Map Date column explicitly to 'date' if you want (optional)
                b.Property(x => x.Date).HasColumnType("date");
                b.Property(x => x.StartAt).HasColumnType("datetime2");
                b.Property(x => x.EndAt).HasColumnType("datetime2");

                // CreatedAt non-nullable
                b.Property(x => x.CreatedAt).HasColumnType("datetime2").IsRequired();
            });

            // ---------- Student: Unique Index for NationalCode (فقط رکوردهای فعال) ----------
            modelBuilder.Entity<Student>()
                .HasIndex(s => s.NationalCode)
                .IsUnique()
                .HasFilter("[NationalCode] IS NOT NULL AND [IsActive] = 1");

            // ---------- AttendanceRecord mapping ----------
            modelBuilder.Entity<AttendanceRecord>(b =>
            {
                b.HasKey(x => x.Id);

                // IMPORTANT: Ensure AttendanceRecord.SessionId type matches AttendanceSession.Id (long)
                // If AttendanceRecord.SessionId type is long in the model, this mapping works.
                b.HasOne(r => r.Session)
                 .WithMany(s => s.Records)
                 .HasForeignKey(r => r.SessionId)
                 .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(r => r.Student)
                 .WithMany() // no navigation on Student side
                 .HasForeignKey(r => r.StudentId)
                 .OnDelete(DeleteBehavior.Restrict);

                // Map Status enum -> tinyint (byte) in DB and set default value properly
                // Assume you have an enum AttendanceStatus in Attendance.Data.Entities
                b.Property(r => r.Status)
                 .HasConversion<byte>()        // enum <-> byte
                 .HasColumnType("tinyint")     // store as tinyint in SQL Server
                 .HasDefaultValue((byte)AttendanceStatus.Absent); // cast enum to byte

                // LateMinutes optional
                b.Property(r => r.LateMinutes).HasColumnType("int").IsRequired(false);

                b.Property(r => r.Note).HasMaxLength(1000).IsUnicode().IsRequired(false);

                b.Property(r => r.CreatedAt).HasColumnType("datetime2").IsRequired();
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

            // ---------- Map Student date columns and PaymentStatus ----------
            modelBuilder.Entity<Student>(entity =>
            {
                entity.Property(e => e.BirthDate)
                      .HasColumnType("datetime2");

                entity.Property(e => e.EntryDate)
                      .HasColumnType("datetime2");

                entity.Property(e => e.PaymentStatus)
                      .HasConversion<byte>()
                      .HasColumnType("tinyint")
                      .HasDefaultValue((byte)PaymentStatus.Unpaid);

                entity.Property(e => e.WorkgroupName)
                      .HasMaxLength(200);
            });
        }
    }
}
