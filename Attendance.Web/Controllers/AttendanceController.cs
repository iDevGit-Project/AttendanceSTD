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
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSessionAjax([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] int[]? studentIds)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(title)) return BadRequest(new { error = "عنوان جلسه الزامی است." });
                if (string.IsNullOrWhiteSpace(grade)) return BadRequest(new { error = "پایه الزامی است." });

                var ids = (studentIds ?? Array.Empty<int>()).Where(i => i > 0).Distinct().ToArray();

                _logger?.LogInformation("CreateSessionAjax: user={User}, grade={Grade}, count={Count}, ids={Ids}",
                    User?.Identity?.Name ?? "anonymous", grade, ids.Length, string.Join(",", ids));

                // verify students exist
                if (ids.Length > 0)
                {
                    var existing = await _db.Students.AsNoTracking().Where(s => ids.Contains(s.Id)).Select(s => s.Id).ToListAsync();
                    var missing = ids.Except(existing).ToArray();
                    if (missing.Any())
                    {
                        _logger?.LogWarning("CreateSessionAjax: missing student ids: {Missing}", string.Join(",", missing));
                        return BadRequest(new { error = "برخی شناسه‌های دانش‌آموز یافت نشدند.", missing });
                    }
                }

                // convert shamsi
                DateTime sessionUtc = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(dateShamsi))
                {
                    var parsed = PersianDateConverter.ParseShamsiToUtc(dateShamsi);
                    if (parsed.HasValue) sessionUtc = parsed.Value;
                    else _logger?.LogWarning("CreateSessionAjax: could not parse dateShamsi='{DateShamsi}'", dateShamsi);
                }

                // fallback values to avoid NOT NULL DB errors
                var creator = User?.Identity?.Name ?? "system";
                var session = new AttendanceSession
                {
                    Title = title.Trim(),
                    SessionDate = sessionUtc,
                    Grade = grade,
                    CreatedBy = creator,    // <-- set fallback instead of null
                    CreatedAt = DateTime.UtcNow,
                    Location = "",          // <-- ensure not-null if DB expects it
                    Records = new List<AttendanceRecord>()
                };

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

                try
                {
                    await _db.SaveChangesAsync();
                    _logger?.LogInformation("CreateSessionAjax: created session {SessionId} by {User}", session.Id, creator);
                    return Json(new { id = session.Id, message = "جلسه با موفقیت ایجاد شد." });
                }
                catch (DbUpdateException dbex)
                {
                    _logger?.LogError(dbex, "CreateSessionAjax: DbUpdateException creating session. grade={Grade}", grade);

                    // include inner exception text to help debugging (in dev)
                    var inner = dbex.InnerException?.Message;
                    var entriesInfo = dbex.Entries?.Select(en => new {
                        Type = en.Entity?.GetType().FullName,
                        State = en.State.ToString(),
                        Values = en.CurrentValues?.Properties.ToDictionary(p => p.Name, p => en.CurrentValues[p.Name])
                    }).ToList();

                    var env = HttpContext.RequestServices.GetService(typeof(IWebHostEnvironment)) as IWebHostEnvironment;
                    var isDev = env != null && env.IsDevelopment();

                    if (isDev)
                    {
                        return StatusCode(500, new { error = "خطا در ذخیره‌سازی جلسه (DB).", dbMessage = dbex.Message, inner, entries = entriesInfo });
                    }

                    return StatusCode(500, new { error = "خطا در ذخیره‌سازی جلسه (DB)." });
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "CreateSessionAjax: unexpected error while creating session for grade {Grade}", grade);
                var env = HttpContext.RequestServices.GetService(typeof(IWebHostEnvironment)) as IWebHostEnvironment;
                var isDev = env != null && env.IsDevelopment();
                if (isDev) return StatusCode(500, new { error = "خطا در ایجاد جلسه حضور و غیاب.", detail = ex.ToString() });
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
