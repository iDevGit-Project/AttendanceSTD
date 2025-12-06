using Attendance.Data.Conext;
using Attendance.Data.Entities;
using Attendance.Data.VModels.Attendances;
using Attendance.Web.Helpers;
using Attendance.Web.Hubs;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Attendance.Web.Controllers
{
    public class AttendanceController : Controller
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<AttendanceController> _logger;
        private readonly IHubContext<StudentsHub> _hub; // فرض بر این است که hub با این نام وجود دارد

        public AttendanceController(ApplicationDbContext db, ILogger<AttendanceController> logger, IHubContext<StudentsHub> hub)
        {
            _db = db;
            _logger = logger;
            _hub = hub;
        }

        // ---------- CreateWizard (GET) ----------
        [HttpGet]
        public async Task<IActionResult> CreateWizard()
        {
            // اگر نیاز به بارگذاری اطلاعات (مثلاً لیست پایه‌ها) هست
            var grades = await _db.Students
                .AsNoTracking()
                .Select(s => s.Grade ?? "")
                .Distinct()
                .OrderBy(g => g)
                .ToListAsync();

            ViewBag.Grades = new SelectList(grades);
            return View(); // View CreateWizard باید وجود داشته باشد
        }

        // ---------- GetStudentsByGrade (AJAX) ----------
        [HttpGet]
        public async Task<IActionResult> GetStudentsByGrade(string grade)
        {
            if (string.IsNullOrWhiteSpace(grade)) return BadRequest();

            var students = await _db.Students
                .Where(s => s.Grade == grade && s.IsActive)
                .Select(s => new {
                    id = s.Id,
                    firstName = s.FirstName,
                    lastName = s.LastName,
                    nationalCode = s.NationalCode ?? "",
                    photo = s.PhotoPath ?? "/uploads/students/default.png"
                })
                .AsNoTracking()
                .ToListAsync();

            return Json(students);
        }

        // POST Ajax version: create session and attendance records, return JSON
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSessionAjax([FromForm] string title,
                                                           [FromForm] string dateShamsi,
                                                           [FromForm] string grade,
                                                           [FromForm] string? location,
                                                           [FromForm] int[]? studentIds)
        {
            if (string.IsNullOrWhiteSpace(title))
                return BadRequest(new { error = "title required" });

            if (string.IsNullOrWhiteSpace(grade))
                return BadRequest(new { error = "grade required" });

            try
            {
                // تبدیل تاریخ شمسی به UTC (تابع شما)
                DateTime sessionUtc = PersianDateConverter.ParseShamsiToUtc(dateShamsi) ?? DateTime.UtcNow;

                // مپ به ستون‌های جدول فعلی: Date (date) و StartAt/EndAt (datetime2)
                var session = new AttendanceSession();

                // پر کردن فیلدهای متناظر با جدول فعلی (عنوان، تاریخ، زمان شروع/پایان، مکان)
                session.Title = title.Trim();

                // در جدول شما ستون "Date" از نوع date دارد — نگهداری فقط تاریخ
                session.Date = sessionUtc.Date;

                // همچنین StartAt/EndAt را برابر با لحظه sessionUtc قرار می‌دهیم (در صورت نیاز می‌توان اینها را متفاوت گرفت)
                session.StartAt = sessionUtc;
                session.EndAt = sessionUtc;

                // Location (ممکن است خالی باشد)
                session.Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();

                // تلاش برای mapping grade -> ClassId اگر جدول Classes داشته باشی با نام پایه برابر با grade
                if (!string.IsNullOrWhiteSpace(grade))
                {
                    var cls = await _db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Name == grade);
                    if (cls != null)
                    {
                        session.ClassId = cls.Id;
                    }
                    else
                    {
                        // اگر پیدا نشد، می‌توانیم grade را در Notes ذخیره کنیم یا اجازه دهیم ClassId null بماند.
                        session.Notes = $"GradeNameProvided:{grade}";
                    }
                }

                // CreatedById: اگر id کاربر در claim به صورت عددی باشد مقدار را تنظیم کن، در غیر این صورت null
                int? createdById = null;
                var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var parsedUserId))
                {
                    createdById = parsedUserId;
                    session.CreatedById = createdById;
                }
                else
                {
                    // اگر شما می‌خواهید نام کاربری را هم ذخیره کنید می‌شود session.Notes یا ستون دیگری قرار داد
                    // session.Notes = (session.Notes ?? "") + $" CreatedByName:{User?.Identity?.Name}";
                }

                session.CreatedAt = DateTime.UtcNow;

                // اضافه کردن رکوردهای حضور/غیاب اولیه (IsPresent = false)
                if (studentIds != null && studentIds.Length > 0)
                {
                    foreach (var sid in studentIds)
                    {
                        // validate student exists
                        var stExists = await _db.Students.AsNoTracking().AnyAsync(s => s.Id == sid);
                        if (!stExists) continue;

                        var rec = new AttendanceRecord
                        {
                            StudentId = sid,
                            IsPresent = false,
                            CreatedAt = DateTime.UtcNow
                        };
                        session.Records.Add(rec);
                    }
                }

                _db.AttendanceSessions.Add(session);
                await _db.SaveChangesAsync();

                _logger?.LogInformation("Attendance session {SessionId} created by {User} for grade {Grade} with {Count} students",
                    session.Id, User?.Identity?.Name ?? "anonymous", grade, session.Records?.Count ?? 0);

                return Json(new { id = session.Id, message = "جلسه با موفقیت ایجاد شد." });
            }
            catch (DbUpdateException dbex)
            {
                _logger?.LogError(dbex, "DB error creating attendance session for grade {Grade} by {User}", grade, User?.Identity?.Name);
                var inner = dbex.InnerException?.Message ?? dbex.Message;
                return StatusCode(500, new
                {
                    error = "خطا در ذخیره‌سازی جلسه (DB).",
                    dbMessage = dbex.Message,
                    inner = inner,
                    entries = dbex.Entries?.Select(e => new
                    {
                        type = e.Entity?.GetType().FullName,
                        state = e.State.ToString(),
                        values = e.CurrentValues?.ToObject()
                    }).ToArray()
                });
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error creating attendance session for grade {Grade} by {User}", grade, User?.Identity?.Name);
                return StatusCode(500, new { error = "خطا در ایجاد جلسه حضور و غیاب." });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSession([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] string? location, [FromForm] int[]? studentIds)
        {
            var result = await CreateSessionAjax(title, dateShamsi, grade, location, studentIds) as JsonResult;
            if (result == null) return RedirectToAction("CreateWizard");
            dynamic data = result.Value;
            if (data != null && data.id != null)
            {
                return RedirectToAction(nameof(SessionDetails), new { id = (int)data.id });
            }
            return RedirectToAction("CreateWizard");
        }

        [HttpGet]
        public async Task<IActionResult> SessionDetails(long id)
        {
            var session = await _db.AttendanceSessions
                .Include(s => s.Records)
                    .ThenInclude(r => r.Student)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (session == null)
                return NotFound();
            return View(session);
        }
    }
}
