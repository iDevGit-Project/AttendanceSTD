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
using System.Text.Json;

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

        // ----------  POST Ajax version: create session and attendance records, return JSON ----------
        // ---------------- CreateSessionAjax ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSessionAjax([FromForm] string title,
                                                           [FromForm] string dateShamsi,
                                                           [FromForm] string grade,
                                                           [FromForm] string? location,
                                                           [FromForm] string? startTime, // optional "HH:mm"
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

                // ایجاد نمونه جدید و نگاشت به ستون‌های جدول شما
                var session = new AttendanceSession();

                session.Title = title.Trim();

                // جدول شما ستون Date از نوع date دارد - فقط تاریخ را ذخیره می‌کنیم
                session.Date = sessionUtc.Date;

                // اگر startTime ارسال شده باشد، آن را parse کن و StartAt را تنظیم کن (UTC)
                if (!string.IsNullOrWhiteSpace(startTime))
                {
                    // انتظار فرمت "HH:mm"
                    if (TimeSpan.TryParse(startTime, out var ts))
                    {
                        // ساخت یک DateTime بر پایه تاریخ sessionUtc + زمان ts
                        var startLocal = new DateTime(sessionUtc.Year, sessionUtc.Month, sessionUtc.Day, ts.Hours, ts.Minutes, 0, DateTimeKind.Utc);
                        session.StartAt = startLocal;
                    }
                    else
                    {
                        // اگر parse نشد، می‌توانیم نادیده بگیریم یا لاگ کنیم
                        _logger?.LogWarning("CreateSessionAjax: unable to parse startTime='{StartTime}'", startTime);
                    }
                }

                // (اختیاری) EndAt را همان StartAt قرار می‌دهیم یا null
                session.EndAt = null;

                // location
                session.Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();

                // تلاش برای نگاشت grade -> ClassId اگر جدول Classes دارید
                if (!string.IsNullOrWhiteSpace(grade))
                {
                    var cls = await _db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Name == grade);
                    if (cls != null)
                    {
                        session.ClassId = cls.Id;
                    }
                    else
                    {
                        // اگر کلاس پیدا نشد می‌توانیم در Notes ثبت کنیم (اختیاری)
                        session.Notes = (session.Notes ?? "") + $"GradeProvided:{grade}";
                    }
                }

                // CreatedById از Claim (اگر id عددی باشد)
                int? createdById = null;
                var userIdClaim = User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var parsedUserId))
                {
                    createdById = parsedUserId;
                    session.CreatedById = createdById;
                }
                session.CreatedAt = DateTime.UtcNow;

                // اضافه کردن رکوردهای اولیه با Status = Absent (یا مقدار پیشفرض شما)
                if (studentIds != null && studentIds.Length > 0)
                {
                    foreach (var sid in studentIds)
                    {
                        // اعتبارسنجی ساده: وجود دانش‌آموز
                        var exists = await _db.Students.AsNoTracking().AnyAsync(s => s.Id == sid);
                        if (!exists) continue;

                        var rec = new AttendanceRecord
                        {
                            // توجه: SessionId را EF بعد از افزودن session و SaveChanges مقداردهی می‌کند
                            StudentId = sid,
                            Status = AttendanceStatus.Absent, // مقدار پیش‌فرض: غایب
                            LateMinutes = null,
                            Note = null,
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


        // ---------------- SaveAttendance ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveAttendance([FromForm] long sessionId)
        {
            _logger?.LogInformation("SaveAttendance called for sessionId={SessionId} by {User}", sessionId, User?.Identity?.Name);

            if (sessionId <= 0) return BadRequest(new { error = "sessionId نامعتبر است." });

            var form = Request.HasFormContentType ? Request.Form : null;
            if (form == null)
                return BadRequest(new { error = "داده‌ای ارسال نشده است." });

            var recordsValues = new List<string>();

            if (form.TryGetValue("records[]", out var arr1) && arr1.Count > 0)
                recordsValues.AddRange(arr1.ToArray());

            else if (form.TryGetValue("records", out var arr2) && arr2.Count > 0)
            {
                if (arr2.Count == 1 && arr2[0].TrimStart().StartsWith("["))
                    recordsValues.Add(arr2[0]);
                else
                    recordsValues.AddRange(arr2.ToArray());
            }
            else
            {
                foreach (var k in form.Keys)
                    if (k.StartsWith("records", StringComparison.OrdinalIgnoreCase))
                        recordsValues.AddRange(form[k].ToArray());
            }

            if (!recordsValues.Any())
                return BadRequest(new { error = "هیچ رکوردی ارسال نشده است." });

            List<RecordDto> payload;

            try
            {
                if (recordsValues.Count == 1 && recordsValues[0].TrimStart().StartsWith("["))
                {
                    payload = JsonSerializer.Deserialize<List<RecordDto>>(recordsValues[0],
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<RecordDto>();
                }
                else
                {
                    payload = new List<RecordDto>();
                    foreach (var rv in recordsValues)
                    {
                        if (string.IsNullOrWhiteSpace(rv)) continue;
                        var dto = JsonSerializer.Deserialize<RecordDto>(rv,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (dto != null) payload.Add(dto);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "SaveAttendance: invalid JSON for records");
                return BadRequest(new { error = "فرمت رکوردها نامعتبر است." });
            }

            var session = await _db.AttendanceSessions
                                   .Include(s => s.Records)
                                   .FirstOrDefaultAsync(s => s.Id == sessionId);

            if (session == null)
                return NotFound(new { error = "جلسه پیدا نشد." });

            try
            {
                foreach (var dto in payload)
                {
                    if (dto.recordId.HasValue)
                    {
                        var rec = session.Records.FirstOrDefault(r => r.Id == dto.recordId.Value);
                        if (rec != null)
                        {
                            rec.Status = Enum.IsDefined(typeof(AttendanceStatus), dto.status)
                                ? (AttendanceStatus)dto.status
                                : AttendanceStatus.Absent;

                            rec.Note = dto.note;
                            rec.LateMinutes = dto.lateMinutes;
                        }
                    }
                    else
                    {
                        session.Records.Add(new AttendanceRecord
                        {
                            StudentId = dto.studentId,
                            Status = Enum.IsDefined(typeof(AttendanceStatus), dto.status)
                                ? (AttendanceStatus)dto.status
                                : AttendanceStatus.Absent,
                            Note = dto.note,
                            LateMinutes = dto.lateMinutes,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                await _db.SaveChangesAsync();
                return Ok(new { message = "حضور/غیاب ذخیره شد" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "خطای غیرمنتظره در ذخیره‌سازی" });
            }
        }
        public class RecordDto
        {
            public int? recordId { get; set; }    // اگر رکورد موجود است
            public int studentId { get; set; }    // id دانش‌آموز
            public int status { get; set; }       // 1=Present,2=Absent,3=Late,4=Excused (مطابق enum شما)
            public string? note { get; set; }
            public int? lateMinutes { get; set; } // در صورت تأخیر مقدار دقیقه
        }

        //[HttpPost]
        //[ValidateAntiForgeryToken]
        //public async Task<IActionResult> SaveAttendance([FromForm] long sessionId)
        //{
        //    _logger?.LogInformation("SaveAttendance called for sessionId={SessionId} by {User}", sessionId, User?.Identity?.Name);

        //    if (sessionId <= 0) return BadRequest(new { error = "sessionId نامعتبر است." });

        //    // دریافت مقادیر رکوردها از فرم (پشتیبانی از چند مقدار records[] یا یک مقدار حاوی JSON array)
        //    var form = Request.HasFormContentType ? Request.Form : null;
        //    if (form == null)
        //    {
        //        _logger?.LogWarning("SaveAttendance: no form data");
        //        return BadRequest(new { error = "داده‌ای از کلاینت ارسال نشده است." });
        //    }

        //    // تلاش برای خواندن همه کلیدهای ممکن
        //    var recordsValues = new List<string>();
        //    if (form.TryGetValue("records[]", out var arr1) && arr1.Count > 0)
        //    {
        //        recordsValues.AddRange(arr1.ToArray());
        //    }
        //    else if (form.TryGetValue("records", out var arr2) && arr2.Count > 0)
        //    {
        //        // ممکن است یک رشته JSON آرایه باشد یا چند مقدار مجزا
        //        if (arr2.Count == 1 && arr2[0].TrimStart().StartsWith("["))
        //        {
        //            // یک JSON آرایه در یک رشته
        //            recordsValues.Add(arr2[0]);
        //        }
        //        else
        //        {
        //            recordsValues.AddRange(arr2.ToArray());
        //        }
        //    }
        //    else
        //    {
        //        // ممکن است JS نام متفاوتی استفاده کرده باشد؛ بررسی کلیدها
        //        foreach (var k in form.Keys)
        //        {
        //            if (k.StartsWith("records", StringComparison.OrdinalIgnoreCase))
        //            {
        //                recordsValues.AddRange(form[k].ToArray());
        //            }
        //        }
        //    }

        //    if (!recordsValues.Any())
        //    {
        //        _logger?.LogWarning("SaveAttendance: no records payload");
        //        return BadRequest(new { error = "هیچ رکوردی ارسال نشده است." });
        //    }

        //    // DTO محلی
        //    List<RecordDto> payload;
        //    try
        //    {
        //        // اگر اولین عنصر یک JSON آرایه است (single string) -> parse آن
        //        if (recordsValues.Count == 1 && recordsValues[0].TrimStart().StartsWith("["))
        //        {
        //            payload = System.Text.Json.JsonSerializer.Deserialize<List<RecordDto>>(recordsValues[0],
        //                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<RecordDto>();
        //        }
        //        else
        //        {
        //            // هر عنصر را به صورت JSON جداگانه parse کن
        //            payload = new List<RecordDto>();
        //            foreach (var rv in recordsValues)
        //            {
        //                if (string.IsNullOrWhiteSpace(rv)) continue;
        //                var dto = System.Text.Json.JsonSerializer.Deserialize<RecordDto>(rv,
        //                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        //                if (dto != null) payload.Add(dto);
        //            }
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger?.LogError(ex, "SaveAttendance: invalid JSON for records");
        //        return BadRequest(new { error = "فرمت رکوردها نامعتبر است." });
        //    }

        //    var session = await _db.AttendanceSessions
        //                           .Include(s => s.Records)
        //                           .FirstOrDefaultAsync(s => s.Id == sessionId);

        //    if (session == null)
        //    {
        //        _logger?.LogWarning("SaveAttendance: session not found id={SessionId}", sessionId);
        //        return NotFound(new { error = "جلسه پیدا نشد." });
        //    }

        //    try
        //    {
        //        foreach (var dto in payload)
        //        {
        //            // اگر recordId داده شده، رکورد موجود را آپدیت کن
        //            if (dto.recordId.HasValue)
        //            {
        //                var rec = session.Records.FirstOrDefault(r => r.Id == dto.recordId.Value);
        //                if (rec != null)
        //                {
        //                    // وضعیت جدید (تبدیل از int به enum)
        //                    if (Enum.IsDefined(typeof(AttendanceStatus), dto.status))
        //                        rec.Status = (AttendanceStatus)dto.status;
        //                    else
        //                        rec.Status = AttendanceStatus.Absent; // fallback

        //                    rec.Note = dto.note;
        //                    rec.LateMinutes = dto.lateMinutes;
        //                    // (در صورت نیاز می‌توانید فیلدهای دیگر را هم به‌روز کنید)
        //                }
        //                else
        //                {
        //                    // رکوردی با آن id پیدا نشد - می‌توانیم لاگ کنیم یا یک رکورد جدید بسازیم
        //                    _logger?.LogWarning("SaveAttendance: record id {RecordId} not found in session {SessionId}", dto.recordId, sessionId);
        //                }
        //            }
        //            else
        //            {
        //                // اضافه کردن رکورد جدید
        //                var newRec = new AttendanceRecord
        //                {
        //                    StudentId = dto.studentId,
        //                    Status = Enum.IsDefined(typeof(AttendanceStatus), dto.status) ? (AttendanceStatus)dto.status : AttendanceStatus.Absent,
        //                    Note = dto.note,
        //                    LateMinutes = dto.lateMinutes,
        //                    CreatedAt = DateTime.UtcNow
        //                };
        //                session.Records.Add(newRec);
        //            }
        //        }

        //        await _db.SaveChangesAsync();
        //        _logger?.LogInformation("SaveAttendance: saved {Count} records for session {SessionId} by {User}", payload.Count, sessionId, User?.Identity?.Name);
        //        return Ok(new { message = "حضور/غیاب ذخیره شد" });
        //    }
        //    catch (DbUpdateException dex)
        //    {
        //        _logger?.LogError(dex, "Error saving attendance for session {SessionId}", sessionId);
        //        return StatusCode(500, new { error = "خطا در ذخیره‌سازی", details = dex.Message });
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger?.LogError(ex, "Unexpected error saving attendance for session {SessionId}", sessionId);
        //        return StatusCode(500, new { error = "خطای غیرمنتظره در ذخیره‌سازی" });
        //    }
        //}

        // DTO مورد استفاده در SaveAttendance

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSession([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] string? startTime, [FromForm] string? location, [FromForm] int[]? studentIds)
        {
            var result = await CreateSessionAjax(title, dateShamsi, grade, location, startTime, studentIds) as JsonResult;
            if (result == null) return RedirectToAction("CreateWizard");
            dynamic data = result.Value;
            if (data != null && data.id != null)
            {
                return RedirectToAction(nameof(SessionDetails), new { id = (int)data.id });
            }
            return RedirectToAction("CreateWizard");
        }

        // ----------  GET SessionDetails ----------
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

        // ----------  POST SaveAttendance ----------
        //[HttpPost]
        //[ValidateAntiForgeryToken]
        //public async Task<IActionResult> SaveAttendance([FromForm] long sessionId, [FromForm] string records)
        //{
        //    _logger.LogInformation("SaveAttendance called for sessionId={SessionId}", sessionId);

        //    if (sessionId <= 0) return BadRequest("sessionId نامعتبر است.");
        //    if (string.IsNullOrWhiteSpace(records)) return BadRequest("هیچ رکوردی ارسال نشده است.");

        //    List<RecordDto> payload;
        //    try
        //    {
        //        payload = System.Text.Json.JsonSerializer.Deserialize<List<RecordDto>>(records,
        //            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<RecordDto>();
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "SaveAttendance: invalid JSON for records");
        //        return BadRequest("فرمت رکوردها نامعتبر است.");
        //    }

        //    var session = await _db.AttendanceSessions
        //                           .Include(s => s.Records)
        //                           .FirstOrDefaultAsync(s => s.Id == sessionId);

        //    if (session == null) return NotFound("جلسه پیدا نشد.");

        //    try
        //    {
        //        foreach (var dto in payload)
        //        {
        //            if (dto.recordId.HasValue)
        //            {
        //                var rec = session.Records.FirstOrDefault(r => r.Id == dto.recordId.Value);
        //                if (rec != null)
        //                {
        //                    rec.Status = (AttendanceStatus)dto.status; // enum mapping
        //                    rec.LateMinutes = dto.lateMinutes;
        //                    rec.Note = dto.note;
        //                }
        //            }
        //            else
        //            {
        //                // new record (if studentId present)
        //                if (dto.studentId <= 0) continue;
        //                var newRec = new AttendanceRecord
        //                {
        //                    StudentId = dto.studentId,
        //                    Status = (AttendanceStatus)dto.status,
        //                    LateMinutes = dto.lateMinutes,
        //                    Note = dto.note,
        //                    CreatedAt = DateTime.UtcNow
        //                };
        //                session.Records.Add(newRec);
        //            }
        //        }

        //        await _db.SaveChangesAsync();
        //        return Ok(new { message = "حضور/غیاب ذخیره شد" });
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "Error saving attendance for session {SessionId}", sessionId);
        //        return StatusCode(500, new { error = "خطا در ذخیره‌سازی" });
        //    }
        //}

        // DTO

        // ----------  POST ArchiveSession ----------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ArchiveSession([FromForm] long id)
        {
            var s = await _db.AttendanceSessions.FindAsync(id);
            if (s == null) return NotFound(new { error = "جلسه پیدا نشد." });
            s.DeletedAt = DateTime.UtcNow;
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var uid)) s.DeletedById = uid;
            await _db.SaveChangesAsync();
            return Ok(new { message = "جلسه آرشیو شد." });
        }

        // ----------  POST RestoreSession ----------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RestoreSession([FromForm] long id)
        {
            var s = await _db.AttendanceSessions.FindAsync(id);
            if (s == null) return NotFound(new { error = "جلسه پیدا نشد." });
            s.DeletedAt = null;
            s.DeletedById = null;
            await _db.SaveChangesAsync();
            return Ok(new { message = "جلسه بازیابی شد." });
        }

    }
}
