using Attendance.Data.Conext;
using Attendance.Data.Entities;
using Attendance.Web.Helpers;
using Attendance.Web.Hubs;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Web.Controllers
{
    // مسیر صریح برای جلوگیری از AmbiguousMatchException و مشخص کردن مسیرها
    [Route("Attendance/[action]")]
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
        // برمی‌گرداند JSON شامل لیست دانش‌آموزان برای پایه خواسته‌شده
        [HttpGet]
        public async Task<IActionResult> GetStudentsByGrade(string grade)
        {
            if (string.IsNullOrWhiteSpace(grade))
                return BadRequest("grade required");

            var students = await _db.Students
                .AsNoTracking()
                .Where(s => (s.Grade ?? "") == grade)
                .OrderBy(s => s.LastName)
                .Select(s => new
                {
                    id = s.Id,
                    firstName = s.FirstName,
                    lastName = s.LastName,
                    nationalCode = s.NationalCode,
                    photo = s.PhotoPath ?? "/uploads/students/default.png"
                })
                .ToListAsync();

            return Json(students);
        }

        // ---------- CreateSession (POST - non-ajax form submit) ----------
        // مسیر صریح: Attendance/CreateSession
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSession([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] int[] studentIds)
        {
            // این متد همان متدی است که برای فرم‌های معمولی (non-AJAX) ریدایرکت می‌کند
            try
            {
                if (string.IsNullOrWhiteSpace(title)) return BadRequest("title required");
                if (string.IsNullOrWhiteSpace(grade)) return BadRequest("grade required");

                DateTime sessionUtc = !string.IsNullOrWhiteSpace(dateShamsi)
                    ? (PersianDateConverter.ParseShamsiToUtc(dateShamsi) ?? DateTime.UtcNow)
                    : DateTime.UtcNow;

                var session = new AttendanceSession
                {
                    Title = title.Trim(),
                    SessionDate = sessionUtc,
                    Grade = grade,
                    CreatedBy = User?.Identity?.Name,
                    CreatedAt = DateTime.UtcNow
                };

                foreach (var sid in (studentIds ?? Array.Empty<int>()))
                {
                    session.Records.Add(new AttendanceRecord
                    {
                        StudentId = sid,
                        IsPresent = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }

                _db.AttendanceSessions.Add(session);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Attendance session {SessionId} created by {User} for grade {Grade} with {Count} students",
                    session.Id, User?.Identity?.Name, grade, session.Records.Count);

                // ارسال رویداد real-time (SignalR) - اگر نیاز دارید می‌توانید payload تنظیم شود
                try
                {
                    await _hub.Clients.All.SendAsync("AttendanceSessionCreated", new { id = session.Id, title = session.Title, grade = session.Grade });
                }
                catch (Exception exHub)
                {
                    _logger.LogWarning(exHub, "Failed to broadcast AttendanceSessionCreated for session {SessionId}", session.Id);
                }

                return RedirectToAction(nameof(SessionDetails), new { id = session.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating attendance session for grade {Grade} by {User}", grade, User?.Identity?.Name);
                TempData["ErrorMessage"] = "خطا در ایجاد جلسه حضور و غیاب.";
                return RedirectToAction(nameof(CreateWizard));
            }
        }

        // ---------- CreateSessionAjax (POST - AJAX) ----------
        // مخصوص درخواست‌های AJAX که توکن antiforgery را در هدر "RequestVerificationToken" می‌فرستند
        // اضافه کردن using های لازم در بالای فایل اگر نیست:
        // using Microsoft.AspNetCore.Hosting;
        // using Microsoft.Extensions.Logging;

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Route("Attendance/CreateSessionAjax")] // مطمئن می‌شویم مسیر یکتا باشد
        public async Task<IActionResult> CreateSessionAjax([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] int[]? studentIds)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(title))
                    return BadRequest(new { error = "عنوان جلسه الزامی است." });

                if (string.IsNullOrWhiteSpace(grade))
                    return BadRequest(new { error = "پایه الزامی است." });

                // Log دریافت پارامترها (برای دیباگ)
                _logger?.LogInformation("CreateSessionAjax called by {User}. grade={Grade}, countStudents={Count}",
                    User?.Identity?.Name ?? "anonymous",
                    grade,
                    (studentIds?.Length ?? 0));

                // تبدیل تاریخ شمسی اگر ارسال شده
                DateTime sessionUtc;
                if (!string.IsNullOrWhiteSpace(dateShamsi))
                {
                    var parsed = PersianDateConverter.ParseShamsiToUtc(dateShamsi);
                    sessionUtc = parsed ?? DateTime.UtcNow;
                }
                else
                {
                    sessionUtc = DateTime.UtcNow;
                }

                var session = new AttendanceSession
                {
                    Title = title.Trim(),
                    SessionDate = sessionUtc,
                    Grade = grade,
                    CreatedBy = User?.Identity?.Name,
                    CreatedAt = DateTime.UtcNow
                };

                // اگر studentIds null باشد، هیچ رکوردی اضافه نشود ولی اجازه می‌دهیم (یا می‌توانید BadRequest دهید)
                var ids = studentIds ?? Array.Empty<int>();
                foreach (var sid in ids)
                {
                    session.Records.Add(new AttendanceRecord
                    {
                        StudentId = sid,
                        IsPresent = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }

                _db.AttendanceSessions.Add(session);
                await _db.SaveChangesAsync();

                _logger?.LogInformation("Attendance session {SessionId} created by {User} for grade {Grade} with {Count} students",
                    session.Id, User?.Identity?.Name, grade, session.Records.Count);

                // برگرداندن JSON مناسب برای AJAX
                return Json(new { id = session.Id, message = "جلسه با موفقیت ایجاد شد." });
            }
            catch (Exception ex)
            {
                // لاگ کامل خطا
                _logger?.LogError(ex, "Error creating attendance session for grade {Grade} by {User}", grade, User?.Identity?.Name);

                // در حالت توسعه اجازه بدهیم جزئیات را ببینیم، وگرنه پیام عمومی برگردان
                var isDev = false;
                try
                {
                    // اگر کنترلر شما DI برای IWebHostEnvironment دارد:
                    var env = HttpContext.RequestServices.GetService(typeof(IWebHostEnvironment)) as IWebHostEnvironment;
                    isDev = env != null && env.IsDevelopment();
                }
                catch { /* ignore */ }

                if (isDev)
                {
                    return StatusCode(500, new { error = "خطا در ایجاد جلسه حضور و غیاب.", detail = ex.ToString() });
                }

                return StatusCode(500, new { error = "خطا در ایجاد جلسه حضور و غیاب." });
            }
        }


        // ---------- SessionDetails (GET) - ناظر بعد از ایجاد جلسه ----------
        [HttpGet]
        public async Task<IActionResult> SessionDetails(int id)
        {
            var session = await _db.AttendanceSessions
                .Include(s => s.Records)
                    .ThenInclude(r => r.Student)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);

            if (session == null) return NotFound();

            // ViewModel یا VM می‌توانید تعریف کنید؛ برای نمونه مدل مستقیم ارسال می‌شود
            return View(session);
        }

        // دیگر اکشن‌ها (در صورت نیاز)...
    }
}
