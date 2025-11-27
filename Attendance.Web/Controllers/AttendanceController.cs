using Attendance.Data.Conext;
using Attendance.Data.Entities;
using Attendance.Web.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Web.Controllers
{
    public class AttendanceController : Controller
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<AttendanceController> _logger;

        public AttendanceController(ApplicationDbContext db, ILogger<AttendanceController> logger)
        {
            _db = db;
            _logger = logger;
        }

        // ========== Wizard start: انتخاب پایه و دیدن لیست دانش آموزان ==========
        [HttpGet]
        public async Task<IActionResult> CreateWizard()
        {
            // لیست پایه‌ها را از Student استخراج کن و به ویو بده
            var grades = await _db.Students
                                  .AsNoTracking()
                                  .Where(s => !string.IsNullOrEmpty(s.Grade))
                                  .Select(s => s.Grade)
                                  .Distinct()
                                  .OrderBy(x => x)
                                  .ToListAsync();

            return View("CreateWizard", grades); // ویو CreateWizard.cshtml (در ادامه کد ویو)
        }

        // Endpoint برای گرفتن دانش‌آموزان یک پایه (AJAX)
        [HttpGet]
        public async Task<IActionResult> GetStudentsByGrade(string grade)
        {
            if (string.IsNullOrWhiteSpace(grade)) return BadRequest("grade required");

            var students = await _db.Students
                .AsNoTracking()
                .Where(s => s.Grade == grade)
                .OrderBy(s => s.LastName).ThenBy(s => s.FirstName)
                .Select(s => new {
                    id = s.Id,
                    firstName = s.FirstName,
                    lastName = s.LastName,
                    nationalCode = s.NationalCode,
                    photo = s.PhotoPath ?? "/uploads/students/default.png"
                })
                .ToListAsync();

            return Json(students);
        }

        // Create session + pre-create AttendanceRecord entries from selected student ids
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateSession([FromForm] string title, [FromForm] string dateShamsi, [FromForm] string grade, [FromForm] int[] studentIds)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(title)) return BadRequest("title required");
                if (string.IsNullOrWhiteSpace(grade)) return BadRequest("grade required");

                // تبدیل تاریخ شمسـی به UTC
                DateTime sessionUtc;
                if (!string.IsNullOrWhiteSpace(dateShamsi))
                {
                    sessionUtc = PersianDateConverter.ParseShamsiToUtc(dateShamsi) ?? DateTime.UtcNow;
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

                // اضافه کن رکوردهای حاضر/غایب را به صورت پیش‌فرض (IsPresent=false) ایجاد کن
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

                // بعد از ایجاد، هدایت به صفحه جزئیات جلسه جهت ثبت حضور/غیاب
                return RedirectToAction(nameof(SessionDetails), new { id = session.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating attendance session for grade {Grade} by {User}", grade, User?.Identity?.Name);
                TempData["ErrorMessage"] = "خطا در ایجاد جلسه حضور و غیاب.";
                return RedirectToAction("CreateWizard");
            }
        }

        // نمایش جزئیات جلسه و لیست دانش‌آموزان برای مارک زدن حاضر/غایب
        [HttpGet]
        public async Task<IActionResult> SessionDetails(int id)
        {
            var session = await _db.AttendanceSessions
                .Include(s => s.Records)
                    .ThenInclude(r => r.Student)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);

            if (session == null) return NotFound();

            return View("SessionDetails", session); // ویو SessionDetails.cshtml
        }

        // ذخیره‌سازی حضور/غیاب — دریافت آرایه‌ی ids و وضعیت پرزنت
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveSessionAttendance(int sessionId, [FromForm] int[] presentStudentIds)
        {
            try
            {
                var session = await _db.AttendanceSessions
                    .Include(s => s.Records)
                    .FirstOrDefaultAsync(s => s.Id == sessionId);

                if (session == null) return NotFound();

                // به‌روزرسانی رکوردها
                var presentSet = new HashSet<int>(presentStudentIds ?? Array.Empty<int>());

                foreach (var rec in session.Records)
                {
                    rec.IsPresent = presentSet.Contains(rec.StudentId);
                }

                await _db.SaveChangesAsync();

                _logger.LogInformation("Attendance saved for session {SessionId} by {User}", sessionId, User?.Identity?.Name);

                TempData["SuccessMessage"] = "حضور و غیاب با موفقیت ثبت شد.";
                return RedirectToAction(nameof(SessionDetails), new { id = sessionId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving attendance for session {SessionId} by {User}", sessionId, User?.Identity?.Name);
                TempData["ErrorMessage"] = "خطا در ذخیره حضور و غیاب.";
                return RedirectToAction(nameof(SessionDetails), new { id = sessionId });
            }
        }
    }
}
