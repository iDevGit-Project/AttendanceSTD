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

                // نصیحت: اطلاعات داخلی exception را به‌صورت کامل به کاربر نده — ولی برای دیباگ شما JSON جزئیات را برمی‌گردانید.
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

        // (اختیاری) نسخه non-ajax اگر خواستی با redirect
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSession([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] string? location, [FromForm] int[]? studentIds)
        {
            // این متد مثل CreateSessionAjax عمل می‌کند اما به جای بازگرداندن JSON کاربر را redirect می‌کند.
            // برای اختصار از همان لاجیک بالا استفاده کن (یا آن را فراخوانی کن).
            // در اینجا فقط یک نمونه ساده:
            var result = await CreateSessionAjax(title, dateShamsi, grade, location, studentIds) as JsonResult;
            if (result == null) return RedirectToAction("CreateWizard");
            dynamic data = result.Value;
            if (data != null && data.id != null)
            {
                return RedirectToAction(nameof(SessionDetails), new { id = (int)data.id });
            }
            return RedirectToAction("CreateWizard");
        }

        //[HttpPost]
        //[ValidateAntiForgeryToken]
        //public async Task<IActionResult> CreateSessionAjax([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] int[]? studentIds)
        //{
        //    try
        //    {
        //        if (string.IsNullOrWhiteSpace(title)) return BadRequest(new { error = "عنوان جلسه الزامی است." });
        //        if (string.IsNullOrWhiteSpace(grade)) return BadRequest(new { error = "پایه الزامی است." });

        //        var ids = (studentIds ?? Array.Empty<int>()).Where(i => i > 0).Distinct().ToArray();

        //        _logger?.LogInformation("CreateSessionAjax: user={User}, grade={Grade}, count={Count}, ids={Ids}",
        //            User?.Identity?.Name ?? "anonymous", grade, ids.Length, string.Join(",", ids));

        //        // verify students exist
        //        if (ids.Length > 0)
        //        {
        //            var existing = await _db.Students.AsNoTracking().Where(s => ids.Contains(s.Id)).Select(s => s.Id).ToListAsync();
        //            var missing = ids.Except(existing).ToArray();
        //            if (missing.Any())
        //            {
        //                _logger?.LogWarning("CreateSessionAjax: missing student ids: {Missing}", string.Join(",", missing));
        //                return BadRequest(new { error = "برخی شناسه‌های دانش‌آموز یافت نشدند.", missing });
        //            }
        //        }

        //        // convert shamsi
        //        DateTime sessionUtc = DateTime.UtcNow;
        //        if (!string.IsNullOrWhiteSpace(dateShamsi))
        //        {
        //            var parsed = PersianDateConverter.ParseShamsiToUtc(dateShamsi);
        //            if (parsed.HasValue) sessionUtc = parsed.Value;
        //            else _logger?.LogWarning("CreateSessionAjax: could not parse dateShamsi='{DateShamsi}'", dateShamsi);
        //        }

        //        // fallback values to avoid NOT NULL DB errors
        //        var creator = User?.Identity?.Name ?? "system";
        //        var session = new AttendanceSession
        //        {
        //            Title = title.Trim(),
        //            SessionDate = sessionUtc,
        //            Grade = grade,
        //            CreatedBy = creator,    // <-- set fallback instead of null
        //            CreatedAt = DateTime.UtcNow,
        //            Location = "",          // <-- ensure not-null if DB expects it
        //            Records = new List<AttendanceRecord>()
        //        };

        //        foreach (var sid in ids)
        //        {
        //            session.Records.Add(new AttendanceRecord
        //            {
        //                StudentId = sid,
        //                IsPresent = false,
        //                CreatedAt = DateTime.UtcNow
        //            });
        //        }

        //        _db.AttendanceSessions.Add(session);

        //        try
        //        {
        //            await _db.SaveChangesAsync();
        //            _logger?.LogInformation("CreateSessionAjax: created session {SessionId} by {User}", session.Id, creator);
        //            return Json(new { id = session.Id, message = "جلسه با موفقیت ایجاد شد." });
        //        }
        //        catch (DbUpdateException dbex)
        //        {
        //            _logger?.LogError(dbex, "CreateSessionAjax: DbUpdateException creating session. grade={Grade}", grade);

        //            // include inner exception text to help debugging (in dev)
        //            var inner = dbex.InnerException?.Message;
        //            var entriesInfo = dbex.Entries?.Select(en => new {
        //                Type = en.Entity?.GetType().FullName,
        //                State = en.State.ToString(),
        //                Values = en.CurrentValues?.Properties.ToDictionary(p => p.Name, p => en.CurrentValues[p.Name])
        //            }).ToList();

        //            var env = HttpContext.RequestServices.GetService(typeof(IWebHostEnvironment)) as IWebHostEnvironment;
        //            var isDev = env != null && env.IsDevelopment();

        //            if (isDev)
        //            {
        //                return StatusCode(500, new { error = "خطا در ذخیره‌سازی جلسه (DB).", dbMessage = dbex.Message, inner, entries = entriesInfo });
        //            }

        //            return StatusCode(500, new { error = "خطا در ذخیره‌سازی جلسه (DB)." });
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger?.LogError(ex, "CreateSessionAjax: unexpected error while creating session for grade {Grade}", grade);
        //        var env = HttpContext.RequestServices.GetService(typeof(IWebHostEnvironment)) as IWebHostEnvironment;
        //        var isDev = env != null && env.IsDevelopment();
        //        if (isDev) return StatusCode(500, new { error = "خطا در ایجاد جلسه حضور و غیاب.", detail = ex.ToString() });
        //        return StatusCode(500, new { error = "خطا در ایجاد جلسه حضور و غیاب." });
        //    }
        //}

        // ---------- SessionDetails (GET) - ناظر بعد از ایجاد جلسه ----------
        // AttendanceController.cs (یا فایل مربوط)
        // مسیردهی صریح برای اطمینان از تطابق URL
        // using های لازم در بالای فایل controller:
        // using Microsoft.EntityFrameworkCore;

        [HttpGet] // conventional route: /Attendance/SessionDetails/{id}
        public async Task<IActionResult> SessionDetails(long id)
        {
            var session = await _db.AttendanceSessions
                .Include(s => s.Records)
                    .ThenInclude(r => r.Student)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (session == null)
                return NotFound();

            // ⚠ این خط باعث می‌شد View لود نشود:
            // return Content($"SessionDetailsDiagnostic2: found session id={session.Id}, title={session.Title}");

            // ✔ نسخه صحیح:
            return View(session);
        }

        //public async Task<IActionResult> SessionDetails(long id)
        //{
        //    _logger?.LogInformation("SessionDetails called with id={Id}", id);

        //    var session = await _db.AttendanceSessions
        //                           .AsNoTracking()
        //                           .Include(s => s.Records)
        //                              .ThenInclude(r => r.Student)
        //                           .FirstOrDefaultAsync(s => s.Id == id);

        //    if (session == null)
        //    {
        //        _logger?.LogWarning("SessionDetails: session not found id={Id}", id);
        //        return NotFound(); // 404 — این حالت قبلاً داشتی
        //    }

        //    // اگر می‌خواهی از ViewModel استفاده کنی میتوانی اینجا مپ کنی.
        //    // برای سرعت و سادگی ما مستقیم مدل را پاس می‌کنیم:
        //    return View(session);
        //}


        // Diagnostic test - paste into any controller class (e.g. HomeController) and rebuild
        [HttpGet("/Attendance/SessionDetails/diagnostic/{id:long}")]
        public IActionResult SessionDetailsDiagnostic(long id)
        {
            // quick check that routing and controller pipeline work for this URL
            return Content($"DIAGNOSTIC OK - reached SessionDetailsDiagnostic with id={id}");
        }

        // داخل کلاس AttendanceController (همان‌جایی که بقیه اکشن‌ها قرار دارند)
        [HttpGet("/Attendance/SessionDetails/{id:long}")]
        public async Task<IActionResult> SessionDetailsDiagnostic2(long id)
        {
            _logger?.LogInformation("SessionDetailsDiagnostic2 hit with id={Id}", id);
            // تلاش برای پیدا کردن سشن (برای تشخیص اینکه DB و mapping درست است یا خیر)
            var session = await _db.AttendanceSessions
                                   .Include(s => s.Records)
                                   .ThenInclude(r => r.Student)
                                   .AsNoTracking()
                                   .FirstOrDefaultAsync(s => s.Id == id);

            if (session == null)
            {
                // برای تست موقت، اگر پیدا نشد فقط نشان ده که مچ شده اما داده نیست
                return Content($"SessionDetailsDiagnostic2: route matched but session not found for id={id}");
            }

            // اگر پیدا شد، فقط یک متن ساده برگردان تا ببینی اطلاعات دریافت شده
            return Content($"SessionDetailsDiagnostic2: found session id={session.Id}, title={session.Title ?? "(no title)"}");
        }


        //[HttpGet]
        //public async Task<IActionResult> SessionDetails(long id)
        //{
        //    // خواندن جلسه به همراه رکوردها و دانش‌آموزان مرتبط
        //    var session = await _db.AttendanceSessions
        //                           .Include(s => s.Records)
        //                              .ThenInclude(r => r.Student)
        //                           .AsNoTracking()
        //                           .FirstOrDefaultAsync(s => s.Id == id);

        //    if (session == null)
        //    {
        //        TempData["ErrorMessage"] = "جلسه مورد نظر یافت نشد.";
        //        return RedirectToAction(nameof(Index));
        //    }

        //    // نگاشت به ViewModel ساده
        //    var vm = new SessionDetailsViewModel
        //    {
        //        Id = session.Id,
        //        Title = session.Title,
        //        Date = session.Date,
        //        StartAt = session.StartAt,
        //        EndAt = session.EndAt,
        //        Location = session.Location,
        //        CreatedAt = session.CreatedAt,
        //        Records = session.Records.Select(r => new AttendanceRecordItem
        //        {
        //            Id = r.Id,
        //            StudentId = r.StudentId,
        //            StudentName = r.Student != null ? $"{r.Student.FirstName} {r.Student.LastName}" : "—",
        //            StudentPhoto = r.Student?.PhotoPath ?? "/uploads/students/default.png",
        //            IsPresent = r.IsPresent,
        //            Note = r.Note
        //        }).OrderBy(x => x.StudentName).ToList()
        //    };

        //    return View(vm); // Views/Attendance/SessionDetails.cshtml
        //}
    }
}
