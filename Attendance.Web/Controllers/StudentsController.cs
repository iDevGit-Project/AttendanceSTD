using Attendance.Data.Conext;
using Attendance.Data.Entities;
using Attendance.Data.VModels;
using Attendance.Data.VModels.Students;
using Attendance.Web.Helpers;
using Attendance.Web.Hubs;
using Attendance.Web.Services;
using Attendance.Web.Tools;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Text.Json;

namespace Attendance.Web.Controllers
{
    public class StudentsController : Controller
    {
        private readonly ApplicationDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<StudentsController> _logger;
        private readonly IHubContext<StudentsHub> _hub; // StudentsHub: نام Hub شما

        public StudentsController(
            ApplicationDbContext db,
            IWebHostEnvironment env,
            ILogger<StudentsController> logger,
            IHubContext<StudentsHub> hub)
        {
            _db = db;
            _env = env;
            _logger = logger;
            _hub = hub;
        }

        public async Task<IActionResult> Index(int page = 1, int pageSize = 5, string? search = null)
        {
            if (page < 1) page = 1;
            var allowedPageSizes = new[] { 5, 10, 25, 50 };
            if (!allowedPageSizes.Contains(pageSize)) pageSize = 5;

            // پایه query (برای لیست واقعی که نمایش می‌دهی)
            var query = _db.Students.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                query = query.Where(s =>
                    s.FirstName.Contains(q) ||
                    s.LastName.Contains(q) ||
                    (s.NationalCode ?? "").Contains(q)
                );
            }

            // ===== آمار واقعی از کل دیتابیس (نادیده گرفتن فیلترهای سراسری) =====
            var totalStudents = await _db.Students.IgnoreQueryFilters().CountAsync();
            var inactiveStudents = await _db.Students.IgnoreQueryFilters().CountAsync(s => !s.IsActive);
            // ActiveStudents را ست نکن؛ در ViewModel محاسبه می‌شود.

            // صفحه‌بندی برای نمایش لیست (با احترام به search)
            var totalPages = (int)Math.Ceiling(totalStudents / (double)pageSize);
            if (totalPages == 0) totalPages = 1;
            if (page > totalPages) page = totalPages;

            var pageEntities = await query
                .Include(s => s.Class)
                .OrderBy(s => s.LastName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            var students = pageEntities.Select(s => new StudentListItemViewModel
            {
                Id = s.Id,
                Photo = s.PhotoPath ?? "/uploads/students/default.png",
                FirstName = s.FirstName,
                LastName = s.LastName,
                NationalCode = s.NationalCode,
                Grade = s.Grade,
                SchoolName = s.SchoolName,
                CoachName = s.CoachName,
                IsActive = s.IsActive,
                InactiveReason = s.InactiveReason,
                ClassId = s.ClassId,
                ClassName = s.Class != null ? s.Class.Name : "",
                PaymentStatus = s.PaymentStatus,
                EntryDateShamsi = PersianDateConverter.ToShamsiString(s.EntryDate),
                BirthDateShamsi = PersianDateConverter.ToShamsiString(s.BirthDate),
                WorkgroupName = s.WorkgroupName,
                ConsentForm = s.ConsentForm,
                StudentInterviewForm = s.StudentInterviewForm,
                ParentInterviewForm = s.ParentInterviewForm,
                TalentTest = s.TalentTest,
                PsychologyForm = s.PsychologyForm,
                IQTest = s.IQTest,
                WarkTest = s.WarkTest
            }).ToList();

            var vm = new StudentsIndexViewModel
            {
                Students = students,
                TotalStudents = totalStudents,
                InactiveStudents = inactiveStudents,
                Page = page,
                PageSize = pageSize,
                TotalPages = totalPages,
                Search = search
            };

            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return PartialView("Index", vm);
            }

            return View(vm);
        }

        [HttpGet]
        public async Task<IActionResult> ListPaged(int page = 1, int pageSize = 5)
        {
            var totalCount = await _db.Students.CountAsync();
            var inactiveCount = await _db.Students.CountAsync(s => !s.IsActive);

            var entities = await _db.Students
                .Include(s => s.Class)
                .OrderBy(s => s.LastName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            var students = entities.Select(s => new StudentListItemViewModel
            {
                Id = s.Id,
                Photo = s.PhotoPath ?? "/uploads/students/default.png",
                FirstName = s.FirstName,
                LastName = s.LastName,
                NationalCode = s.NationalCode,
                Grade = s.Grade,
                SchoolName = s.SchoolName,
                CoachName = s.CoachName,
                IsActive = s.IsActive,
                InactiveReason = s.InactiveReason,
                ClassId = s.ClassId,
                ClassName = s.Class != null ? s.Class.Name : "",
                PaymentStatus = s.PaymentStatus,
                EntryDateShamsi = PersianDateConverter.ToShamsiString(s.EntryDate),
                BirthDateShamsi = PersianDateConverter.ToShamsiString(s.BirthDate)
            }).ToList();

            return Json(new
            {
                total = totalCount,
                inactive = inactiveCount,
                students
            });
        }

        public async Task<IActionResult> Archive()
        {
            var entities = await _db.Students
                            .IgnoreQueryFilters()
                            .Where(s => !s.IsActive)
                            .AsNoTracking()
                            .Include(s => s.Class)
                            .OrderByDescending(s => s.DeletedAt)
                            .ToListAsync();

            var students = entities.Select(s => new StudentListItemViewModel
            {
                Id = s.Id,
                Photo = s.PhotoPath ?? "/uploads/students/default.png",
                FirstName = s.FirstName,
                LastName = s.LastName,
                NationalCode = s.NationalCode,
                Grade = s.Grade,
                SchoolName = s.SchoolName,
                CoachName = s.CoachName,
                IsActive = s.IsActive,
                InactiveReason = s.InactiveReason,
                ClassId = s.ClassId,
                ClassName = s.Class != null ? s.Class.Name : "",
                PaymentStatus = s.PaymentStatus,
                EntryDateShamsi = PersianDateConverter.ToShamsiString(s.EntryDate),
                BirthDateShamsi = PersianDateConverter.ToShamsiString(s.BirthDate)
            }).ToList();

            return View("Archive", students);
        }

        public async Task<IActionResult> Details(int id)
        {
            var s = await _db.Students
                        .Include(x => x.Class)
                        .AsNoTracking()
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(x => x.Id == id);

            if (s == null) return NotFound();

            var vm = new StudentListItemViewModel
            {
                Id = s.Id,
                Photo = s.PhotoPath ?? "/uploads/students/default.png",
                FirstName = s.FirstName,
                LastName = s.LastName,
                NationalCode = s.NationalCode,
                Grade = s.Grade,
                SchoolName = s.SchoolName,
                CoachName = s.CoachName,
                IsActive = s.IsActive,
                InactiveReason = s.InactiveReason,
                ClassId = s.ClassId,
                ClassName = s.Class?.Name,
                ConsentForm = (Student.FormStatus)s.ConsentForm,
                StudentInterviewForm = (Student.FormStatus)s.StudentInterviewForm,
                ParentInterviewForm = (Student.FormStatus)s.ParentInterviewForm,
                TalentTest = (Student.FormStatus)s.TalentTest,
                PsychologyForm = (Student.FormStatus)s.PsychologyForm,
                IQTest = (Student.FormStatus)s.IQTest,
                WarkTest = (Student.FormStatus)s.WarkTest,
                PaymentStatus = s.PaymentStatus,
                EntryDateShamsi = PersianDateConverter.ToShamsiString(s.EntryDate),
                BirthDateShamsi = PersianDateConverter.ToShamsiString(s.BirthDate)
            };

            return View(vm);
        }

        // ---------------- Create (GET) ----------------
        [HttpGet]
        public IActionResult Create()
        {
            var vm = new Data.VModels.StudentCreateViewModel();

            // در صورت نیاز select lists را اینجا لود کن (مثال):
            // ViewBag.Classes = new SelectList(_db.Classes.AsNoTracking().ToList(), "Id", "Name");

            return View(vm);
            }

        // ---------------- Create (POST) ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Data.VModels.StudentCreateViewModel model, IFormFile? Photo)
        {
            // 1) اعتبارسنجی اولیه مدل
            if (!ModelState.IsValid)
            {
                var notifyInvalid = new { type = "error", message = "فرم معتبر نیست. لطفاً مقادیر را بررسی کنید." };
                TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(notifyInvalid);

                // در صورت وجود SelectList ها مجدداً آنها را لود کن (در صورت نیاز)
                ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                return View(model);
            }

            // 2) اعتبارسنجی و پارس تاریخ‌های شمسی (BirthDateShamsi و EntryDateShamsi)
            DateTime? birthDateUtc = null;
            DateTime? entryDateUtc = null;

            if (!string.IsNullOrWhiteSpace(model.BirthDateShamsi))
            {
                if (!PersianDateConverter.TryParseShamsiToUtc(model.BirthDateShamsi.Trim(), out var bd))
                {
                    ModelState.AddModelError(nameof(model.BirthDateShamsi), "فرمت تاریخ تولد نامعتبر است — از قالب YYYY/MM/DD استفاده کنید (مثال: 1389/02/25).");
                }
                else
                {
                    birthDateUtc = bd;
                }
            }

            if (!string.IsNullOrWhiteSpace(model.EntryDateShamsi))
            {
                if (!PersianDateConverter.TryParseShamsiToUtc(model.EntryDateShamsi.Trim(), out var ed))
                {
                    ModelState.AddModelError(nameof(model.EntryDateShamsi), "فرمت تاریخ ورود نامعتبر است — از قالب YYYY/MM/DD استفاده کنید (مثال: 1403/07/01).");
                }
                else
                {
                    entryDateUtc = ed;
                }
            }

            // اگر خطای مدل (مانند فرمت تاریخ) وجود دارد، دوباره ویو را بازگردان
            if (!ModelState.IsValid)
            {
                // پیام کلی جهت نمایش با Swal (در صورت نیاز)
                TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(new { type = "error", message = "فرم شامل مقادیر نامعتبر است. لطفاً خطاها را اصلاح کنید." });

                ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                return View(model);
            }

            // 3) پردازش تصویر (اختیاری اما امن)
            string? photoPath = null;
            if (Photo != null && Photo.Length > 0)
            {
                var allowedExt = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                var ext = Path.GetExtension(Photo.FileName)?.ToLowerInvariant();
                if (string.IsNullOrEmpty(ext) || !allowedExt.Contains(ext))
                {
                    var notifyObj = new { type = "error", message = "پسوند تصویر نامعتبر است. (jpg, jpeg, png, webp)" };
                    TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(notifyObj);
                    ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                    return View(model);
                }

                const long maxBytes = 2 * 1024 * 1024; // 2MB
                if (Photo.Length > maxBytes)
                {
                    var notifyObj = new { type = "error", message = "حجم تصویر بیش از حد مجاز است (حداکثر 2 مگابایت)." };
                    TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(notifyObj);
                    ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                    return View(model);
                }

                try
                {
                    var uploads = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "students");
                    if (!Directory.Exists(uploads)) Directory.CreateDirectory(uploads);

                    var fileName = $"{Guid.NewGuid()}{ext}";
                    var filePath = Path.Combine(uploads, fileName);

                    await using (var fs = new FileStream(filePath, FileMode.Create))
                    {
                        await Photo.CopyToAsync(fs);
                    }

                    photoPath = $"/uploads/students/{fileName}";
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Error saving student photo");
                    var notifyObj = new { type = "error", message = "خطا هنگام ذخیره تصویر. لطفاً دوباره تلاش کنید." };
                    TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(notifyObj);
                    ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                    return View(model);
                }
            }

            // 4) ساخت Student بر اساس ViewModel (با نگهداری بقیه فیلدها بدون تغییر)
            var student = new Student
            {
                FirstName = model.FirstName,
                LastName = model.LastName,
                FatherName = model.FatherName,
                SchoolName = model.SchoolName,
                PhotoPath = photoPath,
                Grade = model.Grade,
                CoachName = model.CoachName,
                NationalCode = model.NationalCode,
                InactiveReason = model.InactiveReason,
                WorkgroupName = model.WorkgroupName,
                ConsentForm = model.ConsentForm,
                StudentInterviewForm = model.StudentInterviewForm,
                ParentInterviewForm = model.ParentInterviewForm,
                TalentTest = model.TalentTest,
                PsychologyForm = model.PsychologyForm,
                IQTest = model.IQTest,
                WarkTest = model.WarkTest,
                ClassId = model.ClassId,
                IsActive = model.IsActive,
                // === new fields ===
                PaymentStatus = model.PaymentStatus,
                // تاریخ‌ها (در صورت وجود)
                BirthDate = birthDateUtc,
                EntryDate = entryDateUtc
                // DeletedAt, DeletedBy, RowVersion, Attendances handled by DB or left null
            };

            // 5) ذخیره و ارسال SignalR و پیام به کاربر
            try
            {
                _db.Students.Add(student);
                await _db.SaveChangesAsync();

                // اگر نیاز به نام کلاس در DTO داریم، آن را بارگزاری کن
                string className = "";
                if (student.ClassId.HasValue)
                {
                    className = await _db.Classes
                                          .Where(c => c.Id == student.ClassId.Value)
                                          .Select(c => c.Name)
                                          .FirstOrDefaultAsync() ?? "";
                }

                // آماده‌سازی DTO کامل برای SignalR
                var dto = new
                {
                    id = student.Id,
                    firstName = student.FirstName,
                    lastName = student.LastName,
                    fatherName = student.FatherName,
                    nationalCode = student.NationalCode,
                    grade = student.Grade,
                    schoolName = student.SchoolName,
                    coachName = student.CoachName,
                    photo = student.PhotoPath ?? "/uploads/students/default.png",
                    isActive = student.IsActive,
                    className = className,
                    inactiveReason = student.InactiveReason,
                    workgroupName = student.WorkgroupName,
                    consentForm = (byte)student.ConsentForm,
                    studentInterviewForm = (byte)student.StudentInterviewForm,
                    parentInterviewForm = (byte)student.ParentInterviewForm,
                    talentTest = (byte)student.TalentTest,
                    psychologyForm = (byte)student.PsychologyForm,
                    iqTest = (byte)student.IQTest,
                    warkTest = (byte)student.WarkTest,
                    paymentStatus = (byte)student.PaymentStatus,
                    birthDate = PersianDateConverter.ToShamsiString(student.BirthDate),
                    entryDate = PersianDateConverter.ToShamsiString(student.EntryDate)
                };

                // ارسال SignalR (اگر شکست خورد، فقط لاگ کن)
                try
                {
                    await _hub.Clients.All.SendAsync("StudentCreated", dto);
                }
                catch (Exception hubEx)
                {
                    _logger?.LogError(hubEx, "Failed to broadcast StudentCreated for id {Id}", student.Id);
                }

                // ذخیره پیام موفقیت در TempData به صورت JSON امن (NotifyJson)
                var notifySuccess = new { type = "success", message = "اطلاعات دانش‌آموز جدید با موفقیت ثبت شد." };
                TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(notifySuccess);

                return RedirectToAction(nameof(Index));
            }
            catch (DbUpdateException dbEx)
            {
                _logger?.LogError(dbEx, "DbUpdateException while creating student");
                var notifyObj = new { type = "error", message = "خطا هنگام ذخیره‌سازی در دیتابیس. لطفاً بعداً تلاش کنید." };
                TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(notifyObj);
                ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                return View(model);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Exception while creating student");
                var notifyObj = new { type = "error", message = "یک خطای داخلی رخ داد. لطفاً بعداً تلاش کنید." };
                TempData["NotifyJson"] = System.Text.Json.JsonSerializer.Serialize(notifyObj);
                ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                return View(model);
            }
        }

        // ---------------- Edit (GET) ----------------
        [HttpGet]
        public async Task<IActionResult> Edit(int id)
        {
            var s = await _db.Students
                             .IgnoreQueryFilters()
                             .Include(x => x.Class)
                             .AsNoTracking()
                             .FirstOrDefaultAsync(x => x.Id == id);

            if (s == null)
            {
                TempData["ErrorMessage"] = "دانش‌آموز مورد نظر یافت نشد.";
                return RedirectToAction(nameof(Index));
            }

            // تبدیل تاریخ‌های ذخیره شده به سال/ماه/روز شمسی برای پر کردن فرم
            int? birthYear = null, birthMonth = null, birthDay = null;
            if (s.BirthDate.HasValue)
            {
                var sh = PersianDateConverter.ToShamsiString(s.BirthDate);
                if (!string.IsNullOrEmpty(sh))
                {
                    var parts = sh.Split('/');
                    if (parts.Length >= 3 &&
                        int.TryParse(parts[0], out var by) &&
                        int.TryParse(parts[1], out var bm) &&
                        int.TryParse(parts[2], out var bd))
                    {
                        birthYear = by; birthMonth = bm; birthDay = bd;
                    }
                }
            }

            int? entryYear = null, entryMonth = null, entryDay = null;
            if (s.EntryDate.HasValue)
            {
                var sh = PersianDateConverter.ToShamsiString(s.EntryDate);
                if (!string.IsNullOrEmpty(sh))
                {
                    var parts = sh.Split('/');
                    if (parts.Length >= 3 &&
                        int.TryParse(parts[0], out var ey) &&
                        int.TryParse(parts[1], out var em) &&
                        int.TryParse(parts[2], out var ed))
                    {
                        entryYear = ey; entryMonth = em; entryDay = ed;
                    }
                }
            }

            var student = _db.Students.Find(id);
            if (student == null) return NotFound();

            var vm = new StudentEditViewModel
            {
                Id = s.Id,
                FirstName = s.FirstName,
                LastName = s.LastName,
                FatherName = s.FatherName,
                SchoolName = s.SchoolName,
                Grade = s.Grade,
                CoachName = s.CoachName,
                NationalCode = s.NationalCode,
                ClassId = s.ClassId,
                PhotoPath = s.PhotoPath,
                InactiveReason = s.InactiveReason,
                WorkgroupName = s.WorkgroupName,
                ConsentForm = s.ConsentForm,
                StudentInterviewForm = s.StudentInterviewForm,
                ParentInterviewForm = s.ParentInterviewForm,
                TalentTest = s.TalentTest,
                PsychologyForm = s.PsychologyForm,
                IQTest = s.IQTest,
                WarkTest = s.WarkTest,
                IsActive = s.IsActive,
                RowVersion = s.RowVersion != null ? Convert.ToBase64String(s.RowVersion) : null,

                // جدید: populate birth & entry Y/M/D + payment status
                BirthYear = birthYear,
                BirthMonth = birthMonth,
                BirthDay = birthDay,
                EntryYear = entryYear,
                EntryMonth = entryMonth,
                EntryDay = entryDay,
                PaymentStatus = s.PaymentStatus
            };

            var pc = new PersianCalendar();

            // اگر در DB تاریخ تولد به صورت Nullable<DateTime> ذخیره شده
            if (student.BirthDate.HasValue)
            {
                var g = student.BirthDate.Value;
                vm.BirthYear = pc.GetYear(g);
                vm.BirthMonth = pc.GetMonth(g);
                vm.BirthDay = pc.GetDayOfMonth(g);
            }

            if (student.EntryDate.HasValue)
            {
                var ge = student.EntryDate.Value;
                vm.EntryYear = pc.GetYear(ge);
                vm.EntryMonth = pc.GetMonth(ge);
                vm.EntryDay = pc.GetDayOfMonth(ge);
            }

            // load select lists if you use them in the view
            ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");

            return View("Edit", vm); // or "Edit" if your view file is Views/Students/Edit.cshtml
        }

        // ---------------- Edit (POST) ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(StudentEditViewModel model)
        {
            if (!ModelState.IsValid)
            {
                TempData["ErrorMessage"] = "فرم معتبر نیست. لطفاً مقادیر را بررسی کنید.";
                ViewBag.Classes = new SelectList(await _db.Classes.AsNoTracking().ToListAsync(), "Id", "Name");
                return View("Edit", model);
            }

            var item = await _db.Students
                                .IgnoreQueryFilters()
                                .Include(s => s.Class)
                                .FirstOrDefaultAsync(s => s.Id == model.Id);

            if (item == null)
            {
                TempData["ErrorMessage"] = "دانش‌آموز یافت نشد.";
                return RedirectToAction(nameof(Index));
            }

            // Concurrency original rowversion
            if (!string.IsNullOrEmpty(model.RowVersion))
            {
                try
                {
                    var original = Convert.FromBase64String(model.RowVersion);
                    _db.Entry(item).Property("RowVersion").OriginalValue = original;
                }
                catch (FormatException)
                {
                    TempData["ErrorMessage"] = "اطلاعات همزمان‌سازی نادرست است. لطفاً صفحه را رفرش کنید و دوباره تلاش کنید.";
                    return RedirectToAction(nameof(Index));
                }
            }

            // Process photo upload if any
            if (model.Photo != null && model.Photo.Length > 0)
            {
                var allowedExt = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                var ext = Path.GetExtension(model.Photo.FileName)?.ToLowerInvariant();
                if (string.IsNullOrEmpty(ext) || !allowedExt.Contains(ext))
                {
                    TempData["ErrorMessage"] = "فرمت تصویر مجاز نیست. (jpg, jpeg, png, webp)";
                    return RedirectToAction(nameof(Index));
                }

                const long maxBytes = 2 * 1024 * 1024; // 2MB
                if (model.Photo.Length > maxBytes)
                {
                    TempData["ErrorMessage"] = "حجم تصویر بیش از حد مجاز است (حداکثر 2MB).";
                    return RedirectToAction(nameof(Index));
                }

                try
                {
                    var uploads = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "students");
                    if (!Directory.Exists(uploads)) Directory.CreateDirectory(uploads);

                    var fileName = $"{Guid.NewGuid()}{ext}";
                    var filePath = Path.Combine(uploads, fileName);

                    await using (var fs = new FileStream(filePath, FileMode.Create))
                    {
                        await model.Photo.CopyToAsync(fs);
                    }

                    item.PhotoPath = $"/uploads/students/{fileName}";
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Error saving photo for student {Id}", model.Id);
                    TempData["ErrorMessage"] = "خطا هنگام ذخیره تصویر.";
                    return RedirectToAction(nameof(Index));
                }
            }

            // Map allowed fields
            item.FirstName = model.FirstName;
            item.LastName = model.LastName;
            item.FatherName = model.FatherName;
            item.SchoolName = model.SchoolName;
            item.Grade = model.Grade;
            item.CoachName = model.CoachName;
            item.NationalCode = model.NationalCode;
            item.ClassId = model.ClassId;

            item.InactiveReason = model.InactiveReason;
            item.WorkgroupName = model.WorkgroupName;
            item.ConsentForm = model.ConsentForm;
            item.StudentInterviewForm = model.StudentInterviewForm;
            item.ParentInterviewForm = model.ParentInterviewForm;
            item.TalentTest = model.TalentTest;
            item.PsychologyForm = model.PsychologyForm;
            item.IQTest = model.IQTest;
            item.WarkTest = model.WarkTest;
            item.IsActive = model.IsActive;

            // تبدیل تاریخ‌های شمسی ارسال‌شده در مدل به DateTime برای ذخیره
            DateTime? newBirth = null;
            if (model.BirthYear.HasValue && model.BirthMonth.HasValue && model.BirthDay.HasValue)
            {
                var sh = $"{model.BirthYear.Value:0000}/{model.BirthMonth.Value:00}/{model.BirthDay.Value:00}";
                newBirth = PersianDateConverter.ParseShamsiToUtc(sh);
            }

            DateTime? newEntry = null;
            // <<< اصلاح شده: استفاده از EntryYear/EntryMonth/EntryDay به‌جای BirthYear/... >>>
            if (model.EntryYear.HasValue && model.EntryMonth.HasValue && model.EntryDay.HasValue)
            {
                var sh = $"{model.EntryYear.Value:0000}/{model.EntryMonth.Value:00}/{model.EntryDay.Value:00}";
                newEntry = PersianDateConverter.ParseShamsiToUtc(sh);
            }

            item.BirthDate = newBirth;
            item.EntryDate = newEntry;

            // وضعیت پرداخت
            item.PaymentStatus = model.PaymentStatus;

            try
            {
                _db.Students.Update(item);
                await _db.SaveChangesAsync();

                var dto = new
                {
                    id = item.Id,
                    firstName = item.FirstName,
                    lastName = item.LastName,
                    fatherName = item.FatherName,
                    nationalCode = item.NationalCode,
                    grade = item.Grade,
                    schoolName = item.SchoolName,
                    coachName = item.CoachName,
                    photo = item.PhotoPath ?? "/uploads/students/default.png",
                    isActive = item.IsActive,
                    className = item.Class != null ? item.Class.Name : "",
                    inactiveReason = item.InactiveReason,
                    workgroupName = item.WorkgroupName,
                    consentForm = (byte)item.ConsentForm,
                    studentInterviewForm = (byte)item.StudentInterviewForm,
                    parentInterviewForm = (byte)item.ParentInterviewForm,
                    talentTest = (byte)item.TalentTest,
                    psychologyForm = (byte)item.PsychologyForm,
                    iqTest = (byte)item.IQTest,
                    warkTest = (byte)item.WarkTest,
                    paymentStatus = (byte)item.PaymentStatus,
                    entryDateShamsi = PersianDateConverter.ToShamsiString(item.EntryDate),
                    birthDateShamsi = PersianDateConverter.ToShamsiString(item.BirthDate)
                };

                try
                {
                    await _hub.Clients.All.SendAsync("StudentUpdated", dto);
                }
                catch (Exception hubEx)
                {
                    _logger?.LogError(hubEx, "Failed to broadcast StudentUpdated for id {Id}", item.Id);
                }

                TempData["SuccessMessage"] = "اطلاعات با موفقیت ویرایش شد.";
                return RedirectToAction(nameof(Index));
            }
            catch (DbUpdateConcurrencyException dex)
            {
                _logger?.LogError(dex, "Concurrency error editing student {Id}", model.Id);
                TempData["ErrorMessage"] = "خطا در به‌روزرسانی: تغییرات همزمان تشخیص داده شد. لطفاً صفحه را رفرش کنید و دوباره تلاش کنید.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error editing student {Id}", model.Id);
                TempData["ErrorMessage"] = "خطا در به‌روزرسانی اطلاعات.";
                return RedirectToAction(nameof(Index));
            }
        }

        // ---------------- DeleteConfirmed (POST) ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(
            Data.VModels.Students.StudentDeleteViewModel model,
            [FromServices] IHubContext<StudentsHub> hub)
        {
            // 1) اعتبارسنجی مدل
            if (!ModelState.IsValid)
            {
                TempData["Notify"] = System.Text.Json.JsonSerializer.Serialize(new
                {
                    Type = "error",
                    Message = "اطلاعات ارسال‌شده نامعتبر است. لطفاً مجدداً تلاش کنید."
                });
                return RedirectToAction(nameof(Index));
            }

            // 2) بازیابی رکورد (از جمله رکوردهای فیلتر شده، در صورت وجود فیلتر سراسری)
            var student = await _db.Students
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.Id == model.Id);

            if (student == null)
            {
                TempData["Notify"] = System.Text.Json.JsonSerializer.Serialize(new
                {
                    Type = "error",
                    Message = "دانش‌آموز مورد نظر یافت نشد."
                });
                return RedirectToAction(nameof(Index));
            }

            // 3) اگر قبلاً غیرفعال شده بود، پیام مناسب بده و کار را ادامه نده
            if (!student.IsActive)
            {
                TempData["Notify"] = System.Text.Json.JsonSerializer.Serialize(new
                {
                    Type = "info",
                    Message = $"دانش‌آموز {student.FirstName} {student.LastName} قبلاً غیرفعال شده است."
                });
                return RedirectToAction(nameof(Index));
            }

            // 4) اعمال تغییرات
            student.IsActive = false;
            student.InactiveReason = model.InactiveReason;
            student.DeletedAt = DateTime.UtcNow;

            // 5) ذخیره‌سازی با هندل استثناها
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger?.LogError(ex, "Concurrency error while deactivating student {StudentId}", model.Id);
                TempData["Notify"] = System.Text.Json.JsonSerializer.Serialize(new
                {
                    Type = "error",
                    Message = "عملیات به‌دلیل تغییر هم‌زمان داده انجام نشد. لطفاً صفحه را مجدداً بارگذاری و تلاش کنید."
                });
                return RedirectToAction(nameof(Index));
            }
            catch (DbUpdateException ex)
            {
                _logger?.LogError(ex, "Database error while deactivating student {StudentId}", model.Id);
                TempData["Notify"] = System.Text.Json.JsonSerializer.Serialize(new
                {
                    Type = "error",
                    Message = "خطا در ذخیره‌سازی داده رخ داد. لطفاً بعداً مجدداً تلاش کنید."
                });
                return RedirectToAction(nameof(Index));
            }

            // 6) ارسال اعلان real-time به تمام کاربران
            try
            {
                var total = await _db.Students.CountAsync();
                var inactive = await _db.Students.CountAsync(x => !x.IsActive);
                var active = total - inactive;

                await hub.Clients.All.SendAsync("StudentDeactivated", new
                {
                    id = student.Id,
                    firstName = student.FirstName,
                    lastName = student.LastName,
                    reason = student.InactiveReason,
                    stats = new { total, inactive, active }
                });
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to send StudentDeactivated hub message for student {StudentId}", student.Id);
            }

            // 7) پیام موفقیت جهت نمایش در UI
            TempData["Notify"] = System.Text.Json.JsonSerializer.Serialize(new
            {
                Type = "success",
                Message = $"دانش‌آموز {student.FirstName} {student.LastName} با موفقیت غیرفعال شد."
            });

            return RedirectToAction(nameof(Index));
        }

        // ---------------- Restore (POST) ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Restore(int id, [FromServices] IHubContext<StudentsHub> hub)
        {
            if (id <= 0)
            {
                TempData["Notify"] = JsonSerializer.Serialize(new { Type = "error", Message = "درخواست نامعتبر است." });
                return RedirectToAction(nameof(Index));
            }

            try
            {
                var student = await _db.Students.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Id == id);
                if (student == null)
                {
                    TempData["Notify"] = JsonSerializer.Serialize(new { Type = "error", Message = "دانش‌آموز مورد نظر یافت نشد." });
                    return RedirectToAction(nameof(Index));
                }

                student.IsActive = true;
                // اگر خواستی InactiveReason پاک شود: student.InactiveReason = null;
                student.DeletedAt = null;
                student.DeletedBy = User?.Identity?.Name;

                _db.Students.Update(student);
                await _db.SaveChangesAsync();

                var dto = new
                {
                    id = student.Id,
                    firstName = student.FirstName,
                    lastName = student.LastName,
                    isActive = student.IsActive,
                    inactiveReason = student.InactiveReason ?? ""
                };

                try
                {
                    await hub.Clients.All.SendAsync("StudentRestored", dto);
                }
                catch (Exception hubEx)
                {
                    _logger?.LogError(hubEx, "Failed to send StudentRestored via hub for Id:{Id}", student.Id);
                }

                TempData["Notify"] = JsonSerializer.Serialize(new { Type = "success", Message = "دانش‌آموز با موفقیت فعال شد." });
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Exception in Restore for Id: {Id}", id);
                TempData["Notify"] = JsonSerializer.Serialize(new { Type = "error", Message = "خطا در فعال‌سازی مجدد." });
                return RedirectToAction(nameof(Index));
            }
        }

        // ---------------- Hard Delete (POST) ----------------
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> HardDelete(int id)
        {
            var item = await _db.Students.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Id == id);
            if (item == null)
            {
                TempData["ErrorMessage"] = "دانش‌آموز یافت نشد.";
                return RedirectToAction(nameof(Archive));
            }

            try
            {
                _db.Students.Remove(item);
                await _db.SaveChangesAsync();

                await _hub.Clients.All.SendAsync("StudentHardDeleted", new { id = id });

                TempData["SuccessMessage"] = "دانش‌آموز به‌صورت دائمی حذف شد.";
                return RedirectToAction(nameof(Archive));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error hard-deleting student {Id}", id);
                TempData["ErrorMessage"] = "خطا در حذف دائمی.";
                return RedirectToAction(nameof(Archive));
            }
        }

        private object MapToDto(Student s)
        {
            return new
            {
                id = s.Id,
                firstName = s.FirstName,
                lastName = s.LastName,
                fatherName = s.FatherName,
                nationalCode = s.NationalCode,
                grade = s.Grade,
                schoolName = s.SchoolName,
                coachName = s.CoachName,
                photo = s.PhotoPath ?? "/uploads/students/default.png",
                isActive = s.IsActive,
                className = s.Class != null ? s.Class.Name : "",
                paymentStatus = (byte)s.PaymentStatus,
                entryDateShamsi = PersianDateConverter.ToShamsiString(s.EntryDate),
                birthDateShamsi = PersianDateConverter.ToShamsiString(s.BirthDate)
            };
        }
    }

}
