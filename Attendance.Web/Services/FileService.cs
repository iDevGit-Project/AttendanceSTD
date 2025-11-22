// Services/FileService.cs
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using System;
using System.IO;
using System.Threading.Tasks;
using static System.Net.Mime.MediaTypeNames;
using Image = SixLabors.ImageSharp.Image;

namespace Attendance.Web.Services
{
    /// <summary>
    /// نتیجهٔ ذخیره فایل
    /// </summary>
    public class FileSaveResult
    {
        public bool Success { get; set; } = false;
        public string Message { get; set; } = "";
        public string FileName { get; set; }
        public string RelativePath { get; set; }
        public string ThumbFileName { get; set; }
        public string ThumbRelativePath { get; set; }
        public long FileSize { get; set; }
    }

    public class FileService
    {
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<FileService> _logger;

        // تنظیمات پیش‌فرض — قابل تغییر در این کلاس اگر خواستی
        private readonly string _uploadsRelative = "uploads/students";
        private readonly long _maxFileSizeBytes = 6 * 1024 * 1024; // 6 MB
        private readonly string[] _allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };

        public FileService(IWebHostEnvironment env, ILogger<FileService> logger)
        {
            _env = env ?? throw new ArgumentNullException(nameof(env));
            _logger = logger;
        }

        /// <summary>
        /// ذخیره عکس اصلی و تولید thumbnail
        /// برمی‌گرداند FileSaveResult که شامل مسیرهای نسبی برای ذخیره در DB است.
        /// </summary>
        public async Task<FileSaveResult> SaveStudentPhotoAndThumbnailAsync(IFormFile photo, int thumbWidth = 240)
        {
            var result = new FileSaveResult();

            try
            {
                if (photo == null || photo.Length == 0)
                {
                    result.Message = "فایلی برای ذخیره ارسال نشده است.";
                    return result;
                }

                if (photo.Length > _maxFileSizeBytes)
                {
                    result.Message = $"حجم فایل بیش از حد مجاز است (حداکثر {_maxFileSizeBytes / (1024 * 1024)} مگابایت).";
                    return result;
                }

                var ext = Path.GetExtension(photo.FileName)?.ToLowerInvariant() ?? "";
                if (Array.IndexOf(_allowedExtensions, ext) < 0)
                {
                    result.Message = "فرمت فایل مجاز نیست. فقط jpg, jpeg, png, webp پشتیبانی می‌شود.";
                    return result;
                }

                // مسیر فیزیکی پوشه uploads/students
                var wwwroot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var uploadsFolder = Path.Combine(wwwroot, _uploadsRelative.Replace('/', Path.DirectorySeparatorChar));

                Directory.CreateDirectory(uploadsFolder);

                // نام فایل یکتا
                var baseName = Guid.NewGuid().ToString("N");
                var fileName = baseName + ext;
                var filePath = Path.Combine(uploadsFolder, fileName);

                var thumbFileName = $"{baseName}_thumb{ext}";
                var thumbPath = Path.Combine(uploadsFolder, thumbFileName);

                // ذخیره‌ی فایل اصلی به دیسک (بدون نگهداری طولانی در حافظه)
                using (var dst = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
                {
                    await photo.CopyToAsync(dst);
                }

                using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    // بارگذاری تصویر به صورت هم‌زمان (سازگارتر و ساده‌تر)
                    using (Image<Rgba32> image = Image.Load<Rgba32>(fs))
                    {
                        image.Mutate(x => x.Resize(new ResizeOptions
                        {
                            Size = new Size(thumbWidth, 0),
                            Mode = ResizeMode.Max
                        }));

                        var encoder = new JpegEncoder { Quality = 80 };

                        // ذخیره thumbnail به‌صورت async (SaveAsJpegAsync موجود است)
                        using (var outFs = new FileStream(thumbPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
                        {
                            await image.SaveAsJpegAsync(outFs, encoder);
                        }
                    }
                }

                // تنظیم نتیجه با مسیرهای نسبی (برای استفاده در DB)
                var relativeMain = "/" + Path.Combine(_uploadsRelative, fileName).Replace('\\', '/').TrimStart('/');
                var relativeThumb = "/" + Path.Combine(_uploadsRelative, thumbFileName).Replace('\\', '/').TrimStart('/');

                result.Success = true;
                result.Message = "فایل با موفقیت ذخیره شد.";
                result.FileName = fileName;
                result.RelativePath = relativeMain;
                result.ThumbFileName = thumbFileName;
                result.ThumbRelativePath = relativeThumb;
                result.FileSize = photo.Length;

                _logger?.LogInformation("Saved student photo {File} and thumb {Thumb}", fileName, thumbFileName);
                return result;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error saving student photo");
                result.Success = false;
                result.Message = "خطا هنگام ذخیره فایل: " + ex.Message;
                return result;
            }
        }

        /// <summary>
        /// حذف فایل‌ها (اصلی و thumbnail) امن
        /// ورودی‌ها مسیرهای نسبی مثل "/uploads/students/abcd.jpg"
        /// </summary>
        public Task<bool> DeleteFilesAsync(string relativePath, string relativeThumbPath)
        {
            try
            {
                var wwwroot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

                if (!string.IsNullOrWhiteSpace(relativePath))
                {
                    var absolute = Path.Combine(wwwroot, relativePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
                    if (File.Exists(absolute))
                    {
                        File.Delete(absolute);
                    }
                }

                if (!string.IsNullOrWhiteSpace(relativeThumbPath))
                {
                    var absoluteThumb = Path.Combine(wwwroot, relativeThumbPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
                    if (File.Exists(absoluteThumb))
                    {
                        File.Delete(absoluteThumb);
                    }
                }

                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error deleting student photo files");
                return Task.FromResult(false);
            }
        }
    }
}
