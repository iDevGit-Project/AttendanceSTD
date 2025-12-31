using Attendance.Data.Conext;
using Attendance.Data.Entities;
using Attendance.Data.VModels.ArchivedSess;
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

        // ---------- GetSessionsStats for view total (GET) ----------
        [HttpGet]
        public async Task<IActionResult> GetSessionsStats()
        {
            var query = _db.AttendanceSessions.AsNoTracking();

            var total = await query.CountAsync();

            var active = await query.CountAsync(x => x.DeletedAt == null);
            var archived = await query.CountAsync(x => x.DeletedAt != null);

            var vm = new SessionsStatsViewModel
            {
                TotalSessions = total,
                ActiveSessions = active,
                ArchivedSessions = archived
            };

            return Json(vm);
        }

        // ---------- AttendanceReportByDate for Shamsi Date To Date(GET) ----------
        [HttpGet]
        public async Task<IActionResult> AttendanceReportByDate( DateTime? from, DateTime? to)
        {
            var vm = new AttendanceReportByDateVm
            {
                From = from,
                To = to,
                Records = new List<AttendanceReportItemVm>()
            };

            if (from.HasValue && to.HasValue)
            {
                var list =
                    await _db.AttendanceRecords
                        .Include(r => r.Student)
                        .Include(r => r.Session)
                        .Where(r =>
                            r.Session.Date >= from.Value &&
                            r.Session.Date <= to.Value
                        )
                        .AsNoTracking()
                        .ToListAsync();

                vm.Records = list.Select(r => new AttendanceReportItemVm
                {
                    StudentName =
                        (r.Student.FirstName + " " + r.Student.LastName),
                    Photo = r.Student.PhotoPath,
                    Status = r.Status,
                    LateMinutes = r.LateMinutes
                }).ToList();
            }

            return View(vm);
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

        // ---------- GET - GetGrades ----------
        [HttpGet]
        public async Task<IActionResult> GetGrades()
        {
            var grades = await _db.Students
                .Where(s => s.Grade != null && s.Grade != "")
                .Select(s => s.Grade)
                .Distinct()
                .OrderBy(g => g)
                .ToListAsync();

            return Json(grades);
        }


        // ---------- GET - GetAllStudents ----------
        [HttpGet]
        public async Task<IActionResult> GetAllStudents()
        {
            var students = await _db.Students
                .OrderBy(s => s.Grade)
                .ThenBy(s => s.LastName)
                .Select(s => new
                {
                    id = s.Id,
                    firstName = s.FirstName,
                    lastName = s.LastName,
                    grade = s.Grade,
                    nationalCode = s.NationalCode,
                    photo = s.PhotoPath
                })
                .ToListAsync();

            return Json(students);
        }

        [HttpGet]
        public async Task<IActionResult> AllSessions(int page = 1, int pageSize = 5, string? search = null)
        {
            if (page < 1) page = 1;
            var allowed = new[] { 5, 10, 25, 50 };
            if (!allowed.Contains(pageSize)) pageSize = 5;

            var query = _db.AttendanceSessions.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(x => (x.Title ?? "").Contains(s) || (x.Location ?? "").Contains(s));
            }

            var total = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(total / (double)pageSize);
            if (totalPages == 0) totalPages = 1;
            if (page > totalPages) page = totalPages;

            var list = await query
                .OrderByDescending(x => x.Date ?? x.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Include(s => s.Records) // برای شمارش رکوردها
                .ToListAsync();

            var vm = new SessionsIndexViewModel
            {
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = totalPages,
                Search = search,
                Sessions = list.Select(x => new SessionListItemVm
                {
                    Id = x.Id,
                    Title = x.Title,
                    Date = x.Date,
                    DateShamsi = x.Date.HasValue ? PersianDateConverter.ToShamsiString(x.Date.Value) : null,
                    DeletedAt = x.DeletedAt,
                    DeletedAtShamsi = x.DeletedAt.HasValue ? PersianDateConverter.ToShamsiString(x.DeletedAt.Value) : null,
                    Location = x.Location,
                    RecordsCount = x.Records?.Count ?? 0
                }).ToList()
            };

            return View(vm); // Views/Attendance/AllSessions.cshtml
        }

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
        public async Task<IActionResult> SaveAttendance()
        {
            _logger?.LogInformation(
                "SaveAttendance called by {User}",
                User?.Identity?.Name
            );

            // ---------------- دریافت Form ----------------
            if (!Request.HasFormContentType)
            {
                _logger?.LogWarning("SaveAttendance: no form data");
                return BadRequest(new { error = "داده‌ای از کلاینت ارسال نشده است." });
            }

            var form = Request.Form;

            // ---------------- sessionId ----------------
            if (!form.TryGetValue("sessionId", out var sidVal) ||
                !long.TryParse(sidVal.FirstOrDefault(), out var sessionId) ||
                sessionId <= 0)
            {
                _logger?.LogWarning("SaveAttendance: invalid sessionId");
                return BadRequest(new { error = "sessionId نامعتبر است." });
            }

            // ---------------- دریافت records ----------------
            var recordsValues = new List<string>();

            if (form.TryGetValue("records[]", out var arr1) && arr1.Count > 0)
            {
                recordsValues.AddRange(arr1.ToArray());
            }
            else if (form.TryGetValue("records", out var arr2) && arr2.Count > 0)
            {
                if (arr2.Count == 1 && arr2[0].TrimStart().StartsWith("["))
                    recordsValues.Add(arr2[0]);
                else
                    recordsValues.AddRange(arr2.ToArray());
            }
            else
            {
                foreach (var key in form.Keys)
                {
                    if (key.StartsWith("records", StringComparison.OrdinalIgnoreCase))
                        recordsValues.AddRange(form[key].ToArray());
                }
            }

            if (!recordsValues.Any())
            {
                _logger?.LogWarning("SaveAttendance: no records payload");
                return BadRequest(new { error = "هیچ رکوردی ارسال نشده است." });
            }

            // ---------------- Deserialize ----------------
            List<RecordDto> payload;
            try
            {
                if (recordsValues.Count == 1 &&
                    recordsValues[0].TrimStart().StartsWith("["))
                {
                    payload =
                        System.Text.Json.JsonSerializer.Deserialize<List<RecordDto>>(
                            recordsValues[0],
                            new System.Text.Json.JsonSerializerOptions
                            {
                                PropertyNameCaseInsensitive = true
                            }
                        ) ?? new List<RecordDto>();
                }
                else
                {
                    payload = new List<RecordDto>();

                    foreach (var rv in recordsValues)
                    {
                        if (string.IsNullOrWhiteSpace(rv))
                            continue;

                        var dto =
                            System.Text.Json.JsonSerializer.Deserialize<RecordDto>(
                                rv,
                                new System.Text.Json.JsonSerializerOptions
                                {
                                    PropertyNameCaseInsensitive = true
                                }
                            );

                        if (dto != null)
                            payload.Add(dto);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "SaveAttendance: invalid JSON payload");
                return BadRequest(new { error = "فرمت رکوردها نامعتبر است." });
            }

            // ---------------- دریافت Session ----------------
            var session =
                await _db.AttendanceSessions
                         .Include(s => s.Records)
                         .FirstOrDefaultAsync(s => s.Id == sessionId);

            if (session == null)
            {
                _logger?.LogWarning(
                    "SaveAttendance: session not found id={SessionId}",
                    sessionId
                );
                return NotFound(new { error = "جلسه پیدا نشد." });
            }

            // ---------------- ذخیره ----------------
            try
            {
                foreach (var dto in payload)
                {
                    AttendanceStatus finalStatus;
                    int? finalLateMinutes = null;

                    // ---------- وضعیت ----------
                    if (dto.status.HasValue &&
                        Enum.IsDefined(typeof(AttendanceStatus), (byte)dto.status.Value))
                    {
                        finalStatus = (AttendanceStatus)dto.status.Value;

                        // ⭐ فقط اگر واقعاً Late باشد، مقدار تأخیر ذخیره می‌شود
                        if (finalStatus == AttendanceStatus.Late)
                        {
                            finalLateMinutes = dto.lateMinutes;
                        }
                    }
                    else
                    {
                        // وضعیت انتخاب نشده یا نامعتبر
                        finalStatus = AttendanceStatus.Present;
                        finalLateMinutes = null;
                    }

                    // ---------- Update / Insert ----------
                    if (dto.recordId.HasValue)
                    {
                        var rec =
                            session.Records.FirstOrDefault(
                                r => r.Id == dto.recordId.Value
                            );

                        if (rec != null)
                        {
                            rec.Status = finalStatus;
                            rec.Note = dto.note;
                            rec.LateMinutes = finalLateMinutes;
                        }
                    }
                    else
                    {
                        session.Records.Add(
                            new AttendanceRecord
                            {
                                StudentId = dto.studentId,
                                Status = finalStatus,
                                Note = dto.note,
                                LateMinutes = finalLateMinutes,
                                CreatedAt = DateTime.UtcNow
                            }
                        );
                    }
                }

                await _db.SaveChangesAsync();

                return Ok(new { message = "حضور/غیاب ذخیره شد" });
            }
            catch (DbUpdateException dex)
            {
                _logger?.LogError(dex, "SaveAttendance: db error");
                return StatusCode(500, new { error = "خطا در ذخیره‌سازی" });
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "SaveAttendance: unexpected error");
                return StatusCode(500, new { error = "خطای غیرمنتظره", message = ex.Message });
            }
        }

        //[HttpPost]
        //[ValidateAntiForgeryToken]
        //public async Task<IActionResult> SaveAttendance()
        //{
        //    _logger?.LogInformation(
        //        "SaveAttendance called by {User}",
        //        User?.Identity?.Name
        //    );

        //    // ---------------- دریافت Form ----------------
        //    var form = Request.HasFormContentType ? Request.Form : null;
        //    if (form == null)
        //    {
        //        _logger?.LogWarning("SaveAttendance: no form data");
        //        return BadRequest(new { error = "داده‌ای از کلاینت ارسال نشده است." });
        //    }

        //    // ---------------- sessionId ----------------
        //    if (!form.TryGetValue("sessionId", out var sidVal) ||
        //        !long.TryParse(sidVal.FirstOrDefault(), out var sessionId) ||
        //        sessionId <= 0)
        //    {
        //        _logger?.LogWarning("SaveAttendance: invalid sessionId");
        //        return BadRequest(new { error = "sessionId نامعتبر است." });
        //    }

        //    _logger?.LogInformation(
        //        "SaveAttendance for sessionId={SessionId}",
        //        sessionId
        //    );

        //    // ---------------- دریافت records ----------------
        //    var recordsValues = new List<string>();

        //    if (form.TryGetValue("records[]", out var arr1) && arr1.Count > 0)
        //    {
        //        recordsValues.AddRange(arr1.ToArray());
        //    }
        //    else if (form.TryGetValue("records", out var arr2) && arr2.Count > 0)
        //    {
        //        if (arr2.Count == 1 && arr2[0].TrimStart().StartsWith("["))
        //            recordsValues.Add(arr2[0]);
        //        else
        //            recordsValues.AddRange(arr2.ToArray());
        //    }
        //    else
        //    {
        //        foreach (var key in form.Keys)
        //        {
        //            if (key.StartsWith("records", StringComparison.OrdinalIgnoreCase))
        //                recordsValues.AddRange(form[key].ToArray());
        //        }
        //    }

        //    if (!recordsValues.Any())
        //    {
        //        _logger?.LogWarning("SaveAttendance: no records payload");
        //        return BadRequest(new { error = "هیچ رکوردی ارسال نشده است." });
        //    }

        //    // ---------------- Deserialize ----------------
        //    List<RecordDto> payload;
        //    try
        //    {
        //        if (recordsValues.Count == 1 &&
        //            recordsValues[0].TrimStart().StartsWith("["))
        //        {
        //            payload =
        //                System.Text.Json.JsonSerializer.Deserialize<List<RecordDto>>(
        //                    recordsValues[0],
        //                    new System.Text.Json.JsonSerializerOptions
        //                    {
        //                        PropertyNameCaseInsensitive = true
        //                    }
        //                ) ?? new List<RecordDto>();
        //        }
        //        else
        //        {
        //            payload = new List<RecordDto>();

        //            foreach (var rv in recordsValues)
        //            {
        //                if (string.IsNullOrWhiteSpace(rv))
        //                    continue;

        //                var dto =
        //                    System.Text.Json.JsonSerializer.Deserialize<RecordDto>(
        //                        rv,
        //                        new System.Text.Json.JsonSerializerOptions
        //                        {
        //                            PropertyNameCaseInsensitive = true
        //                        }
        //                    );

        //                if (dto != null)
        //                    payload.Add(dto);
        //            }
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger?.LogError(ex, "SaveAttendance: invalid JSON payload");
        //        return BadRequest(new { error = "فرمت رکوردها نامعتبر است." });
        //    }

        //    // ---------------- دریافت Session ----------------
        //    var session =
        //        await _db.AttendanceSessions
        //                 .Include(s => s.Records)
        //                 .FirstOrDefaultAsync(s => s.Id == sessionId);

        //    if (session == null)
        //    {
        //        _logger?.LogWarning(
        //            "SaveAttendance: session not found id={SessionId}",
        //            sessionId
        //        );
        //        return NotFound(new { error = "جلسه پیدا نشد." });
        //    }

        //    // ---------------- ذخیره ----------------
        //    try
        //    {
        //        foreach (var dto in payload)
        //        {
        //            byte statusByte = 0;
        //            bool statusValid;

        //            try
        //            {
        //                statusByte = Convert.ToByte(dto.status);
        //                statusValid = Enum.IsDefined(typeof(AttendanceStatus), statusByte);
        //            }
        //            catch
        //            {
        //                statusValid = false;
        //            }

        //            AttendanceStatus finalStatus;
        //            int? finalLateMinutes;

        //            // ---- منطق اصلی ----
        //            if (!statusValid)
        //            {
        //                finalStatus = AttendanceStatus.Late;
        //                finalLateMinutes = 60;
        //            }
        //            else
        //            {
        //                finalStatus = (AttendanceStatus)statusByte;

        //                if (finalStatus == AttendanceStatus.Late)
        //                {
        //                    finalLateMinutes =
        //                        dto.lateMinutes.HasValue && dto.lateMinutes > 0
        //                            ? dto.lateMinutes
        //                            : 60;
        //                }
        //                else
        //                {
        //                    finalLateMinutes = null;
        //                }
        //            }

        //            // ---- Update / Insert ----
        //            if (dto.recordId.HasValue)
        //            {
        //                var rec =
        //                    session.Records.FirstOrDefault(
        //                        r => r.Id == dto.recordId.Value
        //                    );

        //                if (rec != null)
        //                {
        //                    rec.Status = finalStatus;
        //                    rec.Note = dto.note;
        //                    rec.LateMinutes = finalLateMinutes;
        //                }
        //                else
        //                {
        //                    _logger?.LogWarning(
        //                        "SaveAttendance: record id {RecordId} not found in session {SessionId}",
        //                        dto.recordId,
        //                        sessionId
        //                    );
        //                }
        //            }
        //            else
        //            {
        //                session.Records.Add(
        //                    new AttendanceRecord
        //                    {
        //                        StudentId = dto.studentId,
        //                        Status = finalStatus,
        //                        Note = dto.note,
        //                        LateMinutes = finalLateMinutes,
        //                        CreatedAt = DateTime.UtcNow
        //                    }
        //                );
        //            }
        //        }

        //        await _db.SaveChangesAsync();

        //        _logger?.LogInformation(
        //            "SaveAttendance: saved {Count} records for session {SessionId}",
        //            payload.Count,
        //            sessionId
        //        );

        //        return Ok(new { message = "حضور/غیاب ذخیره شد" });
        //    }
        //    catch (DbUpdateException dex)
        //    {
        //        _logger?.LogError(
        //            dex,
        //            "SaveAttendance: db error for session {SessionId}",
        //            sessionId
        //        );

        //        return StatusCode(
        //            500,
        //            new { error = "خطا در ذخیره‌سازی", details = dex.Message }
        //        );
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger?.LogError(
        //            ex,
        //            "SaveAttendance: unexpected error for session {SessionId}",
        //            sessionId
        //        );

        //        return StatusCode(
        //            500,
        //            new
        //            {
        //                error = "خطای غیرمنتظره در ذخیره‌سازی",
        //                message = ex.Message,
        //                inner = ex.InnerException?.Message
        //            }
        //        );
        //    }
        //}
        public class RecordDto
        {
            public int? recordId { get; set; }
            public int studentId { get; set; }
            public int? status { get; set; } // در زمانی که کاربر گزینه ای رو انتخاب نکرده باشد میبایست به صورت پیش فرض قرارگیرد
            public string? note { get; set; }
            public int? lateMinutes { get; set; }
        }

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
            _logger?.LogInformation("SessionDetails called (diagnostic) for id={Id} by {User}", id, User?.Identity?.Name);

            // 1) بارگذاری شیء جلسه (بدون Include برای جلوگیری از مشکلات mapping)
            var session = await _db.AttendanceSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);

            if (session == null)
            {
                _logger?.LogWarning("SessionDetails: session not found id={Id}", id);
                return NotFound();
            }

            // 2) بارگذاری صریح رکوردها از جدول AttendanceRecords
            var records = await _db.AttendanceRecords
                .AsNoTracking()
                .Where(r => r.SessionId == id)
                .Include(r => r.Student)
                .OrderBy(r => r.Student != null ? r.Student.LastName : "") // مرتب‌سازی اختیاری
                .ToListAsync();

            _logger?.LogInformation("SessionDetails: loaded {Count} records for session {Id}", records.Count, id);

            // 3) مطمئن شو session.Records قابل مقداردهی است (در مدل باید ICollection باشد)
            session.Records = records;

            return View(session);
        }

        // ---------------- Archive / Unarchive (AJAX) ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ArchiveSessionAjax([FromForm] long id)
        {
            if (id <= 0) return BadRequest(new { error = "شناسه نامعتبر است." });

            try
            {
                var session = await _db.AttendanceSessions.FirstOrDefaultAsync(s => s.Id == id);
                if (session == null) return NotFound(new { error = "جلسه پیدا نشد." });

                if (session.DeletedAt.HasValue)
                {
                    // already archived
                    return BadRequest(new { error = "جلسه از قبل بایگانی شده است." });
                }

                // set DeletedAt / DeletedById (از claim تلاش کن id عددی بگیری)
                session.DeletedAt = DateTime.UtcNow;
                var userIdClaim = User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var parsedId))
                    session.DeletedById = parsedId;
                else
                    session.DeletedById = null;

                await _db.SaveChangesAsync();

                _logger?.LogInformation("Attendance session {SessionId} archived by {User}", id, User?.Identity?.Name);
                return Json(new { ok = true, message = "جلسه بایگانی شد." });
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error archiving session {SessionId}", id);
                return StatusCode(500, new { error = "خطا در بایگانی جلسه." });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UnarchiveSessionAjax([FromForm] long id)
        {
            if (id <= 0) return BadRequest(new { error = "شناسه نامعتبر است." });

            try
            {
                var session = await _db.AttendanceSessions.FirstOrDefaultAsync(s => s.Id == id);
                if (session == null) return NotFound(new { error = "جلسه پیدا نشد." });

                if (!session.DeletedAt.HasValue)
                {
                    return BadRequest(new { error = "جلسه در حالت بایگانی نیست." });
                }

                session.DeletedAt = null;
                session.DeletedById = null;
                await _db.SaveChangesAsync();

                _logger?.LogInformation("Attendance session {SessionId} unarchived by {User}", id, User?.Identity?.Name);
                return Json(new { ok = true, message = "جلسه از بایگانی خارج شد." });
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error unarchiving session {SessionId}", id);
                return StatusCode(500, new { error = "خطا در بازگردانی جلسه." });
            }
        }

        // ---------------- Archived list (View) ----------------
        [HttpGet]
        public async Task<IActionResult> ArchivedSessions(string? search = null, int page = 1, int pageSize = 20)
        {
            // filter sessions that have DeletedAt not null (آرشیو شده)
            var q = _db.AttendanceSessions.AsNoTracking().Where(s => s.DeletedAt != null);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(x => (x.Title ?? "").Contains(s) || (x.Location ?? "").Contains(s));
            }

            var total = await q.CountAsync();
            var items = await q.OrderByDescending(x => x.DeletedAt)
                               .Skip((page - 1) * pageSize)
                               .Take(pageSize)
                               .ToListAsync();

            // lightweight VM for view (you can expand)
            var vm = new ArchivedSessionsViewModel
            {
                Sessions = items,
                Page = page,
                PageSize = pageSize,
                Total = total,
                Search = search
            };

            return View(vm);
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
