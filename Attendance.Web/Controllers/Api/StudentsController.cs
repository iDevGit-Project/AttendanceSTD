using Attendance.Data.Conext;
using Attendance.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Web.Controllers.Api
{
    [ApiController]
    [Route("api/v1/students")]
    public class StudentsApiController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IWebHostEnvironment _env;

        public StudentsApiController(ApplicationDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var items = await _db.Students
                .OrderBy(s => s.LastName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var s = await _db.Students
                .Include(x => x.Class)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (s == null) return NotFound();

            // بازگشت DTO ساده (فقط فیلدهایی که مطمئناً وجود دارند)
            return Ok(new
            {
                id = s.Id,
                firstName = s.FirstName,
                lastName = s.LastName,
                fatherName = s.FatherName,
                schoolName = s.SchoolName,
                photoPath = s.PhotoPath,
                grade = s.Grade,
                coachName = s.CoachName,
                nationalCode = s.NationalCode,
                className = s.Class?.Name
                // اگر فیلدهای دیگری (مثل DateOfBirth) اضافه کردی، اینجا آنها را هم قرار بده
            });
        }

        [HttpPost]
        [RequestSizeLimit(10_000_000)] // محدودیت آپلود (مثلاً 10MB)
        public async Task<IActionResult> Create([FromForm] Student model, IFormFile? photo)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (photo != null && photo.Length > 0)
            {
                var uploads = Path.Combine(_env.WebRootPath, "uploads", "students");
                if (!Directory.Exists(uploads)) Directory.CreateDirectory(uploads);

                var ext = Path.GetExtension(photo.FileName);
                var fileName = $"{Guid.NewGuid()}{ext}";
                var filePath = Path.Combine(uploads, fileName);

                using var stream = new FileStream(filePath, FileMode.Create);
                await photo.CopyToAsync(stream);

                model.PhotoPath = $"/uploads/students/{fileName}";
            }

            _db.Students.Add(model);
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = model.Id }, model);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromForm] Student model, IFormFile? photo)
        {
            if (id != model.Id) return BadRequest();

            var item = await _db.Students.FindAsync(id);
            if (item == null) return NotFound();

            item.FirstName = model.FirstName;
            item.LastName = model.LastName;
            item.FatherName = model.FatherName;
            item.SchoolName = model.SchoolName;
            item.Grade = model.Grade;
            item.CoachName = model.CoachName;
            item.NationalCode = model.NationalCode;
            item.ClassId = model.ClassId;

            if (photo != null && photo.Length > 0)
            {
                var uploads = Path.Combine(_env.WebRootPath, "uploads", "students");
                if (!Directory.Exists(uploads)) Directory.CreateDirectory(uploads);

                var ext = Path.GetExtension(photo.FileName);
                var fileName = $"{Guid.NewGuid()}{ext}";
                var filePath = Path.Combine(uploads, fileName);

                using var stream = new FileStream(filePath, FileMode.Create);
                await photo.CopyToAsync(stream);

                item.PhotoPath = $"/uploads/students/{fileName}";
            }

            _db.Students.Update(item);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Students.FindAsync(id);
            if (item == null) return NotFound();

            _db.Students.Remove(item);
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }
}
